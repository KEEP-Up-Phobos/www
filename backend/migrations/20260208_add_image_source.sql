BEGIN;

-- Add image_source column to record provenance of images
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS image_source VARCHAR(32);

-- Backfill common sources from existing image_url patterns
UPDATE events
SET image_source = CASE
  WHEN image_url LIKE 'https://upload.wikimedia.org/%' THEN 'wikipedia'
  WHEN image_url ILIKE '%ticketmaster%' OR image_url ILIKE '%s1.ticketm%' OR image_url ILIKE '%ticketmaster.com%' THEN 'ticketmaster'
  WHEN image_url LIKE 'https://images.unsplash.com/%' OR image_url LIKE 'https://images.unsplash%' THEN 'unsplash'
  WHEN image_url ILIKE '%duckduckgo.com/%' OR image_url ILIKE '%duckduckgo%' THEN 'duckduckgo'
  WHEN image_url IS NOT NULL AND image_url <> '' THEN 'legacy'
  ELSE NULL
END
WHERE image_url IS NOT NULL AND (image_source IS NULL OR image_source = '');

-- Add an index for fast queries by source
CREATE INDEX IF NOT EXISTS idx_events_image_source ON events(image_source);

COMMIT;
