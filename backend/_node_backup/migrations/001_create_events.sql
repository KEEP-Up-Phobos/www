-- 001_create_events.sql
-- Create PostGIS extension and events table for KEEP-Up

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT,
  provider_event_id TEXT,
  title TEXT,
  city TEXT,
  country TEXT,
  payload JSONB,
  ts TIMESTAMPTZ,
  geom geometry(Point,4326),
  version TEXT DEFAULT '1.0',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- GiST spatial index for fast spatial queries
CREATE INDEX IF NOT EXISTS idx_events_geom_gist ON events USING GIST (geom);

-- Optional GIN index for payload search
CREATE INDEX IF NOT EXISTS idx_events_payload_gin ON events USING GIN (payload);

-- Helper: ensure geometry column populated from lat/lon if present in payload
-- Example update (run after inserting rows with payload.lat/payload.lon):
-- UPDATE events SET geom = ST_SetSRID(ST_MakePoint((payload->>'lon')::double precision, (payload->>'lat')::double precision), 4326) WHERE geom IS NULL AND payload ? 'lat' AND payload ? 'lon';
