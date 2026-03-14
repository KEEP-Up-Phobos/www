#!/usr/bin/env bash
# ============================================================
# KEEP-Up — backup-db.sh
# Dumps main databases (MariaDB & Postgres) to local backups/ folder.
# Rotates backups (keeps last 7 days).
# Usage: bash shell/backup-db.sh
# ============================================================

set -e
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="$(dirname "$0")/../backups/db"
ENV_FILE="$(dirname "$0")/../docker/.env"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()   { echo -e "${GREEN}[INFO] $1${NC}"; }
warn()  { echo -e "${YELLOW}[WARN] $1${NC}"; }
err()   { echo -e "${RED}[ERROR] $1${NC}"; }

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Load environment variables (for passwords)
if [ -f "$ENV_FILE" ]; then
    export $(grep -v '^#' "$ENV_FILE" | xargs)
else
    warn "Environment file not found at $ENV_FILE. Using defaults/empty env."
fi

# Default credentials if not in env
DB_USER=${DB_USER:-keepup}
DB_NAME=${DB_NAME:-keepup_db}
PG_USER=${PG_DB_USER:-keepup_user}
PG_DB=${PG_DB_NAME:-keepup_events}

# ── 1. Backup MariaDB (keepup_mariadb) ──────────────────────
MARIADB_FILE="$BACKUP_DIR/mariadb_dump_${TIMESTAMP}.sql.gz"
log "Backing up MariaDB (container: keepup_mariadb, db: $DB_NAME)..."

# Try using root with env var password, or fallback to user
if docker exec keepup_mariadb mysqldump -u root -p"${DB_PASSWORD}" "$DB_NAME" 2>/dev/null | gzip > "$MARIADB_FILE"; then
    log "✅ MariaDB backup success: $MARIADB_FILE"
elif docker exec keepup_mariadb mysqldump -u "$DB_USER" -p"${DB_PASSWORD}" "$DB_NAME" | gzip > "$MARIADB_FILE"; then
    log "✅ MariaDB backup success (as user $DB_USER): $MARIADB_FILE"
else
    err "❌ MariaDB backup failed!"
    rm -f "$MARIADB_FILE"
    # Don't exit, try Postgres
fi

# ── 2. Backup Postgres (docker-postgres-1) ──────────────────
POSTGRES_FILE="$BACKUP_DIR/postgres_dump_${TIMESTAMP}.sql.gz"
log "Backing up Postgres (container: docker-postgres-1, db: $PG_DB)..."

# Postgres uses PGPASSWORD env var
if docker exec -e PGPASSWORD="${PG_DB_PASSWORD}" docker-postgres-1 pg_dump -U "$PG_USER" "$PG_DB" | gzip > "$POSTGRES_FILE"; then
    log "✅ Postgres backup success: $POSTGRES_FILE"
else
    err "❌ Postgres backup failed!"
    rm -f "$POSTGRES_FILE"
fi

# ── 3. Rotate Backups (Keep 7 days) ─────────────────────────
log "Cleaning up old backups (keeping last 7 days)..."
find "$BACKUP_DIR" -name "mariadb_dump_*.sql.gz" -mtime +7 -delete
find "$BACKUP_DIR" -name "postgres_dump_*.sql.gz" -mtime +7 -delete

log "Backup process completed."
du -sh "$BACKUP_DIR"
