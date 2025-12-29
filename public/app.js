// API Base URL
const API_BASE = '/api';

// Funnel-Stufen Namen
const STAGE_NAMES = {
    1: 'Lead',
    2: 'Meeting vereinbart',
    3: 'Follow Up',
    4: 'Kaufentscheidung',
    5: 'Kauf',
    6: 'Absage'
};

// Konversionsraten pro Stufe
const CONVERSION_RATES = {
    1: 0.01,  // Lead: 1%
    2: 0.10,  // Meeting vereinbart: 10%
    3: 0.20,  // Follow Up: 20%
    4: 0.75,  // Kaufentscheidung: 75% (= 3000€ pro Kunde)
    5: 1.00,  // Kauf: 100%
    6: 0.00   // Absage: 0%
};

// Basis-Produktpreis
const BASE_PRICE = 4000;

// Lade Kunden von der API
async function loadCustomers() {
    try {
        const response = await fetch(`${API_BASE}/customers`);
        const data = await response.json();
        
        if (data.success) {
            renderCustomers(data.customers);
            updateLastUpdate();
        } else {
            console.error('Fehler beim Laden der Kunden:', data.error);
        }
    } catch (error) {
        console.error('Fehler beim Laden der Kunden:', error);
    }
}

// Rendere Kunden in den entsprechenden Spalten
function renderCustomers(customers) {
    // Leere alle Spalten
    for (let i = 1; i <= 6; i++) {
        const container = document.getElementById(`stage-${i}`);
        if (container) {
            container.innerHTML = '';
        }
        const countElement = document.getElementById(`count-${i}`);
        if (countElement) {
            countElement.textContent = '0';
        }
    }
    
    // Gruppiere Kunden nach Stufe
    const customersByStage = {
        1: [],
        2: [],
        3: [],
        4: [],
        5: [],
        6: []
    };
    
    customers.forEach(customer => {
        const stage = customer.current_stage;
        if (stage >= 1 && stage <= 6) {
            customersByStage[stage].push(customer);
        }
    });
    
    // Rendere Kunden in den Spalten
    for (let stage = 1; stage <= 6; stage++) {
        const container = document.getElementById(`stage-${stage}`);
        const countElement = document.getElementById(`count-${stage}`);
        const stageCustomers = customersByStage[stage];
        
        countElement.textContent = stageCustomers.length;
        
        stageCustomers.forEach(customer => {
            const card = createCustomerCard(customer);
            container.appendChild(card);
        });
    }
    
    // Aktualisiere erwartete Werte
    updateExpectedValues(customersByStage);
}

// Berechne erwarteten Wert für eine Stufe
function calculateExpectedValue(stage, customerCount) {
    const rate = CONVERSION_RATES[stage] || 0;
    return BASE_PRICE * rate * customerCount;
}

