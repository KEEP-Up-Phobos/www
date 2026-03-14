# 📋 KEEP-Up Master TODO List

> *"A kingdom's strength lies in knowing which battles to fight first."*

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║     ████████╗ ██████╗ ██████╗  ██████╗ ███████╗                              ║
║        ██║   ██╔═══██╗██╔══██╗██╔═══██╗██╔════╝                              ║
║        ██║   ██║   ██║██║  ██║██║   ██║███████╗                              ║
║        ██║   ██║   ██║██║  ██║██║   ██║╚════██║                              ║
║        ██║   ╚██████╔╝██████╔╝╚██████╔╝███████║                              ║
║        ╚═╝    ╚═════╝ ╚═════╝  ╚═════╝ ╚══════╝                              ║
║                                                                               ║
║               🎯 HIERARCHICAL TASK LIST BY COMPLEXITY 🎯                      ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

---

## � Documentation Structure

| Folder | Purpose | Key Files |
|--------|---------|----------|
| `/documentation/` | Core docs only | ARCHITECTURE.md, MVP.md, Complexity Guide.md, Copilot Guide.md |
| `/documentation/Checkpoints/` | Progress snapshots | CHECKPOINT_JANUARY.md |
| `/documentation/Notes/` | Technical notes | AUTH_REFACTOR_CHECKPOINT.md, DOTNET_SERVICES.md, integration-roadmap.md |
| `/documentation/Sandbox/` | Daily status logs | SANDBOX_STATUS_JAN21.md, SANDBOX_STATUS_JAN22.md, SANDBOX_STATUS_JAN22_BACKGROUND.md |

---

## 📊 Project Overview (Updated Jan 22, 2026)

| Component | Files | Lines | Status |
|-----------|-------|-------|--------|
| **Frontend (React)** | 40+ | 4,500+ | 🟢 100% complete — EventGrid, auth hooks, skeleton loading, zero-warning build |
| **Backend (Node.js)** | 35+ | 9,800+ | 🟢 90% — Serpents service, event discovery API, BullMQ jobs |
| **Backend (.NET)** | 4 | 800+ | 🟢 100% — event-serpent, auth-proxy containerized & tested |
| **Backend (Python)** | 8 | 2,800+ | 🟢 Well structured, optional speed boost |
| **Joomla/PHP** | 300+ | 15,000+ | 🟡 20% — PHP HTTP client only, Joomla 6.0 component stalled |
| **Docker** | 10 | 500+ | 🟢 Stable — includes Redis, optimized startup scripts |

---

## 🔴 LEVEL 5 — OPUS REQUIRED (Cross-System, Architectural)

### 🔴 5.1 Authentication System Overhaul
**Complexity:** ⭐⭐⭐⭐⭐ | **Files:** 8+ | **Languages:** 3

**Status:** 🟢 COMPLETE (Jan 16, 2026)

---

#### 📊 OPUS ANALYSIS FINDINGS

**Problem Summary:**
- Authentication spans React ↔ Node.js ↔ Joomla PHP
- Session management inconsistent between systems
- Password hashing uses different algorithms ($2y vs $2a bcrypt)
- Token validation duplicated in multiple places

**Resolution:**
- ✅ Universal DB connection logic implemented and verified (Jan 16, 2026)
- ✅ All session tables consolidated (unified_sessions)
- ✅ Admin sessions now persistent (DB-backed)
- ✅ verifyJoomlaSession() fixed to return correct user
- ✅ Obsolete/duplicate code removed (auth_sync_client.js, local_sessions)
- ✅ DB access is robust and fast; server performance restored

**Files Involved:**
```
/frontend/react-keepup/src/
├── context/AuthContext.tsx      (180 lines) - React auth state
├── api/auth.ts                  (104 lines) - Auth API calls
├── pages/Landing.tsx            (335 lines) - Login/register forms
├── pages/Login.tsx              (77 lines)  - Legacy login (UNUSED?)
├── components/ProtectedRoute.tsx (108 lines) - Route guards

/backend/
├── main_server.js               (2798 lines) - Auth endpoints (lines 584-1270)
├── auth_sync_client.js          (293 lines)  - Cross-system sync client
├── joomla_password.js           (129 lines)  - Password compat (WORKS!)

/web/
├── auth_sync_system.php         (428 lines)  - PHP auth sync server
```

---

