**Integration Roadmap & Architecture**

This document provides a concise high-level architecture and an implementation checklist for integrating the KEEP‑Up Frontend, Backend, Joomla, `ai-assistant` and `ai-cloud` with supplemental .NET services on Debian 13.

**Goals:**
- **Coexistence:** Add .NET services without disrupting existing Node.js/Joomla workflows.
- **Incremental adoption:** Start small (one subsystem) and expand.
- **Diplomacy:** Clear boundaries (ports, connection strings, queues) to avoid resource conflicts.

**High-Level Architecture**

```
[React Frontend] ---(HTTP/REST)---> [Node.js Backend (main_server.js)]
       |                                     |
       |                                     +---> [.NET EventSerpent Service (HTTP)]
       |                                     |
       +---> (Direct calls for specific APIs) +---> [MariaDB keepup_events]
                                                   [MariaDB keepup_db (Joomla clone_)]

[Joomla (PHP/Apache)] <---(gRPC / HTTP/Auth Bridge)---> [.NET Auth Proxy]

[ai-assistant (FastAPI)] <---> [ai-cloud (MicroK8s)] <---> Observability (Prometheus/Grafana/Loki)

Optional: Container boundary via Podman/Docker for each service to avoid package conflicts on Debian.
```

**Key Decisions**
- Reserve ports explicitly: Node.js `3002` (host) / `3000` (container), React `3001`, .NET HTTP `5000`, .NET HTTPS `5001`, FastAPI `8000`.
- Use HTTP/REST for simple interop and gRPC for low-latency auth calls between Joomla and .NET.
- Keep a single source of truth for sessions: `unified_sessions` table; access via services (no direct cross-app writes).
- Containerize .NET and AI services with Podman or Docker to isolate runtime (`dotnet` runtime in container).

**Step‑1 Implementation Checklist (acceptance criteria included)**
- 1.1 Define ports and environment variables in a single `env` spec for local dev. (AC: no port conflicts on local machine)
- 1.2 Create a short README describing the integration pattern and contact endpoints. (AC: README present in `/documentation`)
- 1.3 Scaffold a minimal `.NET WebAPI` project that exposes `/api/serpents` returning a JSON placeholder. (AC: `curl http://localhost:5000/api/serpents` returns 200 + JSON)
- 1.4 Add a fallback call in `fetcher.js` to call the .NET endpoint, and fall back to the existing Node.js logic on error. (AC: fetcher still returns events when .NET is unreachable)
- 1.5 Containerize the .NET service with a simple `Dockerfile` and `podman run` instructions. (AC: container starts and listens on port 5000)
- 1.6 Add basic healthchecks (`/health`) for the .NET service and the FastAPI assistant. (AC: all health endpoints return 200)
- 1.7 Add a short test script to exercise the new path (`scripts/test-integration.sh`). (AC: script runs locally and shows request flows)

**Risks & Mitigations**
- Risk: DB schema contention. Mitigation: read-only first for .NET, then migrate to shared service layer.
- Risk: port collisions. Mitigation: declare ports in repo `env` files and check before startup.
- Risk: package manager conflicts (apt / snap / dotnet). Mitigation: prefer containerized runtimes and avoid installing global runtimes when possible.

**Next actions (immediate)**
- ✅ COMPLETED: Scaffold the Frontend Vite migration starter files and add a `vite.config.ts` with a proxy for `/api/serpents` - React auth refactor complete with modern hooks
- Scaffold the `.NET EventSerpent Service` minimal WebAPI and Dockerfile in `/var/www/KEEP-Up/dotnet/event-serpent/`.

**Acceptance criteria for Step‑1 overall:**
- A minimal integration end‑to‑end exists where the frontend or backend can hit the .NET placeholder and receive a valid JSON response, and the system falls back to legacy Node.js fetcher when the .NET service is down.

---

Document created by integration task runner.

**Happenings (Automat .NET Optimization)**

- Created Vite-based frontend scaffold and added client-side skeleton + web-worker filtering.
- Added `serpents-service` orchestration (Node.js) that calls a local .NET `/api/serpents` and falls back to the legacy `fetcher-cli.js`.
- Implemented BullMQ queue + `worker.js` with Redis support, retry/backoff and persistence to MariaDB (`serpent_jobs`).
- Added a lightweight dashboard at `/dashboard` to inspect recent job runs.
- Scaffolded a `.NET` EventSerpent WebAPI placeholder with `/api/serpents` and a Dockerfile.
- Scaffolded a `.NET` AuthProxy with gRPC and an HTTP compatibility endpoint `/api/validate` for Joomla; added a PHP client `web/joomla_auth_http_client.php`.
- Fixed a broken `package.json` that prevented the React container from starting and restarted the React service.
- Installed `php-cli` for local testing and validated the auth endpoint and PHP client.

State: work paused per request; documentation updated under `/var/www/KEEP-Up/documentation/`.
