# Dockerfile für pipeline.mojo
# Node.js Alpine für kleine Container-Größe

FROM node:20-alpine

# Arbeitsverzeichnis
WORKDIR /app

# System-Abhängigkeiten für better-sqlite3
RUN apk add --no-cache python3 make g++

# package.json und package-lock.json kopieren
COPY package*.json ./

# Dependencies installieren
RUN npm ci --only=production && \
    npm cache clean --force

# App-Code kopieren
COPY --chown=node:node . .

# Daten-Verzeichnisse erstellen
RUN mkdir -p /app/data /app/backups /app/logs && \
    chown -R node:node /app

# Als Non-root User ausführen (node User ist bereits im Image vorhanden)
USER node

# Port exponieren
EXPOSE 46006

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:46006/health', (r) => {process.exit(r.statusCode < 500 ? 0 : 1)})"

# Start-Befehl
CMD ["node", "server.js"]