// Aktualisiere erwartete Werte für alle Stufen
function updateExpectedValues(customersByStage) {
    let totalExpectedValue = 0;
    
    for (let stage = 1; stage <= 6; stage++) {
        const customerCount = customersByStage[stage].length;
        const expectedValue = calculateExpectedValue(stage, customerCount);
        
        // Nur Stages 1-4 in den Gesamterwarteten Wert einbeziehen (nicht Kauf/Absage)
        if (stage <= 4) {
            totalExpectedValue += expectedValue;
        }
        
        const valueElement = document.getElementById(`expected-value-${stage}`);
        
        if (valueElement) {
            // Formatiere als Währung (deutsches Format)
            const formattedValue = new Intl.NumberFormat('de-DE', {
                style: 'currency',
                currency: 'EUR',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(expectedValue);

            // Stage 5 (Kauf) zeigt "Realisierter Wert", alle anderen "Erwarteter Wert"
            const label = stage === 5 ? 'Realisierter Wert' : 'Erwarteter Wert';
            valueElement.textContent = `${label}: ${formattedValue}`;
        }
    }
    
    // Aktualisiere Gesamterwarteten Wert im Header
    const totalValueElement = document.getElementById('total-expected-value');
    if (totalValueElement) {
        const formattedTotal = new Intl.NumberFormat('de-DE', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(totalExpectedValue);
        
        totalValueElement.textContent = `Gesamterwarteter Wert: ${formattedTotal}`;
    }
}

// Berechne Tage in aktueller Stufe
function calculateDaysInStage(customer) {
    const updatedAt = new Date(customer.updated_at);
    const now = new Date();
    const diffTime = Math.abs(now - updatedAt);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}

// Bestimme Farbklasse basierend auf Tagen
function getDaysColorClass(days) {
    if (days <= 14) {
        return 'days-green';
    } else if (days <= 28) {
        return 'days-orange';
    } else {
        return 'days-red';
    }
}

// Erstelle eine Kunden-Karte
function createCustomerCard(customer) {
    const card = document.createElement('div');
    card.className = 'customer-card';
    card.dataset.customerId = customer.id;
    
    const name = document.createElement('div');
    name.className = 'customer-name';
    name.textContent = `${customer.firstname || ''} ${customer.lastname || ''}`.trim() || 'Unbekannt';
    
    const email = document.createElement('div');
    email.className = 'customer-email';
    email.textContent = customer.email;
    
    // Tage-Counter
    const days = calculateDaysInStage(customer);
    const daysElement = document.createElement('div');
    daysElement.className = `days-in-stage ${getDaysColorClass(days)}`;
    daysElement.textContent = `${days} Tage in dieser Stufe`;
    
    card.appendChild(name);
    card.appendChild(email);
    card.appendChild(daysElement);
    
    // Click-Handler für Modal
    card.addEventListener('click', () => openCustomerModal(customer.id));
    
    return card;
}

// ======== MODAL FUNKTIONEN ========

let currentCustomerId = null;

// Öffne das Kunden-Detail Modal
async function openCustomerModal(customerId) {
    currentCustomerId = customerId;
    const modal = document.getElementById('customerModal');
    
    // Modal anzeigen
    modal.classList.add('active');
    
    // Lade Kunden-Details
    await loadCustomerDetails(customerId);
    
    // Aktiviere ersten Tab
    switchTab('history');
}

// Schließe das Modal
function closeCustomerModal() {
    const modal = document.getElementById('customerModal');
    modal.classList.remove('active');
    currentCustomerId = null;
    
    // Reset Form-Felder
    document.getElementById('note-input').value = '';
    document.getElementById('move-stage').value = '';
    document.getElementById('move-reason').value = '';
}

// Lade Kunden-Details
async function loadCustomerDetails(customerId) {
    try {
        const response = await fetch(`${API_BASE}/customers/${customerId}`);
        const data = await response.json();
        
        if (data.success) {
            // Kundenname setzen
            const customer = data.customer;
            const customerName = `${customer.firstname || ''} ${customer.lastname || ''}`.trim() || 'Unbekannt';
            document.getElementById('modal-customer-name').textContent = customerName;
            
            // Kunden-Info anzeigen
            document.getElementById('modal-customer-info').innerHTML = `
                <div class="info-row">
                    <span class="info-label">E-Mail:</span>
                    <span class="info-value">${customer.email}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Aktuelle Stufe:</span>
                    <span class="info-value stage-badge stage-${customer.current_stage}">${STAGE_NAMES[customer.current_stage]}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Erstellt am:</span>
                    <span class="info-value">${formatDateTime(customer.created_at)}</span>
                </div>
            `;
            
            // Stage-Auswahl aktualisieren (aktuelle Stufe deaktivieren)
            const stageSelect = document.getElementById('move-stage');
            stageSelect.querySelectorAll('option').forEach(option => {
                if (option.value && parseInt(option.value) === customer.current_stage) {
                    option.disabled = true;
                    option.textContent = option.textContent.replace(' (aktuell)', '') + ' (aktuell)';
                } else {
                    option.disabled = false;
                    option.textContent = option.textContent.replace(' (aktuell)', '');
                }
            });
            
            // Verlauf anzeigen
            renderHistory(data.movements);
            
            // Notizen anzeigen
            renderNotes(data.notes);
        } else {
            console.error('Fehler beim Laden der Kundendetails:', data.error);
        }
    } catch (error) {
        console.error('Fehler beim Laden der Kundendetails:', error);
    }
}

// Formatiere Datum/Zeit
function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Rendere History/Verlauf
function renderHistory(movements) {
    const container = document.getElementById('history-list');
    
    if (!movements || movements.length === 0) {
        container.innerHTML = '<p class="empty-state">Noch keine Bewegungen vorhanden.</p>';
        return;
    }
    
    container.innerHTML = movements.map(m => {
        const fromStage = m.from_stage_name || 'Neu erstellt';
        const toStage = m.to_stage_name;
        const source = m.source === 'manual' ? '👤 Manuell' : '🔗 Webhook';
        const reason = m.reason ? `<div class="history-reason">💬 ${escapeHtml(m.reason)}</div>` : '';
        
        return `
            <div class="history-item">
                <div class="history-header">
                    <span class="history-source">${source}</span>
                    <span class="history-date">${formatDateTime(m.created_at)}</span>
                </div>
                <div class="history-movement">
                    <span class="stage-badge stage-${m.from_stage || 'new'}">${fromStage}</span>
                    <span class="history-arrow">→</span>
                    <span class="stage-badge stage-${m.to_stage}">${toStage}</span>
                </div>
                ${reason}
            </div>
        `;
    }).join('');
}

// Rendere Notizen
function renderNotes(notes) {
    const container = document.getElementById('notes-list');
    
    if (!notes || notes.length === 0) {
        container.innerHTML = '<p class="empty-state">Noch keine Notizen vorhanden.</p>';
        return;
    }
    
    container.innerHTML = notes.map(n => `
        <div class="note-item">
            <div class="note-date">${formatDateTime(n.created_at)}</div>
            <div class="note-content">${escapeHtml(n.content)}</div>
        </div>
    `).join('');
}

// HTML-Escape Funktion
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Tab wechseln
function switchTab(tabName) {
    // Tabs
    document.querySelectorAll('.modal-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    
    // Tab-Inhalte
    document.querySelectorAll('.modal-tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `tab-${tabName}`);
    });
}

// Notiz speichern
async function saveNote() {
    const content = document.getElementById('note-input').value.trim();
    
    if (!content) {
        alert('Bitte eine Notiz eingeben.');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/customers/${currentCustomerId}/notes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
        });
        
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('note-input').value = '';
            // Lade Kunden-Details neu
            await loadCustomerDetails(currentCustomerId);
        } else {
            alert('Fehler: ' + data.error);
        }
    } catch (error) {
        console.error('Fehler beim Speichern der Notiz:', error);
        alert('Fehler beim Speichern der Notiz.');
    }
}

