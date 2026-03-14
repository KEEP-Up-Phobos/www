# PostGIS Query Examples

This file shows bounding-box and Haversine-style queries for radius searches.

## Fast filter using `ST_DWithin` (geography)

Use `ST_DWithin` with `geography` for accurate distance in meters (Haversine) and fast index usage.

Example: find events within `radius_m` meters of `(lat, lon)`:

```sql
-- Parameters: :lat, :lon, :radius_m
SELECT id, title, city, ts, ST_AsText(geom) as geom
FROM events
WHERE geom IS NOT NULL
  AND ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography, :radius_m)
ORDER BY ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography)
LIMIT 100;
```

## Bounding-box pre-filter (cheap) + precise `ST_DWithin`

A bounding-box reduces candidate rows before the more expensive geography check.

```sql
-- approximate degree deltas; 1 deg latitude ~ 111km
-- Compute delta degrees for latitude and longitude given radius
-- This can be done in application code; SQL example below assumes :lat and :lon supplied

WITH params AS (
  SELECT
    :lat::double precision AS lat,
    :lon::double precision AS lon,
    :radius_m::double precision AS radius_m,
    (:radius_m/111000.0) AS lat_delta
)
SELECT e.id, e.title, e.city, e.ts
FROM events e, params p
WHERE e.geom IS NOT NULL
  AND ST_X(e.geom) BETWEEN (p.lon - p.lat_delta) AND (p.lon + p.lat_delta)
  AND ST_Y(e.geom) BETWEEN (p.lat - p.lat_delta) AND (p.lat + p.lat_delta)
  AND ST_DWithin(e.geom::geography, ST_SetSRID(ST_MakePoint(p.lon, p.lat), 4326)::geography, p.radius_m)
ORDER BY ST_Distance(e.geom::geography, ST_SetSRID(ST_MakePoint(p.lon, p.lat), 4326)::geography)
LIMIT 100;
```

## Notes
- Use `geom::geography` to get meters-based distances with `ST_DWithin` and `ST_Distance`.
- GiST index on `geom` speeds up spatial operations; `ST_DWithin` will use the index when possible.
- For very high-throughput scenarios consider pre-bucketing by geohash or tiles and publishing to topic partitions keyed by tile.
