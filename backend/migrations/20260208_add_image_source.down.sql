BEGIN;

DROP INDEX IF EXISTS idx_events_image_source;
ALTER TABLE events DROP COLUMN IF EXISTS image_source;

COMMIT;
