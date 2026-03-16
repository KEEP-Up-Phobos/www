# ⚔️ The KEEP-Up Realm — Architecture Codex

> *"In the land of events and gatherings, great powers hold domain..."*

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║     ████████╗██╗  ██╗███████╗    ██╗  ██╗███████╗███████╗██████╗             ║
║     ╚══██╔══╝██║  ██║██╔════╝    ██║ ██╔╝██╔════╝██╔════╝██╔══██╗            ║
║        ██║   ███████║█████╗      █████╔╝ █████╗  █████╗  ██████╔╝            ║
║        ██║   ██╔══██║██╔══╝      ██╔═██╗ ██╔══╝  ██╔══╝  ██╔═══╝             ║
║        ██║   ██║  ██║███████╗    ██║  ██╗███████╗███████╗██║                 ║
║        ╚═╝   ╚═╝  ╚═╝╚══════╝    ╚═╝  ╚═╝╚══════╝╚══════╝╚═╝                 ║
║                                                                               ║
║                       🏰 REALM ARCHITECTURE CODEX 🏰                          ║
║              Codex Version 9.0 — The Unified Fetcher Edition                  ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

---

## 🗺️ The Realm Overview

### Key Libraries, Technologies & External Services
- **Backend:** Node.js, Express, MariaDB, PostgreSQL, Redis, BullMQ, bcrypt
- **Frontend:** React 18, TypeScript
- **Fetcher:** Python 3 (asyncio, aiohttp, BeautifulSoup)
- **Infrastructure:** Docker, Nginx, Cloudflare Tunnel
- **Monitoring:** Prometheus, Grafana (:3010)
- **External Services:** GoDaddy, Cloudflare, GitHub, Joomla (SSO), Viagogo, Ticketmaster, Sympla, Bandsintown, Eventbrite, Wikipedia, Nominatim, DeepSeek, OpenRouter, DuckDuckGo, PostGIS, BEAM (planned), RabbitMQ (planned), Google/Facebook OAuth (planned)

### Architecture in one diagram

```
                          ┌─────────────────────┐
                          │    👤 THE PEOPLE     │
                          │   (Users/Visitors)   │
                          └──────────┬───────────┘
                                     │
                          ☁️ Cloudflare Argo Tunnel
                          (systemd: cloudflared)
                          app.keepup.lat → :3001
                                     │
                                     ▼
╔══════════════════════════════════════════════════════════════════════════╗
║   🚪 THE PASSAGE — React 18 + TypeScript                                ║
║   nginx:alpine  |  keepup_frontend (:3001)                              ║
║   /frontend/react-keepup/                                               ║
╚═══════════════════════╤══════════════════════════════════════════════════╝
           /api/fetcher/ │  /api/*  /health
        ┌────────────────┴────────────────┐
        ▼                                 ▼
╔══════════════════════╗     ╔══════════════════════════════╗
║  🐉 THE DRAGON        ║     ║  🗝️ THE KEEPER               ║
║  Python FastAPI       ║     ║  Node.js + Express           ║
║  docker-fetcher-1     ║     ║  keepup_backend (:3002)      ║
║  (:8500) [LEGACY]     ║     ║                              ║
║                       ║     ║  Auth (Joomla compat)        ║
║  ⚠️ Migration pending ║     ║  Events CRUD                 ║
║  New Python daemon    ║     ║  User Profiles               ║
║  runs standalone      ║     ║  Interests                   ║
║  via systemd          ║     ║  Admin Dashboard             ║
╚══════════╤═══════════╝     ╚═══════════╤══════════════════╝
           │                              │
           └──────────┬───────────────────┘
                      ▼
╔══════════════════════════════════════╗  ╔════════════════════╗
║  🏛️ THE VAULT — PostgreSQL 16        ║  ║  📜 THE SCROLL      ║
║  + PostGIS spatial engine            ║  ║  MariaDB 11         ║
║  docker-postgres-1 (:5432)           ║  ║  docker-mariadb-1   ║
║  keepup_events database              ║  ║  (:3307)            ║
╚══════════════════════════════════════╝  ║  keepup_db          ║
                                          ║  Joomla users       ║
╔══════════════════════════════════════╗  ╚════════════════════╝
║  ⚡ THE CACHE — Redis 7-alpine       ║
║  keepup_redis (:6379)                ║
║  AOF persistence: /redis_data/       ║
╚══════════════════════════════════════╝

╔══════════════════════════════════════════════════════════════╗
║  🌍 THE NEW FETCHER DAEMON (standalone, systemd)             ║
║  backend/python/                                             ║
║                                                              ║
║  fetcher_daemon.py ──► 6 continents in parallel              ║
║      └── keepup_fetcher.py (per city radar sweep)            ║
║              ├── Ticketmaster API                            ║
║              ├── Sympla API + scraper                        ║
║              ├── Bandsintown API (artists from DB)           ║
║              ├── Viagogo API + scraper                       ║
║              ├── Eventbrite scraper                          ║
║              ├── AI (DeepSeek + OpenRouter 4 free models)    ║
║              └── Nominatim reverse geocode (real city/event) ║
║                                                              ║
║  artist_seed.py ──► Wikipedia genre discovery                ║
║      └── Populates `artists` table (death filter via Wikidata)║
╚══════════════════════════════════════════════════════════════╝
```

