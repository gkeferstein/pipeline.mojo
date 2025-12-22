import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import db from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 46006;

// Middleware
app.use(cors());
app.use(express.json());

// Statische Dateien aus public Verzeichnis
app.use(express.static(join(__dirname, 'public')));

// API: Alle Kunden abrufen
app.get('/api/customers', (req, res) => {
  try {
    const customers = db.prepare(`
      SELECT id, email, firstname, lastname, current_stage, created_at, updated_at
      FROM customers
      ORDER BY updated_at DESC
    `).all();
    
    res.json({ success: true, customers });
  } catch (error) {
    console.error('Fehler beim Abrufen der Kunden:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Webhook: Neuen Kunden erstellen
app.post('/webhook/create', (req, res) => {
  try {
    const { email, firstname, lastname, stage } = req.body;
    
    // Validierung
    if (!email || !firstname || !lastname) {
      return res.status(400).json({ 
        success: false, 
        error: 'email, firstname und lastname sind erforderlich' 
      });
    }
    
    const targetStage = stage || 1; // Default: Stufe 1 (Lead)
    
    if (targetStage < 1 || targetStage > 5) {
      return res.status(400).json({ 
        success: false, 
        error: 'stage muss zwischen 1 und 5 liegen' 
      });
    }
    
    // Prüfe ob Kunde bereits existiert
    const existing = db.prepare('SELECT id, current_stage FROM customers WHERE email = ?').get(email);
    
    if (existing) {
      return res.status(409).json({ 
        success: false, 
        error: 'Kunde mit dieser E-Mail existiert bereits',
        customer: existing
      });
    }
    
    // Kunde erstellen
    const result = db.prepare(`
      INSERT INTO customers (email, firstname, lastname, current_stage, created_at, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(email, firstname, lastname, targetStage);
    
    const customerId = result.lastInsertRowid;
    
    // Bewegung loggen (von null zu initialer Stufe)
    db.prepare(`
      INSERT INTO movements (customer_id, from_stage, to_stage, created_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `).run(customerId, null, targetStage);
    
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
    
    res.status(201).json({ 
      success: true, 
      message: 'Kunde erfolgreich erstellt',
      customer 
    });
  } catch (error) {
    console.error('Fehler beim Erstellen des Kunden:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Webhook: Kunde in neue Stufe bewegen
app.post('/webhook/move', (req, res) => {
  try {
    const { email, stage } = req.body;
    
    // Validierung
    if (!email || !stage) {
      return res.status(400).json({ 
        success: false, 
        error: 'email und stage sind erforderlich' 
      });
    }
    
    if (stage < 1 || stage > 5) {
      return res.status(400).json({ 
        success: false, 
        error: 'stage muss zwischen 1 und 5 liegen' 
      });
    }
    
    // Kunde finden
    const customer = db.prepare('SELECT * FROM customers WHERE email = ?').get(email);
    
    if (!customer) {
      return res.status(404).json({ 
        success: false, 
        error: 'Kunde mit dieser E-Mail nicht gefunden' 
      });
    }
    
    const fromStage = customer.current_stage;
    
    // Wenn bereits in dieser Stufe, keine Änderung
    if (fromStage === stage) {
      return res.json({ 
        success: true, 
        message: 'Kunde ist bereits in dieser Stufe',
        customer 
      });
    }
    
    // Stufe aktualisieren
    db.prepare(`
      UPDATE customers 
      SET current_stage = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(stage, customer.id);
    
    // Bewegung loggen
    db.prepare(`
      INSERT INTO movements (customer_id, from_stage, to_stage, created_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `).run(customer.id, fromStage, stage);
    
    // Aktualisierten Kunden abrufen
    const updatedCustomer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customer.id);
    
    res.json({ 
      success: true, 
      message: `Kunde von Stufe ${fromStage} zu Stufe ${stage} bewegt`,
      customer: updatedCustomer 
    });
  } catch (error) {
    console.error('Fehler beim Bewegen des Kunden:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Root Route - leite zu Frontend weiter
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 pipeline.mojo läuft auf Port ${PORT}`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`🌐 Öffentlich: http://116.203.109.90/pipeline.mojo/`);
});
