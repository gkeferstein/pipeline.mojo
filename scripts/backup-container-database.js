#!/usr/bin/env node
// Backup-Skript für pipeline.mojo Container-Datenbank
// Erstellt Backup der Datenbank aus dem Docker-Container

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync, statSync, readdirSync, unlinkSync, writeFileSync } from 'fs';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { createReadStream, createWriteStream } from 'fs';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_DIR = join(__dirname, '..');

const CONTAINER_NAME = 'mojo-pipeline-service';
const CONTAINER_DB_PATH = '/app/data/pipeline.db';
const BACKUP_DIR = join(PROJECT_DIR, 'backups');
const RETENTION_DAYS = 30;
const HEARTBEAT_URL = 'https://uptime.betterstack.com/api/v1/heartbeat/ggS7szqbF5aWxoeMyMLyxj2U';

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

function checkContainerRunning() {
    try {
        const result = execSync(`docker ps --filter name=${CONTAINER_NAME} --format "{{.Names}}"`, { encoding: 'utf-8' }).trim();
        return result === CONTAINER_NAME;
    } catch (error) {
        return false;
    }
}

function executeInContainer(command) {
    try {
        const fullCommand = `docker exec ${CONTAINER_NAME} ${command}`;
        return execSync(fullCommand, { encoding: 'utf-8', stdio: 'pipe' });
    } catch (error) {
        throw new Error(`Fehler beim Ausführen im Container: ${error.message}`);
    }
}

function copyFromContainer(sourcePath, destPath) {
    try {
        execSync(`docker cp ${CONTAINER_NAME}:${sourcePath} ${destPath}`, { stdio: 'pipe' });
    } catch (error) {
        throw new Error(`Fehler beim Kopieren aus Container: ${error.message}`);
    }
}

async function sendHeartbeat() {
    try {
        console.log('📡 Sende Heartbeat an BetterStack...');
        const response = await fetch(HEARTBEAT_URL, { method: 'GET' });
        if (response.ok) {
            console.log(`✅ Heartbeat erfolgreich gesendet (HTTP ${response.status})`);
        } else {
            console.warn(`⚠️  Heartbeat-Antwort: HTTP ${response.status}`);
        }
    } catch (error) {
        console.error(`⚠️  Heartbeat fehlgeschlagen: ${error.message}`);
    }
}

async function main() {
    try {
        console.log('🔍 Prüfe Container-Status...');
        
        // Prüfe ob Container läuft
        if (!checkContainerRunning()) {
            console.error(`❌ Fehler: Container ${CONTAINER_NAME} läuft nicht`);
            process.exit(1);
        }
        console.log(`✅ Container ${CONTAINER_NAME} läuft`);
        
        // Prüfe ob Datenbank im Container existiert
        console.log('🔍 Prüfe Datenbank im Container...');
        try {
            executeInContainer(`test -f ${CONTAINER_DB_PATH}`);
        } catch (error) {
            console.error(`❌ Fehler: Datenbank nicht gefunden im Container: ${CONTAINER_DB_PATH}`);
            process.exit(1);
        }
        console.log(`✅ Datenbank gefunden: ${CONTAINER_DB_PATH}`);
        
        // Erstelle Backup-Verzeichnis falls nicht vorhanden
        if (!existsSync(BACKUP_DIR)) {
            mkdirSync(BACKUP_DIR, { recursive: true });
            console.log(`📁 Backup-Verzeichnis erstellt: ${BACKUP_DIR}`);
        }
        
        // Führe VACUUM im Container durch (WAL-Dateien committen)
        console.log('🔄 Führe VACUUM im Container durch...');
        try {
            executeInContainer(`node -e "const db = require('better-sqlite3')('${CONTAINER_DB_PATH}'); db.pragma('vacuum'); db.close();"`);
            console.log('✅ VACUUM abgeschlossen');
        } catch (error) {
            console.warn(`⚠️  VACUUM fehlgeschlagen, fahre fort: ${error.message}`);
        }
        
        // Generiere Backup-Dateiname mit Zeitstempel
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const backupFile = join(BACKUP_DIR, `pipeline_backup_${timestamp}.db`);
        const backupFileCompressed = `${backupFile}.gz`;
        
        // Kopiere Datenbank aus Container
        console.log(`💾 Kopiere Datenbank aus Container...`);
        copyFromContainer(CONTAINER_DB_PATH, backupFile);
        
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
        
        // Lösche alte Backups
        console.log(`🧹 Lösche Backups älter als ${RETENTION_DAYS} Tage...`);
        deleteOldBackups();
        
        // Sende Heartbeat an BetterStack
        await sendHeartbeat();
        
        console.log('✅ Backup-Prozess abgeschlossen');
        process.exit(0);
        
    } catch (error) {
        console.error(`❌ Fehler beim Backup: ${error.message}`);
        console.error(error.stack);
        process.exit(1);
    }
}

main();









