-- ============================================================
-- KEEP-Up — events compatibility VIEW
-- Maps old column names (event_name, event_date, venue_latitude, etc.)
-- to the fetcher_events table schema (name, start_date, latitude, etc.)
-- This allows ALL Node.js queries to work against fetcher data.
-- ============================================================

-- Drop old view if it exists
DROP VIEW IF EXISTS events CASCADE;

-- Create the compatibility view
CREATE OR REPLACE VIEW events AS
SELECT
  e.id,
  e.external_id AS event_key,
  e.name AS event_name,
  e.name AS title,
  e.description,
  e.start_date AS event_date,
  e.end_date,
  e.category,
  e.source,
  e.url AS event_url,
  e.url AS ticket_url,
  e.image_url,
  NULL::text AS image_source,
  e.venue_name,
  COALESCE(v.name, e.venue_name) AS venue_name_full,
  c.name AS venue_city,
  c.country AS venue_country,
  c.country_code,
  e.latitude AS venue_latitude,
  e.longitude AS venue_longitude,
  COALESCE(v.address, '') AS venue_address,
  NULL::text AS artist_name,
  e.latitude,
  e.longitude,
  e.price_min,
  e.price_max,
  e.currency,
  e.city_id,
  e.venue_id,
  e.created_at,
  e.updated_at,
  -- PostGIS geometry for spatial queries (ST_DWithin, ST_Distance)
  ST_SetSRID(ST_MakePoint(e.longitude, e.latitude), 4326)::geometry AS geom
FROM fetcher_events e
LEFT JOIN fetcher_cities c ON e.city_id = c.id
LEFT JOIN fetcher_venues v ON e.venue_id = v.id;
