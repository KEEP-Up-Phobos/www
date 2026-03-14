# .NET Microservices Documentation

## Overview

As of January 22, 2026, KEEP-Up has been extended with .NET 8.0 microservices for improved performance and modularity. Two primary services have been implemented and fully tested.

## Services Implemented

### 1. Event-Serpent (`/dotnet/event-serpent/`)

**Purpose:** High-performance event fetching service with API integrations.

**Technology Stack:**
- ASP.NET Core 8.0 Minimal API
- HttpClient for external API calls
- Docker containerization
- JSON serialization with System.Text.Json

**Key Features:**
- Ticketmaster Discovery API v2 integration
- Mock data fallback for development/testing
- Performance metrics in responses
- Health check endpoint

**API Endpoints:**
- `GET /health` - Service health check
- `GET /api/serpents` - Fetch events with timing data

**Response Format:**
```json
{
  "events": [
    {
      "name": "Sample Event",
      "date": "2026-01-22",
      "venue": "Sample Venue",
      "city": "Sample City"
    }
  ],
  "total": 1,
  "time_seconds": 0.5,
  "errors": 0
}
```

**Docker Commands:**
```bash
# Build
docker-compose build dotnet-eventserpent

# Run
docker-compose up -d dotnet-eventserpent

# Test
curl http://localhost:5000/api/serpents
```

### 2. Auth-Proxy (`/dotnet/auth-proxy/`)

**Purpose:** Authentication proxy service with gRPC and HTTP support.

**Technology Stack:**
- ASP.NET Core 8.0 WebAPI
- gRPC with protobuf definitions
- HTTP compatibility endpoints
- Docker containerization

**Key Features:**
- gRPC AuthService for high-performance auth
- HTTP validation endpoint for compatibility
- Placeholder JWT validation logic
- Extensible for future auth providers

**API Endpoints:**
- `POST /api/validate` - HTTP auth validation
- gRPC AuthService.ValidateToken
- gRPC AuthService.AuthenticateUser

**Response Format (HTTP):**
```json
{
  "valid": true,
  "username": "devuser",
  "email": "dev@local"
}
```

**Docker Commands:**
```bash
# Build
docker-compose build dotnet-authproxy

# Run
docker-compose up -d dotnet-authproxy

# Test
curl -X POST http://localhost:5001/api/validate -H "Content-Type: application/json" -d "{}"
```

## Integration with Node.js Backend

### Serpents-Service Orchestration

The Node.js serpents-service (`/backend/serpents-service/index.js`) acts as an orchestration layer:

1. **Primary Path:** Calls .NET event-serpent service first
2. **Fallback:** If .NET unavailable, calls legacy Node.js fetcher-cli.js
3. **Port:** Runs on 3003 to avoid conflicts
4. **Dependencies:** Express, axios, mysql2 (BullMQ commented out for stability)

**Orchestration Flow:**
```
Frontend Request → Serpents-Service (3003)
    ↓
Try .NET event-serpent (5000)
    ↓ (if fails)
Legacy fetcher-cli.js
    ↓
Return events to frontend
```

## Docker Compose Integration

Updated `docker-compose.yml` includes:

```yaml
dotnet-eventserpent:
  build: ./dotnet/event-serpent
  ports:
    - "5000:80"
  networks:
    - keepup_network

dotnet-authproxy:
  build: ./dotnet/auth-proxy
  ports:
    - "5001:80"
  networks:
    - keepup_network
```

## Development Notes

- **Environment:** Debian 13 with Docker support
- **.NET Version:** 8.0 LTS
- **Container Images:** Multi-stage builds for optimization
- **Health Checks:** Implemented for both services
- **Testing:** All services tested with curl commands

## Future Extensions

- Add more .NET services for other domains (/frontend, /web)
- Implement full JWT authentication in auth-proxy
- Add Redis caching layer
- Expand API integrations in event-serpent
- Add monitoring and logging

## Troubleshooting

- **Service not starting:** Check Docker logs with `docker-compose logs dotnet-eventserpent`
- **API returns errors:** Verify .env configuration and API keys
- **Port conflicts:** Ensure ports 5000 and 5001 are available
- **Orchestration fails:** Check serpents-service logs and Docker network connectivity</content>
<parameter name="filePath">/var/www/KEEP-Up/documentation/DOTNET_SERVICES.md