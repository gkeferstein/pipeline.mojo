#!/usr/bin/env node
// Täglicher Snapshot-Skript für pipeline.mojo
// Erstellt einen täglichen Snapshot der Kundenanzahl pro Stufe

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import db from '../database.js';

// Lade Umgebungsvariablen
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Konversionsraten pro Stufe (muss mit server.js übereinstimmen)
const CONVERSION_RATES = {
  1: 0.01,  // Lead: 1%
  2: 0.10,  // Meeting vereinbart: 10%
  3: 0.20,  // Follow Up: 20%
  4: 0.50,  // Kaufentscheidung: 50%
  5: 0.75,  // Kauf: 75%
  6: 0.00   // Absage: 0%
};

// Basis-Produktpreis (muss mit server.js übereinstimmen)
const BASE_PRICE = 4000;

// Berechnet Werte aus Kundenanzahlen pro Stufe
function calculateValuesFromCounts(stageCounts) {
  let expectedValue = 0;
  let realizedValue = 0;
  
  // Erwarteter Wert: Summe für Stufen 1-4
  for (let stage = 1; stage <= 4; stage++) {
    const count = stageCounts[`stage_${stage}_count`] || 0;
    const rate = CONVERSION_RATES[stage] || 0;
    expectedValue += BASE_PRICE * rate * count;
  }
  
  // Realisierter Wert: Stufe 5 (Kauf)
  const stage5Count = stageCounts.stage_5_count || 0;
  const rate5 = CONVERSION_RATES[5] || 0;
  realizedValue = BASE_PRICE * rate5 * stage5Count;
  
  const totalValue = expectedValue + realizedValue;
  
  return {
    expectedValue,
    realizedValue,
    totalValue
  };
}

// Erstellt einen täglichen Snapshot der aktuellen Kundenanzahl pro Stufe
function createDailySnapshot() {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Prüfe ob Snapshot für heute bereits existiert
    const existing = db.prepare('SELECT id FROM daily_snapshots WHERE date = ?').get(today);
    if (existing) {
      console.log(`✅ Täglicher Snapshot für ${today} existiert bereits`);
      return;
    }
    
    // Zähle Kundenanzahl pro Stufe
    const stageCounts = {};
    for (let stage = 1; stage <= 6; stage++) {
      const count = db.prepare(`
        SELECT COUNT(*) as count 
        FROM customers 
        WHERE current_stage = ?
      `).get(stage);
      stageCounts[`stage_${stage}_count`] = count.count;
    }
    
    // Erstelle Snapshot
    db.prepare(`
      INSERT INTO daily_snapshots (
        date, stage_1_count, stage_2_count, stage_3_count, 
        stage_4_count, stage_5_count, stage_6_count, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      today,
      stageCounts.stage_1_count,
      stageCounts.stage_2_count,
      stageCounts.stage_3_count,
      stageCounts.stage_4_count,
      stageCounts.stage_5_count,
      stageCounts.stage_6_count
    );
    
    // Berechne Werte für Logging
    const values = calculateValuesFromCounts(stageCounts);
    
    console.log(`✅ Täglicher Snapshot für ${today} erstellt`);
    console.log(`   Kundenanzahl: Stufe 1: ${stageCounts.stage_1_count}, Stufe 2: ${stageCounts.stage_2_count}, Stufe 3: ${stageCounts.stage_3_count}, Stufe 4: ${stageCounts.stage_4_count}, Stufe 5: ${stageCounts.stage_5_count}, Stufe 6: ${stageCounts.stage_6_count}`);
    console.log(`   Gesamtwert: ${values.totalValue.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}`);
    process.exit(0);
  } catch (error) {
    console.error(`❌ Fehler beim Erstellen des täglichen Snapshots: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

createDailySnapshot();

