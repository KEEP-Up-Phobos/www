# EventSerpent (.NET) — placeholder service

This minimal .NET WebAPI provides a placeholder `/api/serpents` endpoint and a `/health` endpoint used for integration testing.

Run locally (requires .NET SDK 8.0):
```bash
cd /var/www/KEEP-Up/dotnet/event-serpent
dotnet run --urls "http://localhost:5000"
```

Build and run with Docker/Podman:
```bash
cd /var/www/KEEP-Up/dotnet/event-serpent
docker build -t keepup-eventserpent .
docker run -p 5000:80 keepup-eventserpent
```

Health check: `GET http://localhost:5000/health`
API: `GET http://localhost:5000/api/serpents`
