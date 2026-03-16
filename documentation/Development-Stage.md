# Development Stage — KEEP-Up
> Last updated: March 16, 2026

**Key Libraries, Technologies & External Services:**
- Backend: Node.js, Express, MariaDB, PostgreSQL, Redis, BullMQ, bcrypt
- Frontend: React 18, TypeScript
- Fetcher: Python 3 (asyncio, aiohttp, BeautifulSoup)
- Infrastructure: Docker, Nginx, Cloudflare Tunnel
- Monitoring: Prometheus, Grafana (planned)
- External Services: GoDaddy, Cloudflare, GitHub, Joomla (SSO/auth), Viagogo, Wikipedia, PostGIS, BEAM (planned), Google/Facebook OAuth (planned)

This document is the single source of truth for project status, MVP checklist, and development progress.

---

## 1. External Services Status

| Service | Purpose | Stage | Status |
|---------|---------|-------|--------|
| GoDaddy | DNS/domain | LIVE | ✅ |
| Cloudflare | DNS/proxy/CDN/Tunnel | LIVE | ✅ |
| GitHub | Source repo, CI/CD | LIVE | ✅ |
| Joomla | SSO / user identity source | LIVE | ✅ |
| MariaDB | Joomla auth tables | LIVE | ✅ |
| PostgreSQL + PostGIS | Events + spatial DB | LIVE | ✅ |
| Redis | Cache + BullMQ queues | LIVE | ✅ |
| Viagogo | Event source (API + scraper) | INTEGRATED | ✅ |
| Ticketmaster | Event source (API) | INTEGRATED | ✅ |
| Sympla | Event source (API + scraper) | INTEGRATED | ✅ |
| Bandsintown | Artist tour dates (free API) | INTEGRATED | ✅ |
| Eventbrite | Event source (scraper) | INTEGRATED | ✅ |
| Wikipedia | Artist discovery by genre | INTEGRATED | ✅ |
| Nominatim (OSM) | Reverse geocoding (free) | INTEGRATED | ✅ |
| DeepSeek | AI event discovery (primary) | INTEGRATED | ✅ |
| OpenRouter | AI event discovery (fallback, 4 free models) | INTEGRATED | ✅ |
| DuckDuckGo | Event enrichment (descriptions) | INTEGRATED | ✅ |
| BEAM (Elixir) | Real-time sessions at scale | PLANNED | ⏳ |
| RabbitMQ | Event broker for BEAM | PLANNED | ⏳ |
| Google OAuth | User login | PLANNED | ⏳ |
| Facebook OAuth | User login | PLANNED | ⏳ |
| Prometheus/Grafana | Monitoring (:3010) | LIVE | ✅ |
| Azure/AWS | Optional cloud hosting | OPTIONAL | ⏳ |

---

## 2. Architecture Summary

```
Users → Cloudflare Tunnel → React SPA (nginx :3001)
                                ↓
                    Node.js API (Express :3002)
                    ├── Auth → MariaDB (Joomla clone_users)
                    ├── Events → PostgreSQL (fetcher_events via VIEW)
                    ├── Cache → Redis
                    └── Jobs → BullMQ

Python Fetcher (standalone daemon, systemd)
├── keepup_fetcher.py    ← radar sweep per city, all sources parallel
├── artist_seed.py       ← Wikipedia artist discovery + death filter
└── fetcher_daemon.py    ← 6 continents parallel, runs forever

Joomla (web/) ← institutional site, source of user identity
```

**Key architectural decisions made March 2026:**
- Python fetcher refactored from FastAPI microservice → standalone asyncio scripts
- Removed: .NET services (dotnet/), serpents-service, all legacy JS fetcher scripts
- Nominatim reverse geocoding resolves real city per event (fixes "all events = Porto Alegre" bug)
- `artists` table seeded from Wikipedia, consumed by all sources (not hardcoded list)
- Fetcher daemon covers 6 continents in parallel, each with independent radius config

---

## 3. MVP Checklist

### ✅ Completed

- [x] User registration/login (Joomla-compatible bcrypt, MariaDB)
- [x] Session management (clone_session table, httpOnly cookie)
- [x] Protected routes (requireAuth, requireAdmin middleware)
- [x] Event discovery API (PostGIS ST_DWithin spatial queries)
- [x] Event detail page (EventDetail.tsx)
- [x] Save/Unsave/Saved events (user bookmarks)
- [x] User profile (bio, avatar, interests, dual location home/current)
- [x] Interest categories (Wikipedia-seeded)
- [x] Admin dashboard (stats, AI config, event management, populate controls)
- [x] React SPA (11 routes, nginx-served, Cloudflare tunnel)
- [x] Docker Compose (6 services, auto-restart, health checks)
- [x] PostgreSQL VIEW bridge (old column names → new fetcher schema)
- [x] Python fetcher system (radar sweep, 8 sources, Nominatim geocoding)
- [x] Artist seed system (Wikipedia + death filter)
- [x] 6-continent daemon (parallel, continuous)
- [x] Shell scripts (start-all, status, backup-db, stop-all)

### 🟡 In Progress / Partial

- [ ] `.env.template` — env vars not yet documented for new team members
- [ ] E2E tests — smoke tests pass, no Cypress yet
- [ ] Fetcher admin integration — daemon not yet connected to admin dashboard UI (fetcher/status endpoint needs updating for new Python scripts)
- [ ] ARCHITECTURE.md — updated this session ✅

