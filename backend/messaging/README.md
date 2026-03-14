Messaging prototype (RabbitMQ)

This prototype demonstrates publishing compact event envelopes from Node and consuming them with a lightweight Node consumer that can optionally filter by location.

Prerequisites
- Docker (for RabbitMQ)
- Node 18+ and npm

Start RabbitMQ (in repo root):

```bash
docker compose -f docker/docker-compose.messaging.yml up -d
```

Install dependencies:

```bash
cd backend/messaging
npm install
```

Run consumer (optionally filter by lat/lon/radius in meters):

```bash
# no filter - prints all messages
npm run start:consumer

# filter for São Paulo coordinates within 5km
FILTER_LAT=-23.55052 FILTER_LON=-46.633308 FILTER_RADIUS_M=5000 npm run start:consumer
```

Publish one or more sample events:

```bash
# publish once
npm run start:publisher

# publish 100 events quickly
TIMES=100 npm run start:publisher
```

Environment variables
- `RABBIT_URL` - AMQP connection string (defaults to `amqp://keepup:keepup_pass@localhost:5672`)
- `EXCHANGE` - exchange name (defaults to `keepup.events`)
- `ROUTING_KEY` - routing key used by publisher (defaults to `event.created`)
- `QUEUE` - queue name used by consumer (defaults to `keepup.events.consumer`)

Next steps
- Replace the Node consumer with a BEAM (Elixir/Phoenix) consumer that binds the same exchange and performs per-user in-memory subscriptions keyed by geohash/tiles.
- Add idempotency and deduplication (message id tracking) and schema validation against `backend/schemas/event-envelope.json`.