// Kunden verschieben
async function moveCustomer() {
    const toStage = document.getElementById('move-stage').value;
    const reason = document.getElementById('move-reason').value.trim();
    
    if (!toStage) {
        alert('Bitte eine Ziel-Stufe auswählen.');
        return;
    }
    
    if (!reason) {
        alert('Bitte eine Begründung eingeben (Pflichtfeld).');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/customers/${currentCustomerId}/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to_stage: parseInt(toStage), reason })
        });
        
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('move-stage').value = '';
            document.getElementById('move-reason').value = '';
            
            // Lade Kunden-Details neu
            await loadCustomerDetails(currentCustomerId);
            
            // Lade alle Kunden neu (um Pipeline zu aktualisieren)
            await loadCustomers();
            
            // Wechsle zu History-Tab um Änderung zu sehen
            switchTab('history');
        } else {
            alert('Fehler: ' + data.error);
        }
    } catch (error) {
        console.error('Fehler beim Verschieben des Kunden:', error);
        alert('Fehler beim Verschieben des Kunden.');
    }
}

// Aktualisiere letzte Update-Zeit
function updateLastUpdate() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('de-DE', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
    });
    document.getElementById('lastUpdate').textContent = `Letzte Aktualisierung: ${timeString}`;
}

// Initialisierung
document.addEventListener('DOMContentLoaded', () => {
    // Lade Kunden beim Start
    loadCustomers();
    
    // Auto-Refresh alle 5 Sekunden
    setInterval(loadCustomers, 5000);
    
    // Modal Event Handlers
    const modal = document.getElementById('customerModal');
    const closeBtn = document.getElementById('modalClose');
    
    // Schließen-Button
    closeBtn.addEventListener('click', closeCustomerModal);
    
    // Klick außerhalb des Modals schließt es
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeCustomerModal();
        }
    });
    
    // Escape-Taste schließt Modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeCustomerModal();
        }
    });
    
    // Tab-Wechsel
    document.querySelectorAll('.modal-tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
    
    // Notiz speichern
    document.getElementById('save-note').addEventListener('click', saveNote);
    
    // Enter zum Speichern der Notiz (Shift+Enter für neue Zeile)
    document.getElementById('note-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            saveNote();
        }
    });
    
    // Kunden verschieben
    document.getElementById('move-customer').addEventListener('click', moveCustomer);
});

