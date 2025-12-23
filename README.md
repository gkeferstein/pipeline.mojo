# pipeline.mojo

Funnel Pipeline One-Page Anwendung zur Visualisierung und Verwaltung von Kunden in einem 6-stufigen Funnel-Prozess.

## 🚀 Schnellstart

### Docker (Empfohlen)

```bash
cd /root/projects/pipeline.mojo

# Docker-Netzwerk erstellen (falls noch nicht vorhanden)
docker network create mojo-pipeline-network

# Container bauen und starten
docker compose up -d --build

# Logs anzeigen
docker compose logs -f

# Container stoppen
docker compose down
```

### Lokale Entwicklung (ohne Docker)

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

1. **Lead** (Stufe 1) - Konversionsrate: 1%
2. **Meeting vereinbart** (Stufe 2) - Konversionsrate: 10%
3. **Follow Up** (Stufe 3) - Konversionsrate: 20%
4. **Kaufentscheidung** (Stufe 4) - Konversionsrate: 50%
5. **Kauf** (Stufe 5) - Konversionsrate: 100%
6. **Absage** (Stufe 6) - Konversionsrate: 0%

## 🌐 Traefik-Routing

Das Projekt ist über Traefik erreichbar:

- **Frontend:** https://dev.pipeline.mojo-institut.de/
- **API:** https://dev.pipeline.mojo-institut.de/api/
- **Webhooks:** https://dev.pipeline.mojo-institut.de/webhook/
- **Health-Check:** https://dev.pipeline.mojo-institut.de/health

Traefik verwaltet SSL/TLS automatisch über Let's Encrypt. Das Routing erfolgt automatisch über Docker Labels (keine File Provider Konfiguration mehr nötig).

## 🔗 Webhook-Endpunkt

### POST /webhook

**Update-or-Create** - Einziger Webhook-Endpunkt für alle Operationen. Erstellt einen neuen Kunden oder aktualisiert einen bestehenden (E-Mail als unique ID).

**⚠️ Authentifizierung erforderlich:**
Der Webhook-Endpunkt erfordert einen API-Key zur Authentifizierung. Der API-Key kann auf zwei Arten übermittelt werden:

1. **HTTP Header:** `X-API-Key: <dein-api-key>`
2. **Query Parameter:** `?api_key=<dein-api-key>`

Der API-Key wird in der `.env` Datei als `WEBHOOK_API_KEY` gespeichert (Standard: `webhook-secret-key-change-in-production`).

**Vollständiger Request Body:**
```json
{
  "email": "max.mustermann@example.com",  // ERFORDERLICH - E-Mail-Adresse (unique ID)
  "firstname": "Max",                      // OPTIONAL - Vorname (erforderlich nur für neue Kunden)
  "lastname": "Mustermann",                // OPTIONAL - Nachname (erforderlich nur für neue Kunden)
  "stage": 2                               // OPTIONAL - Funnel-Stufe 1-6 (Standard: 1 für neue Kunden)
}
```

**Alle Felder im Detail:**
- `email` (string, **erforderlich**): E-Mail-Adresse des Kunden - dient als unique ID
- `firstname` (string, optional): Vorname - wird nur aktualisiert/gespeichert wenn angegeben und nicht leer
- `lastname` (string, optional): Nachname - wird nur aktualisiert/gespeichert wenn angegeben und nicht leer
- `stage` (integer 1-6, optional): Funnel-Stufe - wird nur aktualisiert wenn angegeben
  - `1` = Lead
  - `2` = Meeting vereinbart
  - `3` = Follow Up
  - `4` = Kaufentscheidung
  - `5` = Kauf
  - `6` = Absage

**Verhalten:**

#### Wenn Kunde existiert (Update):
- **E-Mail:** Identifiziert den Kunden (erforderlich)
- **firstname/lastname:** Werden nur aktualisiert wenn angegeben und nicht leer (leere Felder überschreiben nicht)
- **stage:** Wird aktualisiert wenn angegeben, Bewegung wird nur geloggt wenn sich die Stufe ändert
- **Response:** `action: "updated"`

#### Wenn Kunde nicht existiert (Create):
- **E-Mail:** Erforderlich (unique ID) - **einziges erforderliches Feld**
- **firstname:** Optional - wird gespeichert wenn angegeben, sonst `null`
- **lastname:** Optional - wird gespeichert wenn angegeben, sonst `null`
- **stage:** Optional (Standard: 1 wenn nicht angegeben)
- **Response:** `action: "created"` (HTTP 201)

**Beispiele:**

**Neuen Kunden erstellen:**
```bash
curl -X POST https://dev.pipeline.mojo-institut.de/webhook \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dein-api-key-hier" \
  -d '{
    "email": "max.mustermann@example.com",
    "firstname": "Max",
    "lastname": "Mustermann",
    "stage": 1
  }'
```