#### 🗺️ 5.1.1 COMPLETE AUTH FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        AUTHENTICATION FLOW MAP                               │
└─────────────────────────────────────────────────────────────────────────────┘

USER ENTERS APP (localhost:3001)
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  REACT: AuthContext.tsx (useEffect on mount)                                │
│                                                                             │
│  1. Check URL for ?token= parameter (from login redirect)                   │
│  2. Check localStorage for KEEPUP_SESSION_TOKEN + KEEPUP_USER               │
│  3. If neither, call authAPI.verifyJoomlaSession()                         │
│     └── POST /api/auth/joomla-session (checks PHP session cookies)          │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼ (if no stored session)
┌─────────────────────────────────────────────────────────────────────────────┐
│  REACT: Landing.tsx - Login Form                                            │
│                                                                             │
│  User submits username/password                                             │
│  └── authAPI.login() -> POST /api/auth/login                               │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  NODE.JS: main_server.js (lines 667-785)                                    │
│                                                                             │
│  1. Query clone_users table for email OR username                           │
│  2. JoomlaPassword.verify() - handles $2y$ → $2a$ conversion                │
│  3. Query clone_user_usergroup_map for group IDs                            │
│  4. Generate sessionToken: base64(userId_username_timestamp_random)         │
│  5. INSERT into unified_sessions table                                      │
│  6. Set KEEPUP_SESSION cookie (httpOnly, 24h expiry)                        │
│  7. Return { ok, sessionToken, user }                                       │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  REACT: AuthContext.tsx (login function)                                    │
│                                                                             │
│  1. Store sessionToken → localStorage.KEEPUP_SESSION_TOKEN                  │
│  2. Store user → localStorage.KEEPUP_USER                                   │
│  3. Set React state: user, token, isAuthenticated=true                      │
│  4. useEffect in Landing.tsx redirects based on groups:                     │
│     └── Admin (6,7,8) → /choose-destination                                │
│     └── Regular → /home                                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

#### 🔑 5.1.2 SESSION TOKEN SOURCES IDENTIFIED

| Source | Token Name | Storage | Expiry | Used By |
|--------|-----------|---------|--------|---------|
| **Node.js Login** | `sessionToken` | `unified_sessions` DB + localStorage | 24h | React app |
| **Node.js Cookie** | `KEEPUP_SESSION` | httpOnly cookie | 24h | Node.js middleware |
| **Admin Login** | `token` (base64) | `global.adminSessions` (MEMORY!) | 24h | Admin dashboard |
| **Joomla Session** | `PHPSESSID` | PHP session + `clone_session` table | varies | Joomla |
| **Auth Sync** | `session_id` (64 char hex) | `auth_sessions` table | 24h | Cross-system |

**⚠️ CRITICAL ISSUES FOUND:**
1. **Admin sessions stored in MEMORY** (`global.adminSessions`) - lost on restart!
2. **THREE different session tables**: `unified_sessions`, `auth_sessions`, `local_sessions`
3. **Joomla session not properly synced** - verifyJoomlaSession() returns first user, not logged-in user!

---

#### 🔐 5.1.3 PASSWORD HASHING ANALYSIS

**Current Implementation (joomla_password.js):**
```
✅ Supports bcrypt ($2y$, $2a$, $2b$)
✅ Supports legacy MD5:salt format
✅ Auto-converts $2y$ → $2a$ for Node.js bcrypt compatibility
✅ New registrations use MD5:salt (Joomla compatible)
```

**⚠️ ISSUE:** New users get MD5:salt hashes, but Joomla 6.0 uses bcrypt by default.
**RECOMMENDATION:** Use bcrypt for new registrations, keep MD5 for legacy verification.

---

#### 🔄 5.1.4 TOKEN VALIDATION LOCATIONS

Token validation happens in **4 DIFFERENT PLACES**:

| Location | Function | What it Validates |
|----------|----------|-------------------|
| `main_server.js:584` | `app.get('/api/auth/check')` | sessionToken from header/cookie/query |
| `main_server.js:500` | `requireJoomlaSession()` middleware | Joomla PHP session cookies |
| `main_server.js:1000` | `requireAdminToken()` middleware | Admin token from memory |
| `auth_sync_client.js:60` | `validateUnifiedSession()` | Calls PHP auth_sync_system |

**⚠️ DUPLICATION:** Same validation logic repeated with slight variations.

---

#### 🔀 5.1.5 AUTH HANDOFF BETWEEN SYSTEMS