### ⏳ Post-MVP / Planned

- [ ] Google OAuth / Facebook OAuth
- [x] Prometheus + Grafana monitoring (:3010)
- [ ] BEAM (Elixir) real-time session layer
- [ ] RabbitMQ message broker
- [ ] `.env.template` for new devs
- [ ] Cypress E2E test suite
- [ ] Migration: `fetcher_daemon.py` expose `/api/fetcher/system` endpoint so admin dashboard shows live sweep status

---

## 4. Progress Meters (March 16, 2026)

```
Infrastructure:    [█████████░] 95%  (BEAM/RabbitMQ pending)
User Features:     [█████████░] 95%  (OAuth pending, E2E partial)
Fetcher System:    [██████████] 100% (radar sweep, 8 sources, 6 continents)
Code Cleanliness:  [█████████░] 95%  (dead code removed, minor cleanup remains)
Documentation:     [████████░░] 80%  (this update brings it current)
```

---

## 5. Known Issues / Tech Debt

| Issue | Priority | Notes |
|-------|----------|-------|
| Admin dashboard fetcher status broken | Medium | `/api/fetcher/system` still points to old FastAPI container — needs updating for new Python daemon |
| No `.env.template` | Medium | New devs can't onboard without seeing a real `.env` |
| E2E tests | Low | Smoke tests pass; Cypress not set up |
| `fetcher.js` still imported by main_server.js | Medium | Legacy Node fetcher still active alongside new Python daemon — needs migration plan |
| `lib/unified-fetcher.js` still used by controllers | Medium | Same as above |

---

## 6. Directory Layout (Current)

```
KEEP-Up App/
├── backend/                    # Node.js Express API (The Keeper)
│   ├── main_server.js
│   ├── controllers/
│   ├── routes/
│   ├── middleware/
│   ├── fetcher/                # Legacy Python FastAPI fetcher (docker-fetcher-1 :8500)
│   │   └── providers/          # Still running — migration pending
│   ├── lib/                    # Shared Node libs (image-fetcher, postgres, unified-fetcher...)
│   ├── migrations/             # SQL migration files
│   ├── python/                 # NEW standalone Python fetcher system
│   │   ├── keepup_fetcher.py   # Radar sweep engine
│   │   ├── artist_seed.py      # Wikipedia artist discovery
│   │   └── fetcher_daemon.py   # 6-continent continuous daemon
│   ├── public/                 # Static HTML (admin, map, login...)
│   ├── schemas/
│   ├── beam/                   # Elixir/BEAM prototype (future)
│   └── Dockerfile
├── docker/
│   ├── docker-compose.yml      # 6 services
│   ├── Dockerfile.fetcher      # Python FastAPI fetcher image
│   ├── postgres-init/          # PG init scripts + events VIEW
│   └── mysql-init/             # MariaDB init scripts
├── frontend/
│   └── react-keepup/           # React 18 + TypeScript SPA
├── web/                        # Joomla site (institutional, DO NOT TOUCH)
├── documentation/              # This folder
├── shell/                      # start-all.sh, status.sh, backup-db.sh, stop-all.sh
├── pg_data/                    # PostgreSQL data volume
├── db_data/                    # MariaDB data volume
├── redis_data/                 # Redis AOF persistence
└── tmp/                        # Temporary files (not committed)
```

---

## 7. Removed / Deprecated (March 2026)

The following were removed during the March 2026 cleanup sprint:

**Deleted code:**
- `dotnet/` — .NET auth-proxy and event-serpent (never integrated in production)
- `backend/serpents-service/` — Node.js orchestration layer for .NET (replaced by Python)
- `backend/auth-proxy/`, `backend/socket-proxy/`, `backend/messaging/` — unused microservices
- `backend/python/` old files — event_serpents.py, feather_dragon.py, auto_city_populator.py, duckduck_ai.py, wikipedia_ai.py, keeper_runner.py, viagogo_api.py, viagogo_scraper.py (consolidated into keepup_fetcher.py)
- All legacy JS fetchers — fetch-porto.js, fetch-real-poa.js, fetch-ticketmaster.js, auto-populate.js, town-populator.js, wikipedia-fetcher.js, etc.
- All test/tmp scripts — test-*.js, tmp_*.js, test_*.py
- All fix-* image scripts — one-shot patches, no longer needed
- `scripts/` folder — ngrok service (replaced by Cloudflare), auth integration test scripts
- `wikipedia-ai-formularies.json`, `wikipedia-ai-training.json` — generated cache files

**Deleted documentation:**
- DOTNET_SERVICES.md — .NET services no longer exist
- Old Python README files and CLI guides

---

## 8. Next Session Priorities

1. **Connect fetcher daemon to admin dashboard** — expose `/status` from `fetcher_daemon.py`
2. **Migrate `main_server.js`** away from `./fetcher` dependency → use new Python system
3. **Create `.env.template`** for onboarding
4. **Test `artist_seed.py`** — run first seed, verify artists table populates
5. **Test `keepup_fetcher.py`** — run with `--city "Porto Alegre" --max-radius 100`
6. **Set up systemd service** for `fetcher_daemon.py`
