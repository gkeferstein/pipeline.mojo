import express from 'express';
import cors from 'cors';
import session from 'express-session';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import db from './database.js';

// Lade Umgebungsvariablen aus .env
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 46006;

// Session-Konfiguration (168 Stunden = 7 Tage)
app.use(session({
  secret: process.env.SESSION_SECRET || 'pipeline-mojo-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // true in Production mit HTTPS
    httpOnly: true,
    maxAge: 168 * 60 * 60 * 1000 // 168 Stunden = 7 Tage
  }
}));

// Middleware
app.use(cors());
app.use(express.json());

// Auth Middleware - prüft ob Benutzer eingeloggt ist
function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) {
    return next();
  }
  
  // Wenn AJAX-Request, JSON-Response zurückgeben
  if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
    return res.status(401).json({ 
      success: false, 
      error: 'Nicht authentifiziert',
      redirect: '/login'
    });
  }
  
  // Ansonsten Redirect zu Login
  res.redirect('/login');
}

// Webhook Auth Middleware - prüft API-Key
function requireWebhookAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  const validApiKey = process.env.WEBHOOK_API_KEY || 'webhook-secret-key-change-in-production';
  
  if (apiKey === validApiKey) {
    return next();
  }
  
  return res.status(401).json({
    success: false,
    error: 'Ungültiger oder fehlender API-Key',
    hint: 'Bitte X-API-Key Header oder api_key Query-Parameter angeben'
  });
}

// Statische Dateien aus public Verzeichnis (außer login.html - wird über Route serviert)
app.use(express.static(join(__dirname, 'public'), {
  index: false // Verhindere, dass index.html automatisch serviert wird
}));

// Login-Seite (öffentlich)
app.get('/login', (req, res) => {
  // Wenn bereits eingeloggt, weiterleiten
  if (req.session && req.session.authenticated) {
    return res.redirect('/');
  }
  res.sendFile(join(__dirname, 'public', 'login.html'));
});

// Login-Verarbeitung
app.post('/login', (req, res) => {
  const { pin } = req.body;
  const correctPin = process.env.PIN_CODE || '1234';
  
  if (pin === correctPin) {
    req.session.authenticated = true;
    req.session.loginTime = new Date().toISOString();
    
    // JSON Response für AJAX-Requests
    if (req.xhr || req.headers.accept?.indexOf('json') > -1 || req.headers['content-type']?.includes('application/json')) {
      return res.json({ 
        success: true, 
        message: 'Erfolgreich eingeloggt',
        redirect: '/'
      });
    }
    
    // Normaler Redirect
    return res.redirect('/');
  } else {
    // JSON Response für AJAX-Requests
    if (req.xhr || req.headers.accept?.indexOf('json') > -1 || req.headers['content-type']?.includes('application/json')) {
      return res.status(401).json({ 
        success: false, 
        error: 'Ungültiger PIN-Code' 
      });
    }
    
    // Redirect zurück zu Login mit Fehler
    return res.redirect('/login?error=invalid');
  }
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Fehler beim Löschen der Session:', err);
    }
    res.redirect('/login');
  });
});

app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Fehler beim Löschen der Session:', err);
      return res.status(500).json({ success: false, error: 'Logout fehlgeschlagen' });
    }
    res.json({ success: true, message: 'Erfolgreich ausgeloggt' });
  });
});

