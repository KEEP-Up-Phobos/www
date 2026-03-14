# KEEP-Up Changes — 2026-01-24

Summary of work performed on 2026-01-24 (local development / networking / frontend fixes).

Key outcomes
- Declared a canonical local host ("THE MARKET"): 192.168.15.8 — added to `copilot-instructions.md` and `ARCHITECTURE.md`.
- Added an **Agent Decision Policy** to `copilot-instructions.md` requiring agents to choose the single most secure and viable option (avoid presenting many equivalent choices).
- Implemented runtime host discovery and fallbacks:
  - Added `/var/www/KEEP-Up/docker/probe_hosts.sh` (tries primary `192.168.15.8`, then `localhost`, `127.0.0.1`, `0.0.0.0`).
  - Updated startup scripts to use the probe helper: `docker/start-all.sh`, `start-all(dev).sh`, `start-all(frontend).sh`.
- Converted various runtime scripts and helpers to probe candidate hosts rather than hardcoding `localhost`:
  - Patched `/var/www/KEEP-Up/scripts/auth_integration.sh` and `auth_integration.js` to probe candidate API hosts.
  - Patched Python helpers in `/home/phobos/.config/ai-assistant/` (`populate_all_cities.py`, `ai_ozzy.py`) to try primary IP then fallbacks.
  - Updated README/docs referencing API/React to prefer `192.168.15.8` and list fallbacks (several files under `/var/www/KEEP-Up/docker/` and `/home/phobos/.config/ai-assistant/`).
- Rebuilt and restarted the React container (image rebuilt and `keepup_react` started).
- Ran integration tests (`/var/www/KEEP-Up/scripts/auth_integration.sh`) — register → login → check succeeded. Cookie jar: `/tmp/keepup_integration_cookies`.

Notes / Observations
- After the startup changes I ran `sudo ./docker/start-all.sh`. MariaDB and PHP started successfully; the React health check timed out once (script exit code 1). The React container was rebuilt earlier and `keepup_react` was started, but the startup probe timed out once — recommend checking `docker logs keepup_react` if React fails to respond in the browser.
- Many documentation and helper files contained `localhost`/`127.0.0.1` references; these were updated to prefer `192.168.15.8` and mention fallbacks. If you prefer a different canonical IP or a domain later, update `THE MARKET` entry and the probe list.

Files added/modified (not exhaustive)
- Added: `docker/probe_hosts.sh`
- Modified: `/.github/copilot-instructions.md` (Agent Decision Policy + THE MARKET)
- Modified: `documentation/ARCHITECTURE.md` (THE MARKET section)
- Modified: `docker/start-all.sh`, `docker/start-all(dev).sh`, `docker/start-all(frontend).sh`
- Modified: `scripts/auth_integration.sh`, `scripts/auth_integration.js`
- Modified: `frontend` build/rebuild triggered; `keepup_react` container rebuilt and started
- Modified: various docs under `docker/` and `documentation/` and ai-assistant helpers

Next recommended steps
1. Tail React logs to diagnose the health check timeout:
   - `docker logs -f keepup_react`
2. If React build failed, rebuild the image and restart:
   - `cd docker && docker-compose build react && docker-compose up -d react`
3. Verify browser login at `http://192.168.15.8:3001` and ensure API calls go to `http://192.168.15.8:3002` (or that the frontend discovers the API via the probe logic).
4. Optional: Replace remaining `curl`/`wget` instances in non-healthcheck scripts to use `probe_hosts.sh` for consistent behavior across hosts.

If you want, I can add a short `README_THE_MARKET.md` in `documentation/` to formalize the local development expectations for new contributors.

— Summary generated automatically by the agent on 2026-01-24
