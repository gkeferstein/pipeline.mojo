# pipeline.mojo

Funnel Pipeline One-Page Anwendung zur Visualisierung und Verwaltung von Kunden in einem 5-stufigen Funnel-Prozess.

## 🚀 Schnellstart

```bash
cd /root/projects/pipeline.mojo
npm install
npm start
```

## 🔌 Port-Konfiguration

Siehe [docs/PORT.md](docs/PORT.md) für Details.

- **Port:** 46006
- **Domain:** https://dev.pipeline.mojo-institut.de (Traefik mit SSL)
- **Legacy URL:** http://116.203.109.90/pipeline.mojo/

## 📊 Funnel-Stufen

1. **Lead** (Stufe 1)
2. **Meeting vereinbart** (Stufe 2)
3. **Follow Up** (Stufe 3)
4. **Kaufentscheidung** (Stufe 4)
5. **Kauf** (Stufe 5)

## 🌐 Traefik-Routing

Das Projekt ist über Traefik erreichbar:

- **Frontend:** https://dev.pipeline.mojo-institut.de/
- **API:** https://dev.pipeline.mojo-institut.de/api/
- **Webhooks:** https://dev.pipeline.mojo-institut.de/webhook/
- **Health-Check:** https://dev.pipeline.mojo-institut.de/health

Traefik verwaltet SSL/TLS automatisch über Let's Encrypt. Die Routing-Konfiguration liegt serverseitig in `/root/infrastructure/traefik/config/pipeline-routers.yml`.

## 🔗 Webhook-Endpunkte

### POST /webhook/create

Erstellt einen neuen Kunden in der Pipeline.

**Request Body:**
```json
{
  "email": "max.mustermann@example.com",
  "firstname": "Max",
  "lastname": "Mustermann",
  "stage": 1
}
```

**Parameter:**
- `email` (erforderlich) - E-Mail-Adresse des Kunden
- `firstname` (erforderlich) - Vorname
- `lastname` (erforderlich) - Nachname
- `stage` (optional) - Funnel-Stufe (1-5), Standard: 1

**Response:**
```json
{
  "success": true,
  "message": "Kunde erfolgreich erstellt",
  "customer": { ... }
}
```

### POST /webhook/move

Bewegt einen Kunden in eine neue Funnel-Stufe.

**Request Body:**
```json
{
  "email": "max.mustermann@example.com",
  "stage": 2
}
```

**Parameter:**
- `email` (erforderlich) - E-Mail-Adresse des Kunden
- `stage` (erforderlich) - Neue Funnel-Stufe (1-5)

**Response:**
```json
{
  "success": true,
  "message": "Kunde von Stufe 1 zu Stufe 2 bewegt",
  "customer": { ... }
}
```

## 📡 API-Endpunkte

### GET /api/customers

Liefert alle Kunden mit ihrer aktuellen Stufe.

**Response:**
```json
{
  "success": true,
  "customers": [
    {
      "id": 1,
      "email": "max.mustermann@example.com",
      "firstname": "Max",
      "lastname": "Mustermann",
      "current_stage": 2,
      "created_at": "2025-12-22T12:00:00.000Z",
      "updated_at": "2025-12-22T12:30:00.000Z"
    }
  ]
}
```

## 💾 Datenbank

Die Anwendung verwendet SQLite zur Speicherung der Daten:

- **Tabelle `customers`**: Speichert Kunden mit aktueller Stufe
- **Tabelle `movements`**: Loggt alle Bewegungen zwischen Stufen

Die Datenbankdatei wird automatisch beim ersten Start erstellt: `pipeline.db`

### Datenbank-Optimierungen

Die Datenbank ist für Performance und Sicherheit optimiert:
- **Foreign Key Constraints** aktiviert
- **WAL-Mode** (Write-Ahead Logging) für bessere Performance
- **Optimierte Synchronisation** und Cache-Einstellungen
- **Indizes** auf häufig abgefragten Spalten (email, current_stage, customer_id)

### Automatische Backups

Das System führt täglich um 3:00 Uhr automatische Backups durch:

- **Backup-Verzeichnis:** `backups/`
- **Backup-Format:** Gzip-komprimierte SQLite-Dateien
- **Retention:** Backups werden 30 Tage aufbewahrt
- **Heartbeat:** Bei erfolgreichem Backup wird ein Heartbeat an BetterStack gesendet

**Backup manuell ausführen:**
```bash
cd /root/projects/pipeline.mojo
node scripts/backup-database.js
```

**Backup-Logs:**
```bash
tail -f /root/projects/pipeline.mojo/logs/backup.log
```

## 🎨 Frontend

Das Frontend ist eine One-Page-Anwendung mit:
- 5 Spalten (eine pro Funnel-Stufe)
- Kunden-Karten mit Vorname, Nachname und E-Mail
- Auto-Refresh alle 5 Sekunden
- Responsive Design

## 📝 Dokumentation

- Port-Konfiguration: [docs/PORT.md](docs/PORT.md)
- CI/CD Pipeline: [.github/workflows/ci-cd.yml](.github/workflows/ci-cd.yml)

## 🔄 Deployment

Das Projekt wird automatisch über GitHub Actions deployed, wenn Code nach `main` oder `develop` gepusht wird.
