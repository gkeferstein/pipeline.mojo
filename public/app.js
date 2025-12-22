// API Base URL
const API_BASE = '/api';

// Funnel-Stufen Namen
const STAGE_NAMES = {
    1: 'Lead',
    2: 'Meeting vereinbart',
    3: 'Follow Up',
    4: 'Kaufentscheidung',
    5: 'Kauf'
};

// Konversionsraten pro Stufe
const CONVERSION_RATES = {
    1: 0.01,  // Lead: 1%
    2: 0.10,  // Meeting vereinbart: 10%
    3: 0.20,  // Follow Up: 20%
    4: 0.50,  // Kaufentscheidung: 50%
    5: 1.00   // Kauf: 100%
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
    for (let i = 1; i <= 5; i++) {
        const container = document.getElementById(`stage-${i}`);
        container.innerHTML = '';
        document.getElementById(`count-${i}`).textContent = '0';
    }
    
    // Gruppiere Kunden nach Stufe
    const customersByStage = {
        1: [],
        2: [],
        3: [],
        4: [],
        5: []
    };
    
    customers.forEach(customer => {
        const stage = customer.current_stage;
        if (stage >= 1 && stage <= 5) {
            customersByStage[stage].push(customer);
        }
    });
    
    // Rendere Kunden in den Spalten
    for (let stage = 1; stage <= 5; stage++) {
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
    for (let stage = 1; stage <= 5; stage++) {
        const customerCount = customersByStage[stage].length;
        const expectedValue = calculateExpectedValue(stage, customerCount);
        const valueElement = document.getElementById(`expected-value-${stage}`);
        
        if (valueElement) {
            // Formatiere als Währung (deutsches Format)
            const formattedValue = new Intl.NumberFormat('de-DE', {
                style: 'currency',
                currency: 'EUR',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(expectedValue);
            
            valueElement.textContent = `Erwarteter Wert: ${formattedValue}`;
        }
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
    
    const name = document.createElement('div');
    name.className = 'customer-name';
    name.textContent = `${customer.firstname} ${customer.lastname}`;
    
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
    
    return card;
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
});