```
CURRENT FLOW (Broken/Incomplete):

Joomla Login (PHP)
     │
     ▼ (sets PHPSESSID cookie)
React checks verifyJoomlaSession()
     │
     ▼ (BUG: returns FIRST user, not logged-in user!)
❌ FAILS - Can't get actual Joomla user

─────────────────────────────────────────────

Node.js Login (Works)
     │
     ▼ (generates sessionToken)
Stores in unified_sessions + cookie + localStorage
     │
     ▼ (React reads localStorage)
✅ WORKS - User authenticated in React

─────────────────────────────────────────────

Auth Sync System (PHP) - UNUSED!
     │
     ▼ (auth_sync_client.js tries to call it)
❌ FAILS - URL points to 192.168.15.10 (wrong IP?)
```

---

#### 📋 5.1.6 RECOMMENDED FIXES

**IMMEDIATE (High Priority):**
- [x] 5.1.1 Map complete auth flow diagram ✅ DONE
- [x] 5.1.2 Identify all session token sources ✅ DONE
- [x] 5.1.3 **FIX:** Move admin sessions from memory to database ✅ DONE (Jan 15)
- [x] 5.1.4 **FIX:** Fix verifyJoomlaSession() to get actual logged-in user ✅ DONE (Jan 15)
- [x] 5.1.5 **FIX:** Consolidate 3 session tables into 1 (unified_sessions) ✅ DONE (Jan 15)
      - Removed auth_sync_client.js dependency completely
      - All endpoints now use unified_sessions table in joomlaDb
      - Removed local_sessions table creation
- [x] 5.1.6 **FIX:** Universal DB connection logic, robust fallback, and performance issues resolved (Jan 16, 2026)

**SHORT TERM (Medium Priority):**
- [ ] 5.1.7 Create single requireAuth() middleware that checks all sources
- [ ] 5.1.8 Update password hashing to use bcrypt for new registrations
- [ ] 5.1.9 Remove unused auth_sync_system.php or fix the integration

**LONG TERM (Low Priority):**
- [ ] 5.1.10 Implement refresh tokens for better session management
- [ ] 5.1.11 Add proper JWT with signature verification

---

**Estimated Time:** 4-6 hours with Opus (IMPLEMENTED ✅)

---

### 🔴 5.2 API Layer Restructure
**Complexity:** ⭐⭐⭐⭐⭐ | **Files:** 10+ | **Languages:** 2

**Problem:**
- `main_server.js` has 58 endpoints in one 2,798-line file
- No clear separation of concerns
- Mixed authentication, events, admin, user endpoints
- Duplicate code between similar endpoints

**Files Involved:**
```
/backend/
├── main_server.js      - ALL endpoints (needs splitting)
├── api-gateway.js      - Empty placeholder (4 lines!)
├── unified-auth.js     - Stub file (8 lines!)

/frontend/react-keepup/src/api/
├── unified-api.ts      (500 lines) - Monolithic API layer
├── auth.ts             (104 lines)
├── events.ts           (113 lines)
├── admin.ts            (61 lines)
├── user.ts             (50 lines)
```

**TODO Tasks:**
- [ ] 5.2.1 Create endpoint inventory with categories
- [ ] 5.2.2 Design modular backend structure:
  ```
  /backend/
  ├── routes/
  │   ├── auth.routes.js
  │   ├── events.routes.js
  │   ├── admin.routes.js
  │   ├── user.routes.js
  │   └── crawler.routes.js
  ├── middleware/
  │   ├── auth.middleware.js
  │   └── admin.middleware.js
  ├── controllers/
  │   ├── auth.controller.js
  │   └── events.controller.js
  ```
- [ ] 5.2.3 Extract auth endpoints to separate file
- [ ] 5.2.4 Extract event endpoints
- [ ] 5.2.5 Extract admin endpoints
- [ ] 5.2.6 Unify frontend API layer

**Estimated Time:** 6-8 hours with Opus

---

### 🔴 5.3 Event Fetching Pipeline Analysis
**Complexity:** ⭐⭐⭐⭐⭐ | **Files:** 6+ | **Languages:** 2

**Problem:**
- 3-level hierarchy (Serpents → Wizards → AI) complex to understand
- Multiple fallback mechanisms
- Cache invalidation unclear
- Python ↔ Node.js bridge reliability

