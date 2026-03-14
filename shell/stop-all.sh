#!/usr/bin/env bash
# ============================================================
# KEEP-Up — stop-all.sh
# Stops ALL services in reverse dependency order (safe).
# Usage: bash shell/stop-all.sh
# ============================================================

set -euo pipefail
COMPOSE_FILE="$(dirname "$0")/../docker/docker-compose.yml"
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

ok()   { echo -e "${GREEN}✅ $*${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $*${NC}"; }
err()  { echo -e "${RED}❌ $*${NC}"; }

stop_service() {
  local service="$1" container="$2"
  local running
  running=$(docker inspect -f '{{.State.Running}}' "$container" 2>/dev/null | tr -d '[:space:]' || echo "false")
  if [[ "$running" == "true" ]]; then
    echo "   Stopping $container..."
    docker compose -f "$COMPOSE_FILE" stop -t 10 "$service" > /dev/null 2>&1
    ok "$container stopped"
  else
    ok "$container already stopped"
  fi
}

# ── STEP 1: Frontend (tier 4) ────────────────────────────────
echo ""
echo "🚪 Frontend (tier 4)"
stop_service frontend keepup_frontend

# ── STEP 2: Node API (tier 3) ────────────────────────────────
echo ""
echo "🗝️  Node API (tier 3)"
stop_service node keepup_backend

# ── STEP 3: Joomla CMS (tier 2) ──────────────────────────────
echo ""
echo "🌐 Joomla CMS (tier 2)"
stop_service joomla keepup_joomla

# ── STEP 4: Python Fetcher (tier 2) ──────────────────────────
echo ""
echo "🐍 Python Fetcher (tier 2)"
stop_service fetcher docker-fetcher-1

# ── STEP 5: Cache (tier 2) ───────────────────────────────────
echo ""
echo "⚡ Cache (tier 2)"
stop_service redis keepup_redis

# ── STEP 6: Databases (tier 1) ───────────────────────────────
echo ""
echo "🏛️  Databases (tier 1)"
stop_service postgres docker-postgres-1
stop_service mariadb docker-mariadb-1

# ── Done ─────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════"
echo "        KEEP-Up — All services stopped"
echo "══════════════════════════════════════════"
echo ""