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
║                Codex Version 8.0 — The Shadow Awakening                        ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

---

## 🗺️ The Realm Overview

### Key Libraries, Technologies & External Services
- **Backend:** Node.js, Express, MariaDB, Postgres, Redis, BullMQ, bcrypt
- **Frontend:** React, TypeScript
- **Infrastructure:** Docker, Nginx
- **Monitoring:** Prometheus, Grafana
- **External Services:** GoDaddy (DNS/domain), Cloudflare (DNS/proxy/CDN), GitHub (repo/CI), Google OAuth (planned), Facebook OAuth (planned), Joomla (SSO/legacy), Viagogo (event source), Wikipedia (interests API), PostGIS (spatial DB), RabbitMQ (planned for BEAM), Azure (optional cloud), AWS (optional cloud)

#### Stage & Completion Status
- **GoDaddy:** DNS/domain registration — Stage: LIVE, Completion: ✅
- **Cloudflare:** DNS/proxy/CDN — Stage: LIVE, Completion: ✅
- **GitHub:** Source repo, CI/CD — Stage: LIVE, Completion: ✅
- **Google OAuth:** User login — Stage: PLANNED, Completion: ⏳
- **Facebook OAuth:** User login — Stage: PLANNED, Completion: ⏳
- **Joomla:** SSO/legacy user system — Stage: PARTIAL, Completion: ⚠️
- **Viagogo:** Event source API — Stage: INTEGRATED, Completion: ✅
- **Wikipedia:** Interests API — Stage: INTEGRATED, Completion: ✅
- **PostGIS:** Spatial DB — Stage: INTEGRATED, Completion: ✅
- **RabbitMQ:** Event broker (BEAM) — Stage: PLANNED, Completion: ⏳
- **Azure/AWS:** Optional cloud hosting — Stage: OPTIONAL, Completion: ⏳
- **Prometheus/Grafana:** Monitoring — Stage: PLANNED, Completion: ⏳
- **BullMQ/Redis:** Background jobs — Stage: LIVE, Completion: ✅
- **Nginx/Docker:** Infrastructure — Stage: LIVE, Completion: ✅

In the KEEP-Up kingdom, six great Docker services work in harmony to deliver events to the people. The old Joomla Gate has been absorbed — its authentication tables live on inside MariaDB, but THE KEEPER now rules authentication directly. A new Python Fetcher has risen as the primary event-harvesting force.

```
                              ┌─────────────────────┐
                              │    👤 THE PEOPLE    │
                              │   (Users/Visitors)  │
                              └──────────┬──────────┘
                                         │
                              ☁️ Cloudflare Argo Tunnel
                              (systemd: cloudflared)
                              app.keepup.lat → :3001
                                         │
                                         ▼
    ╔══════════════════════════════════════════════════════════════════════════╗
    ║   🚪 THE PASSAGE — React 18 + TypeScript                                ║
    ║   The magnificent gateway through which all travelers enter              ║
    ║   Served by nginx:alpine inside keepup_frontend (:3001)                  ║
    ║   Domain: /frontend/react-keepup/                                        ║
    ╚════════════════════════════════╤═════════════════════════════════════════╝
                       /api/fetcher/ │  /api/*  /health
                    ┌────────────────┴────────────────┐
                    ▼                                 ▼
    ╔═══════════════════════════════╗  ╔═══════════════════════════════╗
    ║   🐉 THE DRAGON               ║  ║   🗝️ THE KEEPER               ║
    ║   Python FastAPI Fetcher       ║  ║   Node.js + Express            ║
    ║   docker-fetcher-1 (:8500)     ║  ║   keepup_backend (:3002)       ║
    ║                               ║  ║                               ║
    ║   Providers:                  ║  ║   Powers:                     ║
    ║   ├── 🎟️ Ticketmaster          ║  ║   ├── 🔐 Auth (Joomla compat) ║
    ║   ├── 📍 Foursquare            ║  ║   ├── 📊 Events CRUD          ║
    ║   ├── 🎫 Viagogo               ║  ║   ├── 👤 User Profiles        ║
    ║   ├── 📡 PredictHQ             ║  ║   ├── ❤️ Interests            ║
    ║   └── 🕷️ Scraper               ║  ║   └── ⚙️ Admin Dashboard      ║
    ╚═══════════╤═══════════════════╝  ╚═══════╤═══════╤══════════════╝
                │                              │       │
                └──────────┬───────────────────┘       │
                           ▼                           ▼
    ╔══════════════════════════════════════╗  ╔════════════════════╗
    ║   🏛️ THE VAULT — PostgreSQL 16       ║  ║  📜 THE SCROLL      ║
    ║   + PostGIS spatial engine           ║  ║  MariaDB 11          ║
    ║   docker-postgres-1 (:5432)          ║  ║  docker-mariadb-1    ║
    ║   📜 keepup_events database          ║  ║  (:3307)             ║
    ║   5200+ events, 219 cities           ║  ║  📜 keepup_db        ║
    ║   PostGIS ST_DWithin spatial queries ║  ║  Joomla clone_users  ║
    ╚══════════════════════════════════════╝  ╚════════════════════╝
                                                       │
                           ┌───────────────────────────┘
                           ▼
    ╔══════════════════════════════════════╗
    ║   ⚡ THE CACHE — Redis 7-alpine      ║
    ║   keepup_redis (:6379)               ║
    ║   AOF persistence: /redis_data/      ║
    ╚══════════════════════════════════════╝
```