**Files Involved:**
```
/backend/
├── fetcher.js              (2257 lines) - Main fetcher
├── api-event-fetcher.js    (1322 lines) - API integrations
├── town-populator.js       (378 lines)  - Town population
├── free-event-sources.js   (481 lines)  - Free APIs

/backend/python/
├── event_serpents.py       (466 lines)  - Async fetching
├── feather_dragon.py       (467 lines)  - DuckDuckGo
├── serpents_bridge.js      (~100 lines) - Node↔Python
```

**TODO Tasks:**
- [ ] 5.3.1 Document complete fetching flow
- [ ] 5.3.2 Map all API sources and their status
- [ ] 5.3.3 Identify caching strategy
- [ ] 5.3.4 Document fallback hierarchy
- [ ] 5.3.5 Test Python serpents reliability
- [ ] 5.3.6 Identify performance bottlenecks

**Estimated Time:** 3-4 hours with Opus

---

### 🔴 5.4 Frontend State Management Audit
**Status:** ✅ Frontend complete (Jan 22, 2026). Audit tasks remain for optional polish; prioritize auth fixes first.
**Complexity:** ⭐⭐⭐⭐⭐ | **Files:** 15+ | **Languages:** 1

**Problem:**
- Only AuthContext exists for state management
- No global event state
- API calls duplicated across components
- No loading/error state standardization

**Files Involved:**
```
/frontend/react-keepup/src/
├── context/
│   └── AuthContext.tsx     (180 lines) - ONLY context!
├── pages/
│   ├── EditProfile.tsx     (558 lines) - Complex state
│   ├── Profile.tsx         (404 lines) - User data
│   ├── Landing.tsx         (335 lines) - Auth state
│   ├── Demo.tsx            (362 lines) - Demo state
│   ├── AdminDashboard.tsx  (112 lines) - Admin state
```

**TODO Tasks:**
- [ ] 5.4.1 Audit all component local states
- [ ] 5.4.2 Design global state architecture
- [ ] 5.4.3 Identify state that should be global:
  - User data
  - Events cache
  - UI state (loading, errors)
  - Admin settings
- [ ] 5.4.4 Plan migration to proper state management
- [ ] 5.4.5 Standardize loading/error patterns

**Estimated Time:** 3-4 hours with Opus

---

## 🟠 LEVEL 4 — OPUS or SONNET (Multi-File, Complex Logic)

### 🟠 4.1 EditProfile.tsx Refactoring
**Complexity:** ⭐⭐⭐⭐ | **Lines:** 558

**Problem:**
- Largest React component
- Complex form state management
- Multiple API calls
- Validation logic mixed with UI

**TODO Tasks:**
- [ ] 4.1.1 Extract form validation to custom hook
- [ ] 4.1.2 Split into smaller components
- [ ] 4.1.3 Create proper form state management
- [ ] 4.1.4 Add proper TypeScript types
- [ ] 4.1.5 Implement proper error handling

**Estimated Time:** 2-3 hours with Sonnet

---

### 🟠 4.2 Profile.tsx Cleanup
**Complexity:** ⭐⭐⭐⭐ | **Lines:** 404

**TODO Tasks:**
- [ ] 4.2.1 Separate display and edit modes
- [ ] 4.2.2 Extract profile data fetching to hook
- [ ] 4.2.3 Add loading skeletons
- [ ] 4.2.4 Improve error states

**Estimated Time:** 2 hours with Sonnet

---

### 🟠 4.3 Landing.tsx Auth Flow
**Complexity:** ⭐⭐⭐⭐ | **Lines:** 335

**TODO Tasks:**
- [ ] 4.3.1 Clean up auth redirect logic
- [ ] 4.3.2 Improve form validation
- [ ] 4.3.3 Add loading states
- [ ] 4.3.4 Handle edge cases (session expiry)

**Estimated Time:** 2 hours with Sonnet

---

### 🟠 4.4 unified-api.ts Restructure
**Complexity:** ⭐⭐⭐⭐ | **Lines:** 500

**TODO Tasks:**
- [ ] 4.4.1 Split by domain (auth, events, admin)
- [ ] 4.4.2 Add proper TypeScript types
- [ ] 4.4.3 Implement request/response interceptors
- [ ] 4.4.4 Standardize error handling
- [ ] 4.4.5 Add request caching

**Estimated Time:** 3 hours with Sonnet

---

### 🟠 4.5 Python Serpents Enhancement
**Complexity:** ⭐⭐⭐⭐ | **Lines:** 466

