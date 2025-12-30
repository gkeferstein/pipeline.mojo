import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// Lade Umgebungsvariablen
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Verwende DATABASE_PATH aus Environment oder Fallback
const dbPath = process.env.DATABASE_PATH || join(__dirname, 'pipeline.db');
const db = new Database(dbPath);

// Aktiviere Foreign Key Constraints
db.pragma('foreign_keys = ON');

// Aktiviere WAL-Mode für bessere Performance und Sicherheit
db.pragma('journal_mode = WAL');

// Optimiere Datenbank-Performance
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = -64000'); // 64MB Cache

// Erstelle customers Tabelle
db.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    firstname TEXT,
    lastname TEXT,
    current_stage INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Erstelle movements Tabelle
db.exec(`
  CREATE TABLE IF NOT EXISTS movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    from_stage INTEGER,
    to_stage INTEGER NOT NULL,
    reason TEXT,
    source TEXT DEFAULT 'webhook',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  )
`);

// Erstelle notes Tabelle für manuelle Notizen
db.exec(`
  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  )
`);

// Erstelle daily_snapshots Tabelle für tägliche Kundenanzahl-Snapshots
db.exec(`
  CREATE TABLE IF NOT EXISTS daily_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date DATE UNIQUE NOT NULL,
    stage_1_count INTEGER NOT NULL DEFAULT 0,
    stage_2_count INTEGER NOT NULL DEFAULT 0,
    stage_3_count INTEGER NOT NULL DEFAULT 0,
    stage_4_count INTEGER NOT NULL DEFAULT 0,
    stage_5_count INTEGER NOT NULL DEFAULT 0,
    stage_6_count INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Migriere bestehende movements Tabelle (füge neue Spalten hinzu wenn sie fehlen)
try {
  db.exec(`ALTER TABLE movements ADD COLUMN reason TEXT`);
  console.log('✅ Movements Tabelle migriert: reason Spalte hinzugefügt');
} catch (e) {
  // Spalte existiert bereits
}

try {
  db.exec(`ALTER TABLE movements ADD COLUMN source TEXT DEFAULT 'webhook'`);
  console.log('✅ Movements Tabelle migriert: source Spalte hinzugefügt');
} catch (e) {
  // Spalte existiert bereits
}

// Migriere customers Tabelle (füge optionale Felder hinzu)
const customerFields = [
  'beruf', 'verhaeltnis', 'ziel',
  'utmsource', 'utmmedium', 'utmcampaign', 'utmterm', 'utmcontent',
  'fbclid', 'utmid'
];

customerFields.forEach(field => {
  try {
    db.exec(`ALTER TABLE customers ADD COLUMN ${field} TEXT`);
    console.log(`✅ Customers Tabelle migriert: ${field} Spalte hinzugefügt`);
  } catch (e) {
    // Spalte existiert bereits
  }
});

// Erstelle Index für bessere Performance
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
  CREATE INDEX IF NOT EXISTS idx_customers_stage ON customers(current_stage);
  CREATE INDEX IF NOT EXISTS idx_movements_customer ON movements(customer_id);
  CREATE INDEX IF NOT EXISTS idx_notes_customer ON notes(customer_id);
  CREATE INDEX IF NOT EXISTS idx_daily_snapshots_date ON daily_snapshots(date);
`);

console.log('✅ Datenbank initialisiert:', dbPath);

export default db;