**Nur Stufe aktualisieren:**
```bash
curl -X POST https://dev.pipeline.mojo-institut.de/webhook \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dein-api-key-hier" \
  -d '{
    "email": "max.mustermann@example.com",
    "stage": 2
  }'
```

**Absage erteilen (Stage 6):**
```bash
curl -X POST https://dev.pipeline.mojo-institut.de/webhook \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dein-api-key-hier" \
  -d '{
    "email": "max.mustermann@example.com",
    "stage": 6
  }'
```

**Alternative mit Query-Parameter:**
```bash
curl -X POST "https://dev.pipeline.mojo-institut.de/webhook?api_key=dein-api-key-hier" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "max.mustermann@example.com",
    "stage": 2
  }'
```

**Namen aktualisieren (Stufe bleibt unverändert):**
```bash
curl -X POST https://dev.pipeline.mojo-institut.de/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "email": "max.mustermann@example.com",
    "firstname": "Maximilian",
    "lastname": "Mustermann"
  }'
```

**Response (Update):**
```json
{
  "success": true,
  "message": "Kunde aktualisiert",
  "customer": { ... },
  "action": "updated"
}
```

**Response (Create):**
```json
{
  "success": true,
  "message": "Kunde erfolgreich erstellt",
  "customer": { ... },
  "action": "created"
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

**Backup manuell ausführen (im Container):**
```bash
docker exec mojo-pipeline-service node /app/scripts/backup-database.js
```

**Backup-Logs anzeigen:**
```bash
docker compose logs pipeline-service | grep -i backup
```

**Volume-Inhalt prüfen:**
```bash
# Datenbank-Volume
docker volume inspect pipeline-data

# Backup-Volume
docker volume inspect pipeline-backups
```

## 🔐 Authentifizierung

### Frontend-Login
Das Frontend ist durch eine PIN-Authentifizierung geschützt:
- **PIN-Code:** Wird in `.env` als `PIN_CODE` gespeichert (Standard: `1234`)
- **Session-Gültigkeit:** 168 Stunden (7 Tage)
- **Login-Seite:** `/login`

### Webhook-Authentifizierung
Webhook-Endpunkte erfordern einen API-Key:
- **Umgebungsvariable:** `WEBHOOK_API_KEY` in `.env`
- **Standard-Wert:** `webhook-secret-key-change-in-production` (sollte in Produktion geändert werden)
- **Übermittlung:** Via HTTP Header `X-API-Key` oder Query-Parameter `api_key`

## 🎨 Frontend

Das Frontend ist eine One-Page-Anwendung mit:
- 6 Spalten (eine pro Funnel-Stufe, inkl. Absage)
- Kunden-Karten mit Vorname, Nachname und E-Mail
- Tage-Counter (zeigt an, wie lange ein Kunde bereits in der aktuellen Stufe ist)
- Erwartete Werte pro Stufe (Produktpreis × Konversionsrate × Anzahl Kunden)
- Auto-Refresh alle 5 Sekunden
- Responsive Design
- PIN-Authentifizierung

## 📝 Dokumentation

- Port-Konfiguration: [docs/PORT.md](docs/PORT.md)
- CI/CD Pipeline: [.github/workflows/ci-cd.yml](.github/workflows/ci-cd.yml)

## 🐳 Docker-Container

### Container-Verwaltung

**Container starten:**
```bash
docker compose up -d
```

**Container stoppen:**
```bash
docker compose down
```

**Container neu bauen:**
```bash
docker compose build --no-cache
docker compose up -d
```

**Logs anzeigen:**
```bash
docker compose logs -f pipeline-service
```

**In Container einloggen:**
```bash
docker exec -it mojo-pipeline-service sh
```

**Health-Check prüfen:**
```bash
docker exec mojo-pipeline-service node -e "require('http').get('http://localhost:46006/health', (r) => {let d='';r.on('data',c=>d+=c);r.on('end',()=>{console.log(r.statusCode,d);process.exit(r.statusCode===200?0:1)})})"
```

### Traefik-Integration

Der Container wird automatisch von Traefik über Docker Labels erkannt:
- **Network:** `mojo-pipeline-network` (external)
- **Service-Port:** 46006 (nur intern, nicht exponiert)
- **Domain:** `dev.pipeline.mojo-institut.de`
- **TLS:** Automatisch über Let's Encrypt

## 🔄 Deployment

Das Projekt wird automatisch über GitHub Actions deployed, wenn Code nach `main` oder `develop` gepusht wird.

**Docker-Deployment:**
1. Code wird auf Server gepusht
2. `docker compose build` baut neuen Container
3. `docker compose up -d` startet Container
4. Traefik erkennt Container automatisch über Docker Labels