---

## 📊 Project Status & Completion Meter (March 2, 2026)

```
ARCHITECTURE COMPLETION: [█████████░] 90%

Core Systems:
  ✅ React Frontend (React 18 + TS)       [██████████] 100% — nginx-served SPA, all pages, admin dashboard
  ✅ Node.js Backend (Express)            [██████████] 100% — Auth, events, profiles, interests, admin API
  ✅ Python Fetcher (FastAPI)             [██████████] 100% — 5 providers, sweep engine, Shadow AI, populate
  ✅ PostgreSQL + PostGIS                 [██████████] 100% — Spatial queries, events VIEW, 5200+ events
  ✅ MariaDB (Joomla Auth)               [██████████] 100% — clone_users/sessions, password compat
  ✅ Docker Compose (6 services)          [██████████] 100% — All containers healthy, auto-restart
  ✅ Cloudflare Tunnel                    [██████████] 100% — app.keepup.lat → :3001 via systemd
  ✅ Redis Cache                          [██████████] 100% — AOF persistence, health-checked
  ✅ Shell Scripts (start/status/backup)  [██████████] 100% — Correct container names, smoke tests
  🟡 E2E Tests                            [██░░░░░░░░] 20%  — Smoke tests in status.sh, no Cypress
  🟡 OAuth (Google/Facebook)             [░░░░░░░░░░]  0%  — Planned post-MVP

Key Milestones:
  🟢 Jan 16 — Auth system unified across React/Node/Joomla
  🟢 Jan 19 — Vite frontend + Serpents orchestration online
  🟢 Jan 20 — BullMQ job queue + MariaDB persistence
  🟢 Jan 22 — .NET event-serpent & auth-proxy operational
  🟢 Feb 10 — Save/Unsave/Saved events fully implemented
  🟢 Feb 12 — Dual location system (Home + Current), PostGIS distance_km
  🟢 Feb 13 — Docker connection stability fix (service DNS)
  🟢 Feb 16 — Response hygiene & auth binding
  🟢 Feb 27 — EventDetail page, full workspace audit
  🟢 Mar 01 — Python Fetcher replaces old Serpents, events VIEW bridge
  🟢 Mar 02 — Shell scripts rewritten, 5 smoke tests passing, ARCHITECTURE.md v7
  🟢 Mar XX — Arch Mage's Shadow (29 AI spirits), Populate Engine, ARCHITECTURE.md v8

📁 Documentation Structure:
  /documentation/
  ├── ARCHITECTURE.md         — System design & component reference (this file)
  ├── Development-Stage.md    — MVP checklist, complexity guide, checkpoints
  ├── CHANGELOG_2026-01-24.md — January changelog
  ├── Complexity Guide.md     — Task breakdown by complexity level
  ├── MVP.md                  — MVP checklist & release plan
  ├── Checkpoints/            — Progress snapshots
  ├── Notes/                  — Technical notes
  └── Sandbox/                — Daily status logs
```

---

## 🏗️ Infrastructure (Docker Compose)

> *"Six great pillars hold the realm aloft. Should any fall, the others rally."*

**Compose File:** `docker/docker-compose.yml`  
**Network:** `docker_default` bridge (172.19.0.0/16) — containers resolve by service name  
**External Tunnel:** Cloudflare Argo Tunnel (systemd `cloudflared`) → `app.keepup.lat` → `localhost:3001`

| Pillar | Image | Container Name | Port(s) | Purpose |
|--------|-------|----------------|---------|---------|
| 🏛️ The Vault | postgis/postgis:16-3.4-alpine | docker-postgres-1 | 5432:5432 | Events + PostGIS spatial |
| 📜 The Scroll | mariadb:11 | docker-mariadb-1 | 3307:3306 | Joomla auth tables |
| 🐉 The Dragon | custom (Dockerfile.fetcher) | docker-fetcher-1 | 8500:8500 | Python event harvester |
| ⚡ The Cache | redis:7-alpine | keepup_redis | 6379:6379 | Caching + message queues |
| 🗝️ The Keeper | custom (backend/Dockerfile) | keepup_backend | 3002:3002 | Express API server |
| 🚪 The Passage | nginx:alpine | keepup_frontend | 3001:80 | React SPA + reverse proxy |

### 🟥 THE SQUARE — Cross-Port Commons
- **Ports:** React `:3001` ↔ Node `:3002` ↔ Fetcher `:8500` ↔ MariaDB `:3307` ↔ Postgres `:5432` ↔ Redis `:6379`
- **CORS:** Explicit allowlist for `localhost:3001`, `localhost:3002`, `app.keepup.lat`, `adm.keepup.lat`, `keepup.lat` with credentials
- **Cookies:** `KEEPUP_SESSION` set with domain/path per environment, `SameSite` auto, `httpOnly`
- **Bearer fallback:** Login/register reuse session token as `Authorization: Bearer ...` for fetch fallback
- **Frontend persistence:** Stores `KEEPUP_BEARER_TOKEN` and `KEEPUP_SESSION_TOKEN` to survive port hops

---

## 🚪 THE PASSAGE (React Frontend)

> *"Through the Passage, all travelers see the realm."*

**Class:** Interface Mage | **Technology:** React 18 + TypeScript  
**Domain:** `/frontend/react-keepup/` | **Container:** `keepup_frontend` (nginx:alpine on `:3001`)  
**Build:** Static SPA served from `/usr/share/nginx/html`

### Sacred Chambers (Pages)

| Route | Chamber | Access |
|-------|---------|--------|
| `/` | 🏠 Landing — The Grand Hall | Public |
| `/login` | 🏠 Landing — The Grand Hall | Public |
| `/events` | 📋 EventGrid — The Event Gallery | ProtectedRoute |
| `/map` | 🗺️ EventMap — The World Map | ProtectedRoute |
| `/profile` | 👤 Profile — The Identity Chamber | ProtectedRoute |
| `/profile/edit` | ✏️ EditProfile — The Customization Room | ProtectedRoute |
| `/create` | ✨ CreateEvent — The Creation Forge | requireCreateEvent |
| `/admin` | ⚙️ EnhancedAdminDashboard — The Control Room | requireAdmin |
| `/choose-destination` | 🧭 ChooseDestination — The Crossroads | requireAdmin |
| `/unauthorized` | 🚫 Access Denied | Public |
| `*` | Redirect → `/` | — |

### Key Components
- `Navigation` — Top navigation bar (role-aware visibility)
- `ProtectedRoute` — Auth wrapper (supports `requireAdmin`, `requireCreateEvent`)
- `AuthContext` / `AuthProvider` — Session management across the realm

### CSS Design Philosophy
The UI uses **transparent floating cards** over animated gradient background:
- **Background:** `linear-gradient(135deg, #0f0f23 0%, #1a1a3e 100%)` with animation
- **Content:** Fully transparent containers — "floating in space" effect

---

## 🗝️ THE KEEPER (Node.js Backend)

> *"The Keeper guards all knowledge of events and commands the realm's forces."*

**Class:** Data Guardian & Grand Commander | **Technology:** Node.js + Express  
**Domain:** `/backend/` | **Container:** `keepup_backend` (:3002)  
**Entry:** `backend/main_server.js`  
**Connects to:** PostgreSQL (`pgDb`), MariaDB (`db`, `joomlaDb`), Redis (`redis`)

### 📜 THE KEEPER'S SACRED SCROLLS (Endpoints)

#### Authentication Rituals (8 scrolls — inline in main_server.js)

| Method | Scroll Path | Handler |
|--------|-------------|---------|
| GET | `/api/auth/check` | authController.check |
| POST | `/api/auth/login` | authController.login |
| POST | `/api/auth/logout` | authController.logout |
| POST | `/api/auth/validate-session` | authController.validateSession |
| GET | `/api/auth/validate-session` | authController.validateSessionGet |
| POST | `/api/auth/joomla-session` | authController.joomlaSession |
| POST | `/api/auth/register` | authController.register |
| GET | `/api/auth/user` | authController.getUser |

#### Profile Inscriptions (7 scrolls — routes/user.routes.js)

| Method | Scroll Path | Handler |
|--------|-------------|---------|
| POST | `/api/profile/get` | userController.getProfile |
| GET | `/api/profile/:userId` | userController.getProfileById |
| POST | `/api/profile/save` | userController.saveProfile |
| PUT | `/api/profile` | userController.saveProfileById |
| PUT | `/api/location/current` | userController.updateCurrentLocation |
| GET | `/api/map/checkpoints` | userController.getMapCheckpoints |
| GET | `/api/users/:userId/events` | userController.getUserEvents |

#### Event Command Scrolls (15 scrolls — routes/events.routes.js)

| Method | Scroll Path | Auth | Handler |
|--------|-------------|------|---------|
| GET | `/api/events/discover` | Public | eventsController.discover |
| POST | `/api/events/search` | Public | eventsController.searchPost |
| GET | `/api/events/search` | Public | eventsController.searchGet |
| GET | `/api/events/artist/:name` | Public | eventsController.byArtist |
| GET | `/api/events/country/:country` | Public | eventsController.byCountry |
| GET | `/api/events/nearby` | Public | eventsController.nearby |
| POST | `/api/events/save` | Required | eventsController.save |
| POST | `/api/events/unsave` | Required | eventsController.unsave |
| GET | `/api/events/saved` | Required | eventsController.saved |
| GET | `/api/events/is-saved` | Required | eventsController.isSaved |
| POST | `/api/events/create` | Required | eventsController.create |
| POST | `/api/events/populate-town` | Public | eventsController.populateTown |
| GET | `/api/events/viagogo-search` | Public | eventsController.viagogoSearch |
| POST | `/api/events/viagogo-search` | Public | eventsController.viagogoSearch |
| GET | `/api/events/:id` | Public | eventsController.getById |

#### Interest Scrolls (6 scrolls — routes/interests.routes.js)

| Method | Scroll Path | Handler |
|--------|-------------|---------|
| GET | `/api/interests/categories` | interestsController.getCategories |
| GET | `/api/interests/category/:categoryId` | interestsController.getCategoryItems |
| GET | `/api/interests/user/:userId` | interestsController.getUserInterests |
| POST | `/api/interests/user/:userId` | interestsController.saveUserInterests |
| GET | `/api/interests/match/:userId` | interestsController.getMatchingEvents |
| POST | `/api/interests/sync` | interestsController.syncToDatabase |

#### Admin Command Scrolls (36 scrolls — routes/admin.routes.js, all behind requireAdmin)

| Method | Scroll Path | Handler |
|--------|-------------|---------|
| POST | `/api/admin/login` | adminController.login |
| POST | `/api/admin/feather-dragon/search` | adminController.featherDragonSearch |
| POST | `/api/admin/dragons-unleashed` | adminController.dragonsUnleashed |
| GET | `/api/admin/fetcher/status` | adminController.fetcherStatus |
| POST | `/api/admin/crawler/start` | adminController.crawlerStart |
| POST | `/api/admin/intelligent/enhanced` | adminController.enhancedCrawler |
| POST | `/api/admin/crawler/pause` | adminController.crawlerPause |
| POST | `/api/admin/intelligent/pause` | adminController.crawlerPause |
| POST | `/api/admin/crawler/resume` | adminController.crawlerResume |
| POST | `/api/admin/intelligent/resume` | adminController.crawlerResume |
| POST | `/api/admin/crawler/stop` | adminController.crawlerStop |
| POST | `/api/admin/intelligent/stop` | adminController.crawlerStop |
| GET | `/api/admin/intelligent/status` | adminController.intelligentStatus |
| GET | `/api/admin/cache/stats` | adminController.cacheStats |
| POST | `/api/admin/cache/clear` | adminController.cacheClear |
| GET | `/api/admin/events` | adminController.adminEvents |
| DELETE | `/api/admin/event/:id` | adminController.deleteEvent |
| POST | `/api/admin/populate-town` | adminController.populateTown |
| POST | `/api/admin/populate-world` | adminController.populateWorld |
| POST | `/api/admin/populate-country` | adminController.populateCountry |
| GET | `/api/admin/populate-countries` | adminController.populateCountries |
| GET | `/api/admin/populate-status` | adminController.populateStatus |
| GET | `/api/admin/populate-jobs` | adminController.listJobs |
| GET | `/api/admin/populate-job/:id` | adminController.getJob |
| POST | `/api/admin/populate-job/:id/resume` | adminController.resumePopulateJob |
| GET | `/api/admin/town-status/:town` | adminController.townStatus |
| GET | `/api/admin/stats` | adminController.stats |
| GET | `/api/admin/ai-config` | adminController.getAIConfig |
| POST | `/api/admin/ai-config` | adminController.saveAIConfig |
| POST | `/api/admin/ai-config/test` | adminController.testAIConfig |
| GET | `/api/admin/users` | adminController.getUsers |
| POST | `/api/admin/unified-fetch` | adminController.unifiedFetch |
| GET | `/api/admin/unified-sources` | adminController.unifiedSources |
| POST | `/api/admin/refresh-node` | adminController.refreshNode |
| POST | `/api/admin/refresh-react` | adminController.refreshReact |
| GET | `/api/admin/refresh-status` | adminController.refreshStatus |

#### Static & Utility Scrolls

| Method | Scroll Path | Purpose |
|--------|-------------|---------|
| GET | `/admin` | Serves admin.html |
| GET | `/api/simple` | Test endpoint |
| GET | `/health` | Health check (PG + MariaDB + Redis) |

---

## 🐉 THE DRAGON (Python FastAPI Fetcher)

> *"When THE KEEPER commands: 'Let events be harvested from all corners of the realm!' The Dragon awakens and sweeps across all lands with its five heads."*

**Class:** Event Harvester Supreme | **Technology:** Python 3 + FastAPI  
**Domain:** `/backend/fetcher/` | **Container:** `docker-fetcher-1` (:8500)  
**Build:** `docker/Dockerfile.fetcher`  
**Connects to:** PostgreSQL directly (same `keepup_events` database as The Keeper)

### 🐲 The Dragon's Five Heads (Providers)

| Head | Provider | API / Method | Status |
|------|----------|-------------|--------|
| 🎟️ | Ticketmaster | Discovery API v2 | ✅ Working |
| 📍 | Foursquare | Places API v3 | ✅ Working |
| 🎫 | Viagogo | Catalog API | ✅ Working |
| 📡 | PredictHQ | Events API | ✅ Working |
| 🕷️ | Scraper | Web scraping (BeautifulSoup) | ✅ Working |

### 🌀 The Dragon's Sweep Behaviour

The Dragon runs **continuous city-based sweeps**, expanding outward in radius from each city center. When one cycle finishes, it rests briefly and begins anew.

```
┌────────────────────────────────────────────────────────────────┐
│  City: Porto Alegre (lat: -30.03, lon: -51.23)                 │
│                                                                │
│  Pass 1: r = 10km   ⚡ Ticketmaster + Foursquare + ...        │
│  Pass 2: r = 25km   ⚡ Expand search radius                   │
│  Pass 3: r = 40km   ⚡ Expand further                         │
│  ...                                                           │
│  Pass N: r = 500km  🛑 Max radius reached → next city          │
│                                                                │
│  All cities done? Sleep 60s → Start new cycle                  │
└────────────────────────────────────────────────────────────────┘
```

### 🎛️ Dragon Configuration (Environment Variables)

| Variable | Default | Purpose |
|----------|---------|---------|
| `SWEEP_INITIAL_RADIUS` | 10 | Starting radius (km) |
| `SWEEP_RADIUS_STEP` | 15 | Increment per pass (km) |
| `SWEEP_MAX_RADIUS` | 500 | Maximum radius cap (km) |
| `SWEEP_DELAY` | 30 | Delay between sweeps (s) |
| `API_CALL_DELAY` | 1.5 | Delay between API calls (s) |
| `MAX_CONCURRENT_SWEEPS` | 15 | Parallel sweep limit |
| `UPDATE_INTERVAL_HOURS` | 6 | Re-sweep interval |
| `CYCLE_PAUSE` | 60 | Pause between full cycles (s) |
| `RESWEEP_HOURS` | 6 | Force re-sweep after (h) |
| `MEMORY_CAP_MB` | 384 | Memory limit for fetcher |

### 🧙 AI Integration — The Arch Mage's Shadow

The Dragon's AI power is no longer bound to a single model. The **Arch Mage's Shadow** rotation engine distributes calls across **29+ free OpenRouter models** plus **DeepSeek Direct** (separate API key, separate rate limits). See the dedicated Shadow section below for full details.

### 🌍 Populate Engine

The Dragon now commands its own **Populate Engine** — previously, town/country/world population was handled by The Keeper's admin dashboard. Now it runs natively inside the Dragon with:
- **`populate town`** — Add and sweep a single town
- **`populate country`** — All cities in a country (with state-level data for BR, US, GB, DE)
- **`populate world`** — 55+ countries, 500+ cities worldwide
- **`populate list-countries`** — Show available countries and city counts

CLI: `python -m fetcher.populate town "Porto Alegre" --country Brazil`
API: `POST /api/fetcher/populate/town`, `/populate/country`, `/populate/world`

---

## 🧙‍♂️ THE ARCH MAGE'S SHADOW (AI Rotation Engine)

> *"In the shadows behind the Arch Mage, many spirits whisper. Each spirit knows the same incantations, but none can speak forever. The Shadow rotates which spirit speaks, ensuring the Mage's power never fades — for when one voice grows hoarse, another rises."*

**Class:** AI Distribution Sorcerer | **Technology:** Python 3 async + aiohttp  
**Domain:** `/backend/fetcher/arch_mage_shadow.py` | **Used by:** AIEngine, Populate Engine, SweepEngine  
**Connects to:** OpenRouter API (29 spirits), DeepSeek Direct API (1 dedicated spirit)

The Arch Mage's Shadow is the central AI rotation engine of KEEP-Up. Instead of relying on a single model (and quickly hitting rate limits), the Shadow distributes calls across **30 AI spirits** — 29 free OpenRouter models organised in three tiers, plus DeepSeek on its own dedicated API key.

### 👻 The 30 Spirits

| Tier | Role | Spirits | Examples |
|------|------|---------|----------|
| 0 | Dedicated Key | 1 | DeepSeek Direct (own API key, own rate limits) |
| 1 | Flagships (70B+) | 5 | Llama 3.3 70B, Qwen 2.5 72B, DeepSeek R1 70B, Nemotron 70B, Dolphin Mixtral 8×22B |
| 2 | Medium (24-32B) | 8 | Mistral Small 24B, Gemma 3 27B, Qwen3 32B, GLM-Z1 32B, DeepSeek R1, DeepSeek Chat |
| 3 | Fast (1-16B) | 16 | Phi-4, Qwen3 14B/8B/4B, Gemma 2 9B, Llama 3.1/3.2, Mistral 7B, OpenChat, Zephyr, Capybara, Gemini Flash |

### 🔄 Rotation Algorithm

```
1. Filter out cooling-down spirits (rate-limited in last 120s)
2. Sort available spirits by (tier ASC, usage_count ASC)
3. Round-robin pointer selects next spirit from sorted pool
4. DeepSeek Direct used every 5th call (separate rate limit pool)
5. On 429 → spirit enters 120s cooldown, pointer advances
6. Max 3 retries per call, then ShadowExhaustedError
7. Last resort: try DeepSeek Direct if not yet attempted
```

### 📊 Shadow Stats

The Shadow tracks per-spirit statistics:
- **Calls / Successes / Failures / Rate-limited** counts
- **Average latency** (ms)
- **Cooldown status** and remaining time
- **Success rate** percentage

Access via:
- Admin API: `GET /api/fetcher/shadow-stats`
- Python: `shadow.get_stats()` / `shadow.log_stats_summary()`
- CLI: Stats printed after each populate run

### ⚡ Parallel Calling

The Shadow supports `call_parallel(prompts)` — each prompt is sent to a different spirit simultaneously, mirroring the `auto_city_populator.py` multi-model pattern but now across all 30 spirits.

---

## 🏛️ THE VAULT (PostgreSQL 16 + PostGIS)

> *"All event knowledge flows into The Vault, where PostGIS guards the geography of every gathering."*

**Technology:** PostGIS/PostgreSQL 16-3.4-alpine | **Container:** `docker-postgres-1` (:5432)  
**Database:** `keepup_events` | **User:** `keepup_user`  
**Init scripts:** `docker/postgres-init/` (run alphabetically on first launch)

### 📜 Sacred Archives (Tables)

| Table | Purpose |
|-------|---------|
| `fetcher_events` | All harvested events (name, dates, lat/lng, category, source, etc.) |
| `fetcher_cities` | City catalogue (name, country, country_code, lat/lng) |
| `fetcher_venues` | Venue details (name, address, lat/lng) |
| `fetcher_jobs` | Python fetcher job tracking |
| `fetcher_logs` | Fetcher audit log |
| `saved_events` | User ↔ event bookmarks (user_id, event_id, action) |
| `user_profiles` | Extended profiles (bio, avatar, home/current location, geom) |
| `user_interests` | User interest selections |
| `populate_jobs` | Node-side populate job tracking |

### 🔮 The Compatibility VIEW (`events`)

> *"A magical mirror that allows The Keeper's old scrolls to read The Dragon's new data without rewriting a single incantation."*

**Created by:** `docker/postgres-init/02-events-view.sql`

The Node.js controllers were written with the old column names (`event_name`, `event_date`, `venue_latitude`...). Rather than rewriting 800+ lines of queries, a PostgreSQL VIEW bridges old ↔ new:

| VIEW Column (old name) | Source (real data) |
|-------------------------|-------------------|
| `event_name` | fetcher_events.name |
| `event_date` | fetcher_events.start_date |
| `venue_latitude` | fetcher_events.latitude |
| `venue_longitude` | fetcher_events.longitude |
| `venue_city` | fetcher_cities.name (JOIN) |
| `venue_country` | fetcher_cities.country (JOIN) |
| `venue_address` | fetcher_venues.address (JOIN) |
| `geom` | ST_SetSRID(ST_MakePoint(lon, lat), 4326) |

This VIEW JOINs `fetcher_events` ← `fetcher_cities` ← `fetcher_venues` and computes a PostGIS `geom` column, enabling spatial queries like `ST_DWithin` and `ST_Distance` to work transparently.

---

## 📜 THE SCROLL (MariaDB 11)

> *"The ancient Scroll holds the identities of all who enter the realm — inherited from the Joomla Gate of old."*

**Technology:** MariaDB 11 | **Container:** `docker-mariadb-1` (:3307→3306)  
**Database:** `keepup_db` | **Users:** `keepup` (app), `root` (Joomla queries)  
**Init scripts:** `docker/mysql-init/`

### 📜 Archives

| Table | Purpose |
|-------|---------|
| `clone_users` | User credentials (Joomla-compatible bcrypt passwords) |
| `clone_session` | Active sessions |
| `clone_usergroups` | Group definitions (Registered, Author, Admin, Super User) |
| `clone_user_usergroup_map` | User ↔ group assignments (RBAC) |

Password verification uses Joomla-compatible hashing via `backend/joomla_password.js`.

---

## ⚡ THE CACHE (Redis 7)

> *"Swift as thought, The Cache remembers what others have already sought."*

**Technology:** Redis 7-alpine | **Container:** `keepup_redis` (:6379)  
**Persistence:** AOF (`appendonly yes`) at `/redis_data/`

Used for caching and message queues by both The Keeper and other services.

---

## 🚪➡️🗝️➡️🐉 The Nginx Gateway (Reverse Proxy)

> *"The Passage does not merely display — it routes every traveler's request to the correct power."*

**Config:** `frontend/react-keepup/nginx/default.conf` (inside keepup_frontend container)

| Location Block | Upstream | Notes |
|----------------|----------|-------|
| `/` | Local static files | React SPA; `try_files` fallback to `index.html` |
| `/index.html` | Local static files | No-cache headers for in-app browsers |
| `/api/fetcher/` | `http://fetcher:8500/api/fetcher/` | **X-API-Key injected server-side** (never exposed to browser) |
| `/api/` | `http://node:3002/api/` | WebSocket upgrade support |
| `/health` | `http://node:3002/health` | Health check passthrough |
| Static assets | Local files | 1-year cache, immutable |

**Security headers:** `X-Frame-Options SAMEORIGIN`, `X-Content-Type-Options nosniff`, `X-XSS-Protection`.

---

## 🔐 The Authentication Flow

> *"None shall pass without proving their identity to The Keeper's guards."*

1. User arrives at `/` → `Landing` page shows login form
2. `POST /api/auth/login` → `auth.controller.js` checks `clone_users` in MariaDB (Joomla bcrypt)
3. Session row inserted into `clone_session`, session cookie set
4. Middleware `requireAuth` validates session cookie on every protected scroll
5. `requireAdmin` extends `requireAuth` — checks `clone_user_usergroup_map` for admin group IDs
6. Frontend stores `KEEPUP_BEARER_TOKEN` as Bearer fallback for cross-port requests

---

## 🏪 THE MARKET (.env Configuration Hub)

> *"At the crossroads of all realms, The Market is where all powers trade their secrets."*

**Main env file:** `docker/.env` (loaded by docker-compose)  
**Backend env file:** `backend/.env` (loaded by dotenv in main_server.js)

### 🔑 Market Goods

| Category | Variable | Purpose |
|----------|----------|---------|
| **Database** | `DB_PASSWORD` | PostgreSQL password |
| **Database** | `MARIADB_PASSWORD` | MariaDB app user password |
| **Database** | `MARIADB_ROOT_PASSWORD` | MariaDB root password |
| **Security** | `ADMIN_API_KEY` | Inter-service API key |
| **Event APIs** | `TICKETMASTER_API_KEY` | Ticketmaster Discovery API |
| **Event APIs** | `FOURSQUARE_API_KEY` | Foursquare Places API |
| **Event APIs** | `VIAGOGO_API_KEY` | Viagogo Catalog API |
| **Event APIs** | `PREDICTHQ_API_KEY` | PredictHQ Events API |
| **AI** | `OPENROUTER_API_KEY` | OpenRouter AI API |
| **AI** | `AI_PRIMARY_MODEL` | Primary AI model (deepseek-chat) |
| **AI** | `AI_FALLBACK_MODEL` | Fallback AI model (mistral-7b) |

---

## ⚔️ Summoning Commands

### Awakening the Full Realm (Recommended)
```bash
cd /media/phobos/KEEP-Up\ App
bash shell/start-all.sh
```

Starts services in dependency order: Cloudflare → Databases → Redis → Fetcher → Node → Frontend. Skips already-running containers.

### Checking Realm Health
```bash
bash shell/status.sh
```

Shows container status dashboard + 5 smoke tests:
1. Node `/health` (checks PG + MariaDB + Redis)
2. Fetcher `/health` (shows event/city counts)
3. Frontend `localhost:3001`
4. Admin events API (expects auth-required)
5. Nginx → Fetcher proxy

### Docker Management
```bash
cd docker
docker compose up -d              # Start all
docker compose down               # Stop all
docker compose up -d --build node # Rebuild Node only
docker compose logs -f fetcher    # Tail fetcher logs
```

### Database Backup
```bash
bash shell/backup-db.sh
```

---

## 📖 Glossary of Terms

| Realm Term | Technical Term | Description |
|------------|----------------|-------------|
| **The Passage** | React Frontend + nginx | User interface (React 18 + TypeScript) |
| **The Keeper** | Node.js/Express Backend | API server, auth, data management |
| **The Dragon** | Python FastAPI Fetcher | Event harvesting with 5 providers |
| **The Vault** | PostgreSQL 16 + PostGIS | Event database with spatial queries |
| **The Scroll** | MariaDB 11 | Joomla-compatible auth tables |
| **The Cache** | Redis 7 | Caching + message queues |
| **The Market** | .env Configuration | Central hub for all API keys & secrets |
| **The Compatibility VIEW** | PostgreSQL `events` VIEW | Bridges old column names to new schema |
| **Scrolls** | API Endpoints | REST API routes |
| **Chambers** | Pages/Routes | React page components |
| **Summoning** | Starting/Running | Launching services |
| **Sweep** | Fetcher cycle | Radius-expanding city event search |
| **The Arch Mage's Shadow** | AI Rotation Engine | Distributes AI calls across 30 spirits (29 OpenRouter + DeepSeek) |
| **Spirits** | AI Models | Individual models in the Shadow's rotation pool |
| **Cooldown** | Rate-limit pause | 120s timeout after a spirit hits 429 |
| **Populate** | Town/Country/World populator | Mass city discovery and event harvesting |
| **The People** | End users | Visitors via app.keepup.lat |

---

## 🛡️ The Realm's Oath

```
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║   THE PASSAGE guides the people                                  ║
║   THE KEEPER guards the data and commands all forces             ║
║   THE DRAGON harvests events from five great sources             ║
║   THE SHADOW rotates thirty spirits to channel AI                ║
║   THE VAULT stores all knowledge with spatial wisdom             ║
║   THE SCROLL preserves the ancient identities                    ║
║   THE CACHE remembers what was already sought                    ║
║   THE MARKET trades all secrets at the crossroads                ║
║                                                                  ║
║   Together, they maintain THE ETERNAL BALANCE                    ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
```

---

## 🗂️ Directory Layout

```
KEEP-Up App/
├── backend/                        # 🗝️ THE KEEPER — Node.js Express API
│   ├── main_server.js              # Entry point (connects PG + MariaDB + Redis)
│   ├── controllers/                # Business logic
│   │   ├── admin.controller.js     # Admin dashboard, populate, AI config
│   │   ├── auth.controller.js      # Login/register (Joomla-compatible)
│   │   ├── events.controller.js    # Discover, search, save, create (820 lines)
│   │   ├── interests.controller.js # Categories, user interests
│   │   └── user.controller.js      # Profiles, location, map checkpoints
│   ├── routes/                     # Express routers
│   │   ├── admin.routes.js         # 36 admin endpoints (requireAdmin)
│   │   ├── events.routes.js        # 15 event endpoints
│   │   ├── interests.routes.js     # 6 interest endpoints
│   │   ├── osm.routes.js           # OpenStreetMap OAuth
│   │   └── user.routes.js          # 7 user/profile endpoints
│   ├── middleware/                  # requireAuth, requireAdmin, allowIframe
│   ├── fetcher/                    # 🐉 THE DRAGON — Python FastAPI fetcher
│   │   ├── arch_mage_shadow.py     # 🧙‍♂️ Arch Mage's Shadow — AI rotation (29 spirits)
│   │   ├── populate.py             # 🌍 Populate Engine — Town/Country/World
│   │   ├── ai_engine.py            # AI city discovery (powered by Shadow)
│   │   └── providers/              # Ticketmaster, Foursquare, Viagogo, PredictHQ, Scraper
│   ├── Dockerfile                  # Node container build
│   └── .env                        # Backend environment
├── docker/
│   ├── docker-compose.yml          # All 6 services defined here
│   ├── Dockerfile.fetcher          # Python fetcher build
│   ├── .env                        # Compose environment variables
│   ├── postgres-init/              # PG init scripts (run once on first boot)
│   │   └── 02-events-view.sql      # 🔮 The Compatibility VIEW
│   └── mysql-init/                 # MariaDB init scripts
├── frontend/
│   └── react-keepup/
│       ├── src/                    # React 18 + TypeScript source
│       │   ├── App.tsx             # Routes & layout (11 routes)
│       │   ├── pages/              # Landing, EventGrid, EventMap, Profile, Admin...
│       │   ├── components/         # Navigation, ProtectedRoute, etc.
│       │   └── context/            # AuthContext / AuthProvider
│       ├── nginx/
│       │   └── default.conf        # Reverse proxy → Node + Fetcher
│       ├── build/                  # Production build (served by nginx)
│       └── public/                 # Static assets
├── documentation/                  # 📖 This folder
│   ├── ARCHITECTURE.md             # ← You are here
│   ├── Development-Stage.md        # MVP checklist + complexity guide
│   ├── Checkpoints/                # Progress snapshots
│   ├── Notes/                      # Technical notes
│   └── Sandbox/                    # Daily status logs
├── shell/
│   ├── start-all.sh                # Start services in dependency order
│   ├── status.sh                   # Health dashboard + 5 smoke tests
│   └── backup-db.sh               # Database backup
├── pg_data/                        # PostgreSQL data volume
├── db_data/                        # MariaDB data volume
├── redis_data/                     # Redis AOF persistence
└── web/                            # Legacy web assets
```

---

*Last updated: March 2026*  
*Codex Version: 8.0 — The Shadow Awakening Edition 🧙‍♂️🐉*