---

## 📊 Project Status (March 16, 2026)

```
ARCHITECTURE COMPLETION: [█████████░] 95%

Core Systems:
  ✅ React Frontend (React 18 + TS)        [██████████] 100%
  ✅ Node.js Backend (Express)             [██████████] 100%
  ✅ Python Fetcher (new unified daemon)   [██████████] 100%
  ✅ PostgreSQL + PostGIS                  [██████████] 100%
  ✅ MariaDB (Joomla Auth)                 [██████████] 100%
  ✅ Docker Compose (6 services)           [██████████] 100%
  ✅ Cloudflare Tunnel                     [██████████] 100%
  ✅ Redis Cache                           [██████████] 100%
  ✅ Shell Scripts                         [██████████] 100%
  ✅ Code cleanup (March 2026)             [██████████] 100%
  🟡 Admin ↔ Fetcher integration           [████░░░░░░]  40% (daemon not yet wired to dashboard)
  🟡 E2E Tests                             [██░░░░░░░░]  20%
  🟡 OAuth (Google/Facebook)               [░░░░░░░░░░]   0%
  ✅ Prometheus/Grafana (:3010)             [██████████] 100%
  🟡 BEAM / RabbitMQ                       [░░░░░░░░░░]   0%
```

---

## 🏗️ Infrastructure (Docker Compose)

**Compose File:** `docker/docker-compose.yml`
**Network:** `docker_default` bridge (172.19.0.0/16)
**External Tunnel:** Cloudflare Argo Tunnel → `app.keepup.lat` → `localhost:3001`

| Service | Image | Container | Port | Purpose |
|---------|-------|-----------|------|---------|
| 🏛️ The Vault | postgis/postgis:16-3.4-alpine | docker-postgres-1 | 5432 | Events + PostGIS |
| 📜 The Scroll | mariadb:11 | docker-mariadb-1 | 3307 | Joomla auth tables |
| 🐉 The Dragon | custom Dockerfile.fetcher | docker-fetcher-1 | 8500 | Legacy Python FastAPI fetcher |
| ⚡ The Cache | redis:7-alpine | keepup_redis | 6379 | Cache + BullMQ |
| 🗝️ The Keeper | custom backend/Dockerfile | keepup_backend | 3002 | Express API |
| 🚪 The Passage | nginx:alpine | keepup_frontend | 3001 | React SPA + reverse proxy |

> ⚠️ **docker-fetcher-1 is legacy.** The new Python daemon (`fetcher_daemon.py`) runs as a systemd service, not inside Docker. Migration of the admin dashboard integration is pending.

---

## 🌍 THE NEW FETCHER SYSTEM (Python standalone)

> *"Where the old Dragon swept one city at a time, the new system sweeps six continents simultaneously."*

**Location:** `backend/python/`
**Runtime:** Python 3 + asyncio + aiohttp (not FastAPI, not Docker)
**Execution:** systemd service (fetcher_daemon.py)

### Three Files

#### `keepup_fetcher.py` — Radar Sweep Engine
- Geocodes starting city via Nominatim
- Expands radially: 50km → 100km → 150km → ... → `max_radius`
- Each ring fires all sources in parallel via `asyncio.gather`
- Each event's real city resolved via Nominatim reverse geocoding (fixes the "all events = starting city" bug from the old system)
- Enrich via DuckDuckGo Instant Answer API (always on)
- Saves to `fetcher_cities` + `fetcher_events` + `fetcher_venues`

