#!/bin/bash
# Backup-Skript für pipeline.mojo Container-Datenbank (Wrapper für Node.js-Skript)

PROJECT_DIR="/root/projects/pipeline.mojo"
SCRIPT_PATH="${PROJECT_DIR}/scripts/backup-container-database.js"

# Führe Node.js Backup-Skript aus
cd "$PROJECT_DIR"
node "$SCRIPT_PATH"
