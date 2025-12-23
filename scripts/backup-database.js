#!/usr/bin/env node
// Backup-Skript für pipeline.mojo Datenbank
// Führt Backup durch und sendet bei Erfolg Heartbeat an BetterStack

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync, copyFileSync, statSync, readdirSync, unlinkSync } from 'fs';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import Database from 'better-sqlite3';
import { createReadStream, createWriteStream } from 'fs';

import dotenv from 'dotenv';

// Lade Umgebungsvariablen
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_DIR = join(__dirname, '..');

// Verwende Environment-Variablen oder Fallback zu lokalen Pfaden
const DB_FILE = process.env.DATABASE_PATH || join(PROJECT_DIR, 'pipeline.db');
const BACKUP_DIR = process.env.BACKUP_DIR || join(PROJECT_DIR, 'backups');
const HEARTBEAT_URL = 'https://uptime.betterstack.com/api/v1/heartbeat/ggS7szqbF5aWxoeMyMLyxj2U';
const RETENTION_DAYS = 30;

async function compressFile(inputPath, outputPath) {
    const readStream = createReadStream(inputPath);
    const writeStream = createWriteStream(outputPath);
    const gzipStream = createGzip();
    
    await pipeline(readStream, gzipStream, writeStream);
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function deleteOldBackups() {
    const now = Date.now();
    const retentionMs = RETENTION_DAYS * 24 * 60 * 60 * 1000;
    
    try {
        const files = readdirSync(BACKUP_DIR);
        let deletedCount = 0;
        
        for (const file of files) {
            if (file.startsWith('pipeline_backup_') && (file.endsWith('.db') || file.endsWith('.db.gz'))) {
                const filePath = join(BACKUP_DIR, file);
                const stats = statSync(filePath);
                const age = now - stats.mtimeMs;
                
                if (age > retentionMs) {
                    unlinkSync(filePath);
                    deletedCount++;
                    console.log(`🗑️  Gelöscht: ${file} (${Math.floor(age / (24 * 60 * 60 * 1000))} Tage alt)`);
                }
            }
        }
        
        if (deletedCount > 0) {
            console.log(`✅ ${deletedCount} alte Backup(s) gelöscht`);
        } else {
            console.log(`✅ Keine alten Backups zum Löschen gefunden`);
        }
    } catch (error) {
        console.error(`⚠️  Fehler beim Löschen alter Backups: ${error.message}`);
    }
}

async function sendHeartbeat() {
    try {
        const response = await fetch(HEARTBEAT_URL, {
            method: 'GET',
            headers: {
                'User-Agent': 'pipeline.mojo-backup/1.0'
            }
        });
        
        if (response.ok) {
            console.log(`✅ Heartbeat erfolgreich gesendet (HTTP ${response.status})`);
            return true;
        } else {
            console.log(`⚠️  Heartbeat konnte nicht gesendet werden (HTTP ${response.status})`);
            return false;
        }
    } catch (error) {
        console.error(`⚠️  Fehler beim Senden des Heartbeats: ${error.message}`);
        return false;
    }
}

async function main() {
    try {
        // Erstelle Backup-Verzeichnis falls nicht vorhanden
        if (!existsSync(BACKUP_DIR)) {
            mkdirSync(BACKUP_DIR, { recursive: true });
        }
        
        // Prüfe ob Datenbank existiert
        if (!existsSync(DB_FILE)) {
            console.error(`❌ Fehler: Datenbankdatei nicht gefunden: ${DB_FILE}`);
            process.exit(1);
        }
        
        // Öffne Datenbank und führe VACUUM durch
        console.log('🔄 Führe VACUUM durch...');
        const db = new Database(DB_FILE, { readonly: false });
        db.pragma('vacuum');
        db.close();
        console.log('✅ VACUUM abgeschlossen');
        
        // Generiere Backup-Dateiname mit Zeitstempel
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const backupFile = join(BACKUP_DIR, `pipeline_backup_${timestamp}.db`);
        const backupFileCompressed = `${backupFile}.gz`;
        
        // Erstelle Backup
        console.log(`💾 Erstelle Backup: ${backupFile}`);
        copyFileSync(DB_FILE, backupFile);
        
        const originalSize = statSync(backupFile).size;
        console.log(`📦 Original-Größe: ${formatFileSize(originalSize)}`);
        
        // Komprimiere Backup
        console.log('📦 Komprimiere Backup...');
        await compressFile(backupFile, backupFileCompressed);
        
        // Lösche unkomprimierte Datei
        unlinkSync(backupFile);
        
        const compressedSize = statSync(backupFileCompressed).size;
        const compressionRatio = ((1 - compressedSize / originalSize) * 100).toFixed(1);
        console.log(`✅ Backup erfolgreich erstellt: ${backupFileCompressed}`);
        console.log(`   Komprimiert: ${formatFileSize(compressedSize)} (${compressionRatio}% kleiner)`);
        
        // Sende Heartbeat an BetterStack
        console.log('📡 Sende Heartbeat an BetterStack...');
        await sendHeartbeat();
        
        // Lösche alte Backups
        console.log(`🧹 Lösche Backups älter als ${RETENTION_DAYS} Tage...`);
        deleteOldBackups();
        
        console.log('✅ Backup-Prozess abgeschlossen');
        process.exit(0);
        
    } catch (error) {
        console.error(`❌ Fehler beim Backup: ${error.message}`);
        console.error(error.stack);
        process.exit(1);
    }
}

main();

