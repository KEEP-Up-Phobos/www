#!/usr/bin/env bash
# ============================================================
# KEEP-Up — start-all.sh
# Starts ALL services in the correct dependency order.
# Safe to run on an already-running system (skips healthy ones).
# Usage: bash shell/start-all.sh
# ============================================================

set -euo pipefail
COMPOSE_FILE="$(dirname "$0")/../docker/docker-compose.yml"
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

ok()   { echo -e "${GREEN}✅ $*${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $*${NC}"; }
err()  { echo -e "${RED}❌ $*${NC}"; }

# ── helpers ──────────────────────────────────────────────────
container_running() { docker inspect -f '{{.State.Running}}' "$1" 2>/dev/null | tr -d '[:space:]' | grep -q "true"; }

wait_healthy() {
  local name="$1"
  local i=0
  echo -ne "   Waiting for $name to be healthy... 0s"
  # Give Docker a moment to register the container before polling
  sleep 3
  while true; do
    local status
    status=$(docker inspect -f '{{.State.Health.Status}}' "$name" 2>/dev/null | tr -d '[:space:]' || echo "none")
    if [[ "$status" == "healthy" ]]; then
      echo -e "\r   $name healthy after ${i}s ✅                         "
      return 0
    fi
    if [[ "$status" == "unhealthy" ]]; then
      echo -e "\r   ⚠️  $name unhealthy after ${i}s — check logs          "
      return 1
    fi
    if [[ "$status" == "none" ]]; then
      # No healthcheck defined — wait until running for at least 5s
      local running
      running=$(docker inspect -f '{{.State.Running}}' "$name" 2>/dev/null | tr -d '[:space:]' || echo "false")
      if [[ "$running" == "true" && $i -ge 5 ]]; then
        echo -e "\r   $name up after ${i}s ✅                             "
        return 0
      fi
    fi
    sleep 1
    i=$((i + 1))
    echo -ne "\r   Waiting for $name to be healthy... ${i}s"
  done
}

ensure_compose_started() {
  local service="$1" container="$2"
  if container_running "$container"; then
    ok "$container already running"
  else
    echo "   Starting $service via compose..."
    docker compose -f "$COMPOSE_FILE" up -d "$service" > /dev/null 2>&1
    wait_healthy "$container"
    ok "$container started"
  fi
}

# ── check Cloudflare tunnel ───────────────────────────────────
echo ""
echo "🌐 Cloudflare Tunnel"
if systemctl is-active --quiet cloudflared 2>/dev/null; then
  ok "cloudflared (systemd) running"
else
  warn "cloudflared not running — starting..."
  sudo systemctl start cloudflared && ok "cloudflared started" || err "cloudflared failed to start"
fi

# ── STEP 1: Databases ────────────────────────────────────────
echo ""
echo "🏛️  Databases (tier 1)"
ensure_compose_started mariadb docker-mariadb-1
ensure_compose_started postgres docker-postgres-1

# ── STEP 2: Cache ────────────────────────────────────────────
echo ""
echo "⚡ Cache (tier 2)"
ensure_compose_started redis keepup_redis

# ── STEP 3: Joomla CMS ──────────────────────────────────────
echo ""
echo "🌐 Joomla CMS (tier 2)"
ensure_compose_started joomla keepup_joomla

# ── STEP 4: Python Fetcher ───────────────────────────────────
echo ""
echo "🐍 Python Fetcher (tier 2)"
ensure_compose_started fetcher docker-fetcher-1

# ── STEP 5: Node API ─────────────────────────────────────────
echo ""
echo "🗝️  Node API (tier 3)"
ensure_compose_started node keepup_backend

# ── STEP 6: Frontend ─────────────────────────────────────────
echo ""
echo "🚪 Frontend (tier 4)"
ensure_compose_started frontend keepup_frontend

# Re-apply nginx config
NGINX_CONF="$(dirname "$0")/../frontend/react-keepup/nginx/default.conf"
if [[ -f "$NGINX_CONF" ]]; then
  docker cp "$NGINX_CONF" keepup_frontend:/etc/nginx/conf.d/default.conf > /dev/null 2>&1 || true
  docker exec keepup_frontend nginx -s reload > /dev/null 2>&1 || true
  ok "nginx config applied (fetcher proxy active)"
fi

# ── STEP 6: Summary ──────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════"
echo "           KEEP-Up Status Summary"
echo "══════════════════════════════════════════"
bash "$(dirname "$0")/status.sh"