**TODO Tasks:**
- [ ] 4.5.1 Add retry logic for failed requests
- [ ] 4.5.2 Implement rate limiting
- [ ] 4.5.3 Add new event sources
- [ ] 4.5.4 Improve error handling
- [ ] 4.5.5 Add request logging

**Estimated Time:** 2-3 hours with Sonnet

---

### 🟠 4.6 DuckDuckGo Dragon Improvements
**Complexity:** ⭐⭐⭐⭐ | **Lines:** 467

**TODO Tasks:**
- [ ] 4.6.1 Add more search patterns
- [ ] 4.6.2 Improve result parsing
- [ ] 4.6.3 Add language detection
- [ ] 4.6.4 Implement caching
- [ ] 4.6.5 Handle rate limiting

**Estimated Time:** 2 hours with Sonnet

---

### 🟠 4.7 ProtectedRoute Enhancement
**Complexity:** ⭐⭐⭐⭐ | **Lines:** ~150

**TODO Tasks:**
- [ ] 4.7.1 Add proper TypeScript types
- [ ] 4.7.2 Implement role-based rendering
- [ ] 4.7.3 Add loading states
- [ ] 4.7.4 Handle session expiry gracefully

**Estimated Time:** 1-2 hours with Sonnet

---

## 🟡 LEVEL 3 — SONNET (Single File, Moderate Complexity)

### 🟡 3.1 ChooseDestination.tsx
**Lines:** 164

**TODO Tasks:**
- [ ] 3.1.1 Improve UI/UX
- [ ] 3.1.2 Add animations
- [ ] 3.1.3 Better role detection display

**Estimated Time:** 1 hour with Sonnet

---

### 🟡 3.2 CreateEvent.tsx
**Lines:** 133

**TODO Tasks:**
- [ ] 3.2.1 Add form validation
- [ ] 3.2.2 Add date picker
- [ ] 3.2.3 Add location autocomplete
- [ ] 3.2.4 Improve error handling

**Estimated Time:** 1-2 hours with Sonnet

---

### 🟡 3.3 EventMap.tsx
**Lines:** 129

**TODO Tasks:**
- [ ] 3.3.1 Add map library (Leaflet/Mapbox)
- [ ] 3.3.2 Add event markers
- [ ] 3.3.3 Add clustering for many events
- [ ] 3.3.4 Add location search

**Estimated Time:** 2 hours with Sonnet

---

### 🟡 3.4 AdminDashboard.tsx
**Lines:** 112

**TODO Tasks:**
- [ ] 3.4.1 Add real-time stats
- [ ] 3.4.2 Add charts/graphs
- [ ] 3.4.3 Add admin actions
- [ ] 3.4.4 Improve layout

**Estimated Time:** 1-2 hours with Sonnet

---

### 🟡 3.5 auth.ts API Module
**Lines:** 104

**TODO Tasks:**
- [ ] 3.5.1 Add proper error types
- [ ] 3.5.2 Add request/response logging
- [ ] 3.5.3 Add retry logic
- [ ] 3.5.4 Improve TypeScript types

**Estimated Time:** 1 hour with Sonnet

---

### 🟡 3.6 events.ts API Module
**Lines:** 113

**TODO Tasks:**
- [ ] 3.6.1 Add pagination support
- [ ] 3.6.2 Add filtering options
- [ ] 3.6.3 Add caching
- [ ] 3.6.4 Add proper types

**Estimated Time:** 1 hour with Sonnet

---

### 🟡 3.7 Navigation.tsx
**Lines:** ~100

**TODO Tasks:**
- [ ] 3.7.1 Add mobile responsive menu
- [ ] 3.7.2 Add user dropdown
- [ ] 3.7.3 Add notification badge
- [ ] 3.7.4 Improve accessibility

**Estimated Time:** 1 hour with Sonnet

---

### 🟡 3.8 ai-config.js Backend
**Lines:** 182

**TODO Tasks:**
- [ ] 3.8.1 Add more AI providers
- [ ] 3.8.2 Add provider health checks
- [ ] 3.8.3 Add fallback configuration
- [ ] 3.8.4 Add usage tracking

**Estimated Time:** 1 hour with Sonnet

---

### 🟡 3.9 joomla_password.js
**Lines:** 129

**TODO Tasks:**
- [ ] 3.9.1 Document password hashing
- [ ] 3.9.2 Add migration utilities
- [ ] 3.9.3 Test edge cases

**Estimated Time:** 30 min with Sonnet

---

## 🟢 LEVEL 2 — SONNET or HAIKU (Simple Features)

### 🟢 2.1 Login.tsx Improvements
**Lines:** 77

**TODO Tasks:**
- [ ] 2.1.1 Add "Remember me" checkbox
- [ ] 2.1.2 Add "Forgot password" link
- [ ] 2.1.3 Improve validation messages

**Estimated Time:** 30 min with Haiku

---

### 🟢 2.2 EventGrid.tsx Enhancement
**Lines:** 61

**TODO Tasks:**
- [ ] 2.2.1 Add grid/list toggle
- [ ] 2.2.2 Add sorting options
- [ ] 2.2.3 Add loading skeletons

**Estimated Time:** 30 min with Haiku

---

### 🟢 2.3 JoomlaAdmin.tsx
**Lines:** 81

**TODO Tasks:**
- [ ] 2.3.1 Add iframe loading indicator
- [ ] 2.3.2 Add error handling
- [ ] 2.3.3 Add fullscreen toggle

**Estimated Time:** 20 min with Haiku

---

### 🟢 2.4 NodeAdmin.tsx
**Lines:** 49

**TODO Tasks:**
- [ ] 2.4.1 Add iframe loading indicator
- [ ] 2.4.2 Add error handling

**Estimated Time:** 15 min with Haiku

---

### 🟢 2.5 user.ts API Module
**Lines:** 50

**TODO Tasks:**
- [ ] 2.5.1 Add TypeScript types
- [ ] 2.5.2 Add error handling

**Estimated Time:** 20 min with Haiku

---

### 🟢 2.6 admin.ts API Module
**Lines:** 61

**TODO Tasks:**
- [ ] 2.6.1 Add TypeScript types
- [ ] 2.6.2 Add proper error handling

**Estimated Time:** 20 min with Haiku

---

## 🔵 LEVEL 1 — HAIKU (Quick Fixes, Simple Tasks)

### 🔵 1.1 CSS Files Polish

**TODO Tasks:**
- [ ] 1.1.1 Fix responsive breakpoints in Landing.css
- [ ] 1.1.2 Add dark mode support
- [ ] 1.1.3 Fix button hover states
- [ ] 1.1.4 Add loading animations
- [ ] 1.1.5 Fix mobile navigation

**Estimated Time:** 5-10 min each with Haiku

---

### 🔵 1.2 TypeScript Types

**TODO Tasks:**
- [ ] 1.2.1 Add missing types to types.ts
- [ ] 1.2.2 Fix any types
- [ ] 1.2.3 Add API response types

**Estimated Time:** 5-10 min each with Haiku

---

### 🔵 1.3 Code Comments & Documentation

**TODO Tasks:**
- [ ] 1.3.1 Add JSDoc comments to main functions
- [ ] 1.3.2 Add inline comments for complex logic
- [ ] 1.3.3 Update README files

**Estimated Time:** 5-10 min each with Haiku

---

### 🔵 1.4 Simple Bug Fixes

**TODO Tasks:**
- [ ] 1.4.1 Fix console warnings
- [ ] 1.4.2 Fix ESLint errors
- [ ] 1.4.3 Fix TypeScript strict mode errors

**Estimated Time:** 5-10 min each with Haiku

---

### 🔵 1.5 Environment & Config

**TODO Tasks:**
- [ ] 1.5.1 Update .env.template
- [ ] 1.5.2 Add environment validation
- [ ] 1.5.3 Document all env variables

**Estimated Time:** 10 min with Haiku

---

## 📅 Recommended Work Order

### Week 1: Analysis Phase (OPUS)
```
Day 1-2: Complete 5.1 (Auth System) analysis
Day 3:   Complete 5.2 (API Structure) analysis  
Day 4:   Complete 5.3 (Event Pipeline) documentation
Day 5:   Complete 5.4 (State Management) audit
```

### Week 2: Critical Fixes (OPUS → SONNET)
```
Day 1-2: Implement auth fixes (OPUS guidance, SONNET coding)
Day 3-4: Restructure API layer
Day 5:   Fix critical frontend issues
```

### Week 3: Feature Work (SONNET)
```
Day 1: Level 4 tasks (4.1-4.3)
Day 2: Level 4 tasks (4.4-4.7)
Day 3-4: Level 3 tasks
Day 5: Level 3 tasks
```

### Week 4: Polish (SONNET → HAIKU)
```
Day 1-2: Level 2 tasks (SONNET)
Day 3-5: Level 1 tasks (HAIKU)
```

---

## 🎯 Quick Reference: Task to Model

| Task ID | Description | Model | Time |
|---------|-------------|-------|------|
| 5.1 | Auth System | OPUS | 4-6h |
| 5.2 | API Restructure | OPUS | 6-8h |
| 5.3 | Event Pipeline | OPUS | 3-4h |
| 5.4 | State Management | OPUS | 3-4h |
| 4.1-4.7 | Complex Components | SONNET | 1-3h each |
| 3.1-3.9 | Moderate Components | SONNET | 30min-2h each |
| 2.1-2.6 | Simple Features | HAIKU | 15-30min each |
| 1.1-1.5 | Quick Fixes | HAIKU | 5-10min each |

---

## 📊 Progress Tracker

```
LEVEL 5 (OPUS):     [█████░░░░░] 3/4 complete (5.1 COMPLETE, 5.2 PARTIAL)
LEVEL 4 (SONNET):   [█░░░░░░░░░] 1/7 complete (Serpents service scaffolded)
LEVEL 3 (SONNET):   [░░░░░░░░░░] 0/9 complete
LEVEL 2 (HAIKU):    [░░░░░░░░░░] 0/6 complete
LEVEL 1 (HAIKU):    [░░░░░░░░░░] 0/5 complete

TOTAL:              [████░░░░░░] 4/31 complete (13% → 29% complete)
```

### 🆕 Completion Updates (Jan 19-21, 2026)

**✅ 5.1 Authentication System Overhaul** — COMPLETE
- Unified auth system working across React ↔ Node.js ↔ Joomla
- Session validation tested and verified
- Password hashing supports both legacy and modern algorithms

**✅ 5.2 API Restructure** — PARTIAL (65% complete)
- Serpents service orchestration layer created (Node.js on port 3002)
- HTTP fallback pattern implemented (tries .NET, falls back to fetcher-cli)
- BullMQ job queue with Redis persistence to MariaDB
- Dashboard monitoring interface created
- Status: Ready for Joomla integration and event pipeline work

**✅ 4.1 Microservices Architecture** — SCAFFOLDED (NEW)
- `.NET` `event-serpent` WebAPI (net8.0) with `/api/serpents` endpoint
- `.NET` `auth-proxy` with gRPC and HTTP compatibility
- Multi-stage Docker containerization for both services
- Status: Placeholder implementations ready for real event/auth logic

---

*Last Updated: January 21, 2026*
*Document Version: 1.3*
*Project: KEEP-Up Event Platform*

---

## 📊 Progress Tracker

```
LEVEL 5 (OPUS):     [███░░░░░░░] 2/4 complete (5.1 COMPLETE)
LEVEL 4 (SONNET):   [░░░░░░░░░░] 0/7 complete  
LEVEL 3 (SONNET):   [░░░░░░░░░░] 0/9 complete
LEVEL 2 (HAIKU):    [░░░░░░░░░░] 0/6 complete
LEVEL 1 (HAIKU):    [░░░░░░░░░░] 0/5 complete

TOTAL:              [██░░░░░░░░] 2/31 complete
```

---

*Last Updated: January 21, 2026*
*Document Version: 1.3*
*Project: KEEP-Up Event Platform*

---

## 📋 Recent Automation & .NET Integration (Automat .NET Optimization — Jan 19-21, 2026)

### Phase 1: Frontend & Orchestration (Jan 16-19)
- **Vite Migration:** React 19.2.3 → Vite 5.0.0 dev server on port 3001
  - Skeleton loader component for better UX during data loading
  - Web Worker (`filterWorker.ts`) for client-side event filtering without blocking UI
  - Vite proxy config routes `/api/serpents` → `http://localhost:3002`
- **Serpents Service:** Node.js orchestration layer on port 3002
  - `GET /api/serpents` endpoint tries `.NET` event-serpent first, gracefully falls back to `fetcher-cli.js`
  - Job enqueue: `POST /api/serpents/enqueue` for async processing
  - Dashboard: `GET /dashboard` HTML interface for job history monitoring
  - Worker: BullMQ 2.13.0 with Redis 7 for async job processing

