#!/usr/bin/env bash
# ============================================================
# KEEP-Up — status.sh
# Shows the health of every service at a glance.
# Usage: bash shell/status.sh
# ============================================================

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'

row() {
  local name="$1" port="$2"
  local running health icon

  running=$(docker inspect -f '{{.State.Running}}' "$name" 2>/dev/null || echo "false")
  if [[ "$running" != "true" ]]; then
    printf "  ${RED}❌ %-28s  stopped${NC}\n" "$name"
    return
  fi

  health=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-hc{{end}}' "$name" 2>/dev/null || echo "unknown")
  case "$health" in
    healthy)   icon="${GREEN}✅${NC}" ;;
    no-hc)     icon="${GREEN}🟢${NC}" ;;
    starting)  icon="${YELLOW}🔄${NC}" ;;
    *)         icon="${YELLOW}⚠️ ${NC}" ;;
  esac

  printf "  %b %-28s  running" "$icon" "$name"
  [[ -n "$port" ]] && printf "  → %-20s" "$port"
  echo ""
}

echo ""
echo -e "${CYAN}══════════════════════════════════════════════════${NC}"
echo -e "${CYAN}           KEEP-Up Service Status${NC}"
echo -e "${CYAN}══════════════════════════════════════════════════${NC}"

echo ""
echo "  Databases"
row docker-mariadb-1   "localhost:3307 (keepup_db)"
row docker-postgres-1  "localhost:5432 (keepup_events)"

echo ""
echo "  Cache & Workers"
row keepup_redis      "localhost:6379"
row docker-fetcher-1  "localhost:8500 (FastAPI)"

echo ""
echo "  Application"
row keepup_backend    "localhost:3002 (Node API)"
row keepup_frontend   "localhost:3001 (React/nginx)"

echo ""
echo "  Cloudflare Tunnel"
if systemctl is-active --quiet cloudflared 2>/dev/null; then
  echo -e "  ${GREEN}✅ cloudflared (systemd)${NC}              running  → app.keepup.lat → :3001"
else
  echo -e "  ${RED}❌ cloudflared (systemd)${NC}              stopped"
fi

echo ""
echo -e "${CYAN}══════════════════════════════════════════════════${NC}"

# Endpoint smoke tests
if command -v curl &>/dev/null; then
  echo ""
  echo "  Smoke Tests"

  # Node health
  NODE_RESP=$(curl -sf http://localhost:3002/health 2>/dev/null)
  if [[ $? -eq 0 ]]; then
    NODE_DB=$(echo "$NODE_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); s=d.get('services',{}); print('pg=' + s.get('postgres','?') + ' maria=' + s.get('mariadb','?') + ' redis=' + s.get('redis','?'))" 2>/dev/null || echo "ok")
    echo -e "  ${GREEN}✅${NC} Node /health                         OK  ($NODE_DB)"
  else
    echo -e "  ${RED}❌${NC} Node /health                         FAILED"
  fi

  # Fetcher health
  if curl -sf http://localhost:8500/health -o /dev/null 2>/dev/null; then
    FETCH_INFO=$(curl -s http://localhost:8500/api/fetcher/system 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(str(d.get('db',{}).get('events',0)) + ' events, ' + str(d.get('db',{}).get('cities',0)) + ' cities')" 2>/dev/null || echo "ok")
    echo -e "  ${GREEN}✅${NC} Fetcher /health                      OK  ($FETCH_INFO)"
  else
    echo -e "  ${RED}❌${NC} Fetcher /health                      FAILED"
  fi

  # Frontend via nginx
  if curl -sf http://localhost:3001 -o /dev/null 2>/dev/null; then
    echo -e "  ${GREEN}✅${NC} Frontend localhost:3001              OK"
  else
    echo -e "  ${RED}❌${NC} Frontend localhost:3001              FAILED"
  fi

  # Admin events API (through nginx → node → postgres)
  EVENTS_RESP=$(curl -s http://localhost:3001/api/admin/events 2>/dev/null)
  EVENTS_ERR=$(echo "$EVENTS_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('error',''))" 2>/dev/null || echo "parse_error")
  if [[ "$EVENTS_ERR" == "Authentication required. Please log in." ]]; then
    echo -e "  ${GREEN}✅${NC} Admin /api/admin/events              OK  (auth required — expected)"
  elif echo "$EVENTS_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['ok']==True" 2>/dev/null; then
    ECOUNT=$(echo "$EVENTS_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('count',0))" 2>/dev/null)
    echo -e "  ${GREEN}✅${NC} Admin /api/admin/events              OK  ($ECOUNT events)"
  else
    echo -e "  ${RED}❌${NC} Admin /api/admin/events              FAILED  ($EVENTS_ERR)"
  fi

  # Fetcher via nginx proxy
  FETCHER_PROXY=$(curl -s http://localhost:3001/api/fetcher/system 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(str(d.get('db',{}).get('events',0)))" 2>/dev/null || echo "error")
  if [[ "$FETCHER_PROXY" != "error" && "$FETCHER_PROXY" != "0" ]]; then
    echo -e "  ${GREEN}✅${NC} Nginx → Fetcher proxy               OK  ($FETCHER_PROXY events)"
  else
    echo -e "  ${RED}❌${NC} Nginx → Fetcher proxy               FAILED"
  fi

  echo ""
fi
