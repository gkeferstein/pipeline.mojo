#!/usr/bin/env node
// Lösch-Skript für E-Mail-Adressen aus pipeline.mojo Container-Datenbank
// Löscht die angegebenen E-Mail-Adressen aus der customers Tabelle

import { execSync } from 'child_process';

const CONTAINER_NAME = 'mojo-pipeline-service';
const CONTAINER_DB_PATH = '/app/data/pipeline.db';

// E-Mail-Adressen die gelöscht werden sollen
const emailsToDelete = [
  'gerrit.keferstein@mojo-institut.de',
  'testy@dude.com',
  'leifpost@proton.me',
  'das@dasd.dede',
  'asd@dasd.asd',
  'Test@test.test'
];

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
        
        console.log('\n🗑️  Starte Löschvorgang...\n');
        
        // Erstelle Node.js-Skript für Löschvorgang (als Base64 kodiert für sichere Übertragung)
        const deleteScriptCode = `
const Database = require('better-sqlite3');
const db = new Database('${CONTAINER_DB_PATH}');
db.pragma('foreign_keys = ON');

const emailsToDelete = ${JSON.stringify(emailsToDelete)};

let deletedCount = 0;
let notFoundCount = 0;

const deleteTransaction = db.transaction((emails) => {
    for (const email of emails) {
        const customer = db.prepare('SELECT id, email FROM customers WHERE email = ?').get(email);
        
        if (customer) {
            const customerId = customer.id;
            const movementsDeleted = db.prepare('DELETE FROM movements WHERE customer_id = ?').run(customerId).changes;
            const customersDeleted = db.prepare('DELETE FROM customers WHERE id = ?').run(customerId).changes;
            
            if (customersDeleted > 0) {
                console.log('✅ Gelöscht: ' + email + ' (ID: ' + customerId + ', Movements: ' + movementsDeleted + ')');
                deletedCount++;
            } else {
                console.log('⚠️  Konnte nicht löschen: ' + email);
                notFoundCount++;
            }
        } else {
            console.log('ℹ️  Nicht gefunden: ' + email);
            notFoundCount++;
        }
    }
});

deleteTransaction(emailsToDelete);

console.log('\\n📊 Zusammenfassung:');
console.log('   ✅ Gelöscht: ' + deletedCount);
console.log('   ℹ️  Nicht gefunden: ' + notFoundCount);
console.log('   📧 Gesamt: ' + emailsToDelete.length);

db.close();
process.exit(deletedCount > 0 ? 0 : 1);
`.trim();

        // Schreibe Skript in temporäre Datei im Container und führe es aus
        const scriptBase64 = Buffer.from(deleteScriptCode).toString('base64');
        const result = executeInContainer(`sh -c "echo '${scriptBase64}' | base64 -d | node"`);
        console.log(result);
        
        console.log('\n✅ Löschvorgang abgeschlossen');
        process.exit(0);
        
    } catch (error) {
        console.error(`❌ Fehler beim Löschen: ${error.message}`);
        if (error.stdout) console.log('STDOUT:', error.stdout);
        if (error.stderr) console.error('STDERR:', error.stderr);
        process.exit(1);
    }
}

main();