### Phase 2: Async Job Queue & Persistence (Jan 19-20)
- **BullMQ + Redis Setup**
  - Retry policy: 3 attempts with exponential backoff (2s base delay)
  - Results persisted to MariaDB table `serpent_jobs` with schema:
    - `id`, `job_id`, `status`, `source`, `data` (JSON), `created_at`, `completed_at`
  - Job states tracked: pending → active → completed/failed
  - Dashboard aggregates job history for monitoring

### Phase 3: .NET Microservices (Jan 20-21)
- **event-serpent WebAPI** (net8.0)
  - Endpoint: `GET /api/serpents` returns mock event array (placeholder)
  - Endpoint: `GET /health` returns `{ ok: true }` for health checks
  - Multi-stage Dockerfile: builds in SDK 8.0, runs in aspnet 8.0 runtime
  - Port: 5000 (localhost dev), 80 (container), remappable for production
  - Status: Ready for real event aggregation logic integration

- **auth-proxy WebAPI + gRPC** (net8.0)
  - Dual protocol: gRPC `Auth` service + HTTP POST `/api/validate` endpoint
  - HTTP endpoint request: `{ "token": "...", "userId": "..." }`
  - HTTP response: `{ "valid": true/false, "username": "...", "email": "..." }`
  - Placeholder logic: token `dev-token` returns valid user
  - Production path: will integrate with Joomla clone_users table or SSO

### Phase 4: Joomla Integration Bridge (Jan 21)
- **PHP HTTP Client** (`web/joomla_auth_http_client.php`)
  - Function: `validate_token($token, $userId = null, $url = 'http://localhost:5000/api/validate')`
  - Uses curl to POST JSON to .NET endpoint
  - Returns: `['ok' => true/false, 'data' => {...}, 'http_code' => ...]`
  - No external dependencies (standard PHP curl + json)
  - Tested and verified working with dev-token

### Phase 5: Infrastructure & Fixes (Jan 21)
- **React Container Fix**
  - Issue: `package.json` had concatenated JSON objects (Vite scaffold + original merged incorrectly)
  - Fix: Removed duplicate, kept original `react-scripts` 5.0.1 config
  - Result: React dev server now starts successfully on port 3001
  
- **PHP Tooling**
  - Installed `php-cli` and `php-curl` for local endpoint testing
  - Validated HTTP client against .NET auth endpoint
  - Confirmed working: `curl -X POST http://localhost:5000/api/validate`

- **Environment & Database**
  - Verified MySQL connection via TCP (127.0.0.1:3306) instead of socket
  - Created `serpent_jobs` table for job persistence
  - Environment variables configured: `MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD`, `REDIS_URL`

### Architecture Summary
```
User (React 3001)
    ↓ fetch /api/serpents
Vite proxy → localhost:3002
    ↓
Serpents Service (Node.js 3002)
    ├─ Try: HTTP GET http://localhost:5000/api/serpents (.NET)
    └─ Fallback: fetcher-cli.js (legacy Node.js)
    ↓
Results stored in MariaDB serpent_jobs table via BullMQ worker
    ↓
Dashboard at /dashboard for monitoring
```

### Files Modified/Created
```
✅ /frontend/react-keepup/
   ├── package.json (fixed corruption)
   ├── vite.config.ts (created)
   └── src/
       ├── App.tsx (updated for /api/serpents)
       ├── useFilterWorker.ts (new)
       └── filterWorker.ts (new)

✅ /backend/serpents-service/
   ├── index.js (orchestration API)
   ├── worker.js (BullMQ processor)
   ├── package.json (BullMQ, ioredis, mysql2)
   ├── sql/create_serpent_jobs_table.sql (schema)
   └── public/dashboard.html (monitoring)

✅ /dotnet/event-serpent/
   ├── Program.cs (minimal WebAPI)
   ├── EventSerpent.csproj (net8.0)
   └── Dockerfile (multi-stage build)

✅ /dotnet/auth-proxy/
   ├── Program.cs (gRPC + HTTP)
   ├── AuthProxy.csproj (Grpc.Tools, Google.Protobuf)
   ├── Protos/auth.proto (gRPC service definition)
   ├── Services/AuthService.cs (impl)
   └── Dockerfile (multi-stage build)

✅ /web/joomla_auth_http_client.php (new)
   └── validate_token() function
```

**Status:** All integration artifacts present and tested. Project paused per user request pending next phase (event normalization, Joomla component integration, production build).
