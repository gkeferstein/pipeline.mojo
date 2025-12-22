# Port-Konfiguration

**Projekt:** pipeline.mojo  
**Port:** 46006  
**Domain:** https://dev.pipeline.mojo-institut.de (Traefik)  
**URL (alt):** http://116.203.109.90/pipeline.mojo/  
**Status:** ⚠️ Muss gestartet werden

## Service-Details

| Service | Port | Typ | Beschreibung |
|---------|------|-----|-------------|
| **Frontend** | 46006 | Node/Docker | Hauptanwendung |
| **Backend** | 46007 | Node/Docker | API Server (optional) |

## Lokaler Zugriff

```bash
# Frontend
curl http://localhost:46006/

# Backend (falls vorhanden)
curl http://localhost:46007/api/
```

## Öffentlicher Zugriff

- **Frontend:** https://dev.pipeline.mojo-institut.de/ (Traefik mit SSL)
- **API:** https://dev.pipeline.mojo-institut.de/api/
- **Webhooks:** https://dev.pipeline.mojo-institut.de/webhook/
- **Health-Check:** https://dev.pipeline.mojo-institut.de/health
- **Legacy (alt):** http://116.203.109.90/pipeline.mojo/

## Start-Befehle

```bash
# Projekt starten
cd /root/projects/pipeline.mojo
npm start  # oder docker-compose up -d

# Status prüfen
curl http://localhost:46006/health
```

## Traefik-Routing

**WICHTIG:** Dieses Projekt verwendet **Traefik** für Routing (nicht nginx direkt).

- Traefik läuft serverseitig als separater Container
- Routing wird serverseitig in `/root/infrastructure/traefik/config/pipeline-routers.yml` konfiguriert
- SSL-Zertifikate werden automatisch von Traefik verwaltet (Let's Encrypt)
- Keine Ports werden exponiert (Traefik routet über Host-Netzwerk auf Port 46006)

### Routing-Struktur

- `dev.pipeline.mojo-institut.de/health` → Health-Check (priority: 25)
- `dev.pipeline.mojo-institut.de/api/*` → API-Endpunkte (priority: 25)
- `dev.pipeline.mojo-institut.de/webhook/*` → Webhook-Endpunkte (priority: 25)
- `dev.pipeline.mojo-institut.de/*` → Frontend (priority: 1, catch-all)

**Zuletzt aktualisiert:** 2025-12-22
