# Serpents Orchestration Service

This small service exposes `/api/serpents` and attempts to fetch results from a local .NET service at `http://localhost:5000/api/serpents`. If the .NET service is unavailable it falls back to running the existing `fetcher-cli.js` script from the backend.

Run locally:
```bash
cd /var/www/KEEP-Up/backend/serpents-service
npm install
npm start
```

Health: `GET /health`

Notes:
- The service listens on port `3002` by default. Vite dev server proxies `/api/serpents` to this service.
- Ensure `node` is available and `fetcher-cli.js` exists in `/var/www/KEEP-Up/backend/`.

Async jobs (BullMQ)
- To enqueue an async fetch job (processed by `worker.js`) POST to:
	- `POST /api/serpents/enqueue` → returns `{ enqueued: true, jobId }`
- Worker:
	- Start the worker with: `node worker.js` (requires Redis at `REDIS_URL` or `redis://localhost:6379`).
	- Jobs have `attempts: 3` and exponential backoff (2s base).