```bash
python keepup_fetcher.py --city "Porto Alegre"
python keepup_fetcher.py --city "São Paulo" --step 100 --max-radius 500
python keepup_fetcher.py --city "Paris" --sources ticketmaster bandsintown ai
```

**Sources:**
| Source | Type | Key Required |
|--------|------|-------------|
| ticketmaster | REST API | TICKETMASTER_API_KEY |
| sympla_api | REST API | SYMPLA_APP_TOKEN |
| sympla_scraper | HTML scraper | none |
| bandsintown | REST API | none (uses artists table) |
| viagogo_api | OAuth2 API | VIAGOGO_CLIENT_ID + SECRET |
| viagogo_scraper | HTML scraper | none |
| eventbrite | HTML scraper + JSON-LD | none |
| ai | DeepSeek + OpenRouter | DEEPSEEK_API_KEY / OPENROUTER_API_KEY |

#### `artist_seed.py` — Wikipedia Artist Discovery
- Fetches artist names from Wikipedia category members by genre
- Checks death date via Wikidata API (P570 property)
- Marks dead artists as `is_active = false` — excluded from Bandsintown scraping
- Creates `artists` table if it doesn't exist
- All sources (not just Bandsintown) consume from this table

```bash
python artist_seed.py                        # seed all genres
python artist_seed.py --genre Rock Jazz MPB  # specific genres
python artist_seed.py --check-deaths         # re-check existing artists
```

**Genres seeded:** Rock, Pop, Jazz, Electronic, Hip Hop, Classical, R&B, Metal, Folk, Punk, Soul, Indie, Alternative, Funk, Country, Reggae, Sertanejo, Pagode, MPB, Bossa nova, Forró, Axé, Baile funk, Salsa, Reggaeton, Bachata, Cumbia, Tango, K-pop, J-pop, J-rock, Afrobeats

#### `fetcher_daemon.py` — 6-Continent Parallel Daemon
- Launches 6 parallel `asyncio` sweeps, one per continent
- Each starts at continent's geographic center and sweeps to its border
- Runs continuously — after all 6 complete, sleeps 1h then restarts
- 2GB RAM budget across all 6 processes

```bash
python fetcher_daemon.py                           # all 6 continents
python fetcher_daemon.py --once                    # one cycle then exit
python fetcher_daemon.py --continents south_america europe
python fetcher_daemon.py --list                    # show config
```

**Continent config:**
| Continent | Center City | Max Radius | Step |
|-----------|-------------|------------|------|
| south_america | Cuiabá | 4,500 km | 100 km |
| north_america | Kansas City | 5,500 km | 150 km |
| europe | Prague | 3,500 km | 100 km |
| africa | Bangui | 5,000 km | 200 km |
| asia | Novosibirsk | 6,000 km | 200 km |
| oceania | Alice Springs | 4,000 km | 150 km |

### Database Tables Used by Fetcher

| Table | Purpose |
|-------|---------|
| `artists` | Artist names from Wikipedia (created by artist_seed.py) |
| `fetcher_cities` | City registry with sweep state (radius, status, last_sweep_at) |
| `fetcher_events` | All harvested events |
| `fetcher_venues` | Venue details |

---

## 🚪 THE PASSAGE (React Frontend)

**Technology:** React 18 + TypeScript
**Container:** `keepup_frontend` (nginx:alpine on `:3001`)
**Location:** `/frontend/react-keepup/`

### Routes

| Route | Page | Access |
|-------|------|--------|
| `/` | Landing (login) | Public |
| `/events` | EventGrid | Protected |
| `/map` | EventMap | Protected |
| `/profile` | Profile | Protected |
| `/profile/edit` | EditProfile | Protected |
| `/create` | CreateEvent | requireCreateEvent |
| `/admin` | EnhancedAdminDashboard | requireAdmin |
| `/choose-destination` | ChooseDestination | requireAdmin |
| `/unauthorized` | Access Denied | Public |

---

## 🗝️ THE KEEPER (Node.js Backend)

**Technology:** Node.js + Express
**Container:** `keepup_backend` (:3002)
**Entry:** `backend/main_server.js`
**Connects to:** PostgreSQL, MariaDB, Redis

### Endpoints Summary

**Auth** (8 routes — inline in main_server.js)
`/api/auth/check`, `/login`, `/logout`, `/validate-session`, `/joomla-session`, `/register`, `/user`

