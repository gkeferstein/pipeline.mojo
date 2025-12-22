import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, 'pipeline.db');
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
    firstname TEXT NOT NULL,
    lastname TEXT NOT NULL,
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  )
`);

// Erstelle Index für bessere Performance
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
  CREATE INDEX IF NOT EXISTS idx_customers_stage ON customers(current_stage);
  CREATE INDEX IF NOT EXISTS idx_movements_customer ON movements(customer_id);
`);

console.log('✅ Datenbank initialisiert:', dbPath);

export default db;