// API: Alle Kunden abrufen (geschützt)
app.get('/api/customers', requireAuth, (req, res) => {
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

// Webhook: Update-or-Create (einziger Webhook-Endpunkt)
app.post('/webhook', requireWebhookAuth, (req, res) => {
  try {
    const { email, firstname, lastname, stage } = req.body;
    
    // Validierung: E-Mail ist immer erforderlich
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        error: 'email ist erforderlich' 
      });
    }
    
    // Validierung: Stage muss zwischen 1-6 sein wenn angegeben
    if (stage !== undefined && (stage < 1 || stage > 6)) {
      return res.status(400).json({ 
        success: false, 
        error: 'stage muss zwischen 1 und 6 liegen' 
      });
    }
    
    // Prüfe ob Kunde bereits existiert
    const existing = db.prepare('SELECT * FROM customers WHERE email = ?').get(email);
    
    if (existing) {
      // UPDATE: Kunde existiert bereits
      const updates = [];
      const params = [];
      
      // Update firstname nur wenn angegeben und nicht leer
      if (firstname !== undefined && firstname !== null && firstname.trim() !== '') {
        updates.push('firstname = ?');
        params.push(firstname.trim());
      }
      
      // Update lastname nur wenn angegeben und nicht leer
      if (lastname !== undefined && lastname !== null && lastname.trim() !== '') {
        updates.push('lastname = ?');
        params.push(lastname.trim());
      }
      
      // Update stage nur wenn angegeben
      let stageChanged = false;
      let oldStage = existing.current_stage;
      if (stage !== undefined) {
        if (oldStage !== stage) {
          updates.push('current_stage = ?');
          params.push(stage);
          stageChanged = true;
        }
      }
      
      // Nur updaten wenn es Änderungen gibt
      if (updates.length > 0) {
        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(existing.id);
        
        const updateQuery = `UPDATE customers SET ${updates.join(', ')} WHERE id = ?`;
        db.prepare(updateQuery).run(...params);
        
        // Logge Bewegung nur wenn stage geändert wurde
        if (stageChanged) {
          db.prepare(`
            INSERT INTO movements (customer_id, from_stage, to_stage, created_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
          `).run(existing.id, oldStage, stage);
        }
      }
      
      // Aktualisierten Kunden abrufen
      const updatedCustomer = db.prepare('SELECT * FROM customers WHERE id = ?').get(existing.id);
      
      return res.json({ 
        success: true, 
        message: 'Kunde aktualisiert',
        customer: updatedCustomer,
        action: 'updated'
      });
    } else {
      // CREATE: Kunde existiert nicht
      // firstname und lastname sind optional (nur email ist erforderlich)
      const targetStage = stage || 1; // Default: Stufe 1 (Lead)
      
      // Normalisiere firstname und lastname (leere Strings werden zu null)
      const firstnameValue = (firstname && firstname.trim() !== '') ? firstname.trim() : null;
      const lastnameValue = (lastname && lastname.trim() !== '') ? lastname.trim() : null;
      
      // Kunde erstellen
      const result = db.prepare(`
        INSERT INTO customers (email, firstname, lastname, current_stage, created_at, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(email, firstnameValue, lastnameValue, targetStage);
      
      const customerId = result.lastInsertRowid;
      
      // Bewegung loggen (von null zu initialer Stufe)
      db.prepare(`
        INSERT INTO movements (customer_id, from_stage, to_stage, created_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `).run(customerId, null, targetStage);
      
      const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
      
      return res.status(201).json({ 
        success: true, 
        message: 'Kunde erfolgreich erstellt',
        customer,
        action: 'created'
      });
    }
  } catch (error) {
    console.error('Fehler im Webhook:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Legacy Endpoints (deprecated - Redirect zu /webhook)
app.post('/webhook/create', (req, res) => {
  res.status(410).json({ 
    success: false, 
    error: 'Dieser Endpunkt ist veraltet. Verwende POST /webhook',
    migration: 'POST /webhook'
  });
});

app.post('/webhook/move', (req, res) => {
  res.status(410).json({ 
    success: false, 
    error: 'Dieser Endpunkt ist veraltet. Verwende POST /webhook',
    migration: 'POST /webhook'
  });
});

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Root Route - Frontend (geschützt)
app.get('/', requireAuth, (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 pipeline.mojo läuft auf Port ${PORT}`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`🌐 Öffentlich: http://116.203.109.90/pipeline.mojo/`);
});