**Events** (15 routes — events.routes.js)
`/api/events/discover`, `/search`, `/nearby`, `/save`, `/unsave`, `/saved`, `/is-saved`, `/create`, `/populate-town`, `/viagogo-search`, `/:id`, etc.

**Profile** (7 routes — user.routes.js)
`/api/profile/get`, `/profile/:userId`, `/profile/save`, `/location/current`, `/map/checkpoints`, etc.

**Interests** (6 routes — interests.routes.js)
`/api/interests/categories`, `/category/:id`, `/user/:userId`, `/match/:userId`, etc.

**Admin** (36 routes — admin.routes.js, all requireAdmin)
Includes: stats, AI config, event management, populate controls, cache, fetcher status, user management, node/react refresh.

---

## 🏛️ THE VAULT (PostgreSQL 16 + PostGIS)

**Container:** `docker-postgres-1` (:5432)
**Database:** `keepup_events`

### Tables

| Table | Purpose |
|-------|---------|
| `fetcher_events` | All harvested events |
| `fetcher_cities` | City catalogue + sweep state |
| `fetcher_venues` | Venue details |
| `fetcher_jobs` | Fetcher job tracking |
| `fetcher_logs` | Fetcher audit log |
| `artists` | Artist names from Wikipedia (new) |
| `saved_events` | User ↔ event bookmarks |
| `user_profiles` | Extended user profiles |
| `user_interests` | User interest selections |
| `populate_jobs` | Node-side populate tracking |

### The Compatibility VIEW (`events`)

The `events` VIEW bridges old Node.js column names to the new `fetcher_*` schema:

| VIEW Column | Source |
|-------------|--------|
| `event_name` | fetcher_events.name |
| `event_date` | fetcher_events.start_date |
| `venue_latitude` | fetcher_events.latitude |
| `venue_longitude` | fetcher_events.longitude |
| `venue_city` | fetcher_cities.name (JOIN) |
| `venue_country` | fetcher_cities.country (JOIN) |
| `geom` | ST_SetSRID(ST_MakePoint(lon, lat), 4326) |

---

## 📜 THE SCROLL (MariaDB 11)

**Container:** `docker-mariadb-1` (:3307)
**Database:** `keepup_db`

| Table | Purpose |
|-------|---------|
| `clone_users` | User credentials (Joomla-compatible bcrypt) |
| `clone_session` | Active sessions |
| `clone_usergroups` | Group definitions (RBAC) |
| `clone_user_usergroup_map` | User ↔ group assignments |

> Joomla (`web/`) is the institutional site AND the source of truth for user identity. Registrations via React go directly into these tables.

---

## 🔐 Authentication Flow

1. User submits login → `POST /api/auth/login`
2. Node checks `clone_users` in MariaDB (Joomla bcrypt)
3. Session inserted into `clone_session`, httpOnly cookie set
4. `requireAuth` validates session on every protected route
5. `requireAdmin` extends requireAuth, checks `clone_user_usergroup_map`
6. Frontend stores `KEEPUP_BEARER_TOKEN` as fallback for cross-port requests

---

## 🚪➡️🗝️ Nginx Reverse Proxy

**Config:** `frontend/react-keepup/nginx/default.conf`

| Location | Upstream | Notes |
|----------|----------|-------|
| `/` | Static files | React SPA, try_files fallback |
| `/api/fetcher/` | `http://fetcher:8500/` | Legacy — X-API-Key injected server-side |
| `/api/` | `http://node:3002/api/` | WebSocket upgrade support |
| `/health` | `http://node:3002/health` | Health check |

---

## 🏪 THE MARKET (.env Configuration)

**Main:** `docker/.env` (docker-compose)
**Backend:** `backend/.env` (dotenv in main_server.js + Python scripts)

| Category | Variable | Purpose |
|----------|----------|---------|
| Database | `PG_DB_*` | PostgreSQL connection |
| Database | `MARIADB_PASSWORD` | MariaDB app user |
| Security | `ADMIN_API_KEY` | Inter-service API key |
| Event APIs | `TICKETMASTER_API_KEY` | Ticketmaster |
| Event APIs | `SYMPLA_APP_TOKEN` | Sympla |
| Event APIs | `VIAGOGO_CLIENT_ID/SECRET` | Viagogo OAuth2 |
| AI | `DEEPSEEK_API_KEY` | DeepSeek direct |
| AI | `OPENROUTER_API_KEY` | OpenRouter (4 free models) |

---

## ⚔️ Summoning Commands

```bash
# Start all services
cd /media/phobos/KEEP-Up\ App && bash shell/start-all.sh

# Check health
bash shell/status.sh

# Docker
cd docker && docker compose up -d
docker compose logs -f fetcher

# Python fetcher (test run)
cd backend/python
python keepup_fetcher.py --city "Porto Alegre" --max-radius 100

# Seed artists (run once before first fetch)
python artist_seed.py --genre Rock MPB Sertanejo

# Start continent daemon
python fetcher_daemon.py --once   # test one cycle
python fetcher_daemon.py          # continuous
```

---

## 🗂️ Directory Layout

```
KEEP-Up App/
├── backend/                        # 🗝️ THE KEEPER — Node.js Express API
│   ├── main_server.js
│   ├── controllers/
│   ├── routes/
│   ├── middleware/
│   ├── lib/                        # Shared libs (image-fetcher, postgres, unified-fetcher)
│   ├── migrations/                 # SQL migrations
│   ├── fetcher/                    # 🐉 Legacy Python FastAPI (docker-fetcher-1, migration pending)
│   │   └── providers/
│   ├── python/                     # 🌍 NEW unified fetcher system
│   │   ├── keepup_fetcher.py       # Radar sweep engine
│   │   ├── artist_seed.py          # Wikipedia artist discovery
│   │   └── fetcher_daemon.py       # 6-continent daemon
│   ├── public/                     # Static HTML (admin, map, login...)
│   ├── schemas/
│   ├── beam/                       # Elixir/BEAM prototype (future)
│   ├── Dockerfile
│   └── .env
├── docker/
│   ├── docker-compose.yml          # 6 services
│   ├── Dockerfile.fetcher          # Legacy Python FastAPI image
│   ├── postgres-init/              # events VIEW + schema init
│   └── mysql-init/
├── frontend/
│   └── react-keepup/               # React 18 + TypeScript SPA
│       ├── src/
│       ├── nginx/default.conf
│       └── build/
├── web/                            # 🏛️ Joomla site (DO NOT TOUCH)
│                                   # Institutional site + user identity source
├── documentation/                  # 📖 This folder
│   ├── ARCHITECTURE.md             # ← You are here
│   ├── Development-Stage.md        # MVP checklist + progress
│   ├── CHANGELOG_2026-01-24.md
│   ├── Checkpoints/
│   ├── Notes/
│   └── Sandbox/
├── shell/
│   ├── start-all.sh
│   ├── status.sh
│   ├── stop-all.sh
│   └── backup-db.sh
├── pg_data/                        # PostgreSQL data volume
├── db_data/                        # MariaDB data volume
├── redis_data/                     # Redis AOF persistence
└── tmp/                            # Temporary files (gitignored)
```

---

## 📖 Glossary

| Realm Term | Technical Term |
|------------|---------------|
| The Passage | React Frontend + nginx |
| The Keeper | Node.js/Express Backend |
| The Dragon | Python FastAPI Fetcher (legacy, :8500) |
| The New Fetcher | Python standalone daemon (backend/python/) |
| The Vault | PostgreSQL 16 + PostGIS |
| The Scroll | MariaDB 11 (Joomla auth) |
| The Cache | Redis 7 |
| The Market | .env configuration |
| The Compatibility VIEW | PostgreSQL `events` VIEW |
| The Joomla Gate | web/ — institutional site + user identity |
| Sweep | Radar expansion cycle per city |
| Seed | artist_seed.py — Wikipedia artist population |
| Daemon | fetcher_daemon.py — continuous 6-continent runner |
| Spirits | AI models in rotation (DeepSeek + OpenRouter) |
| BEAM | Future Elixir real-time layer |

---

## 🛡️ The Realm's Oath

```
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║   THE PASSAGE guides the people                                  ║
║   THE KEEPER guards the data and commands all forces             ║
║   THE NEW FETCHER sweeps six continents without rest             ║
║   THE VAULT stores all knowledge with spatial wisdom             ║
║   THE SCROLL preserves the ancient identities                    ║
║   THE JOOMLA GATE stands as the source of all identity           ║
║   THE CACHE remembers what was already sought                    ║
║   THE MARKET trades all secrets at the crossroads                ║
║   THE BEAM awaits, patient, for the day of scale                 ║
║                                                                  ║
║   Together, they maintain THE ETERNAL BALANCE                    ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
```

---

*Last updated: March 16, 2026*
*Codex Version: 9.0 — The Unified Fetcher Edition*
