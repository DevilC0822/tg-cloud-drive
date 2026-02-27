DROP INDEX IF EXISTS idx_items_favorite_trashed;

ALTER TABLE items
  DROP COLUMN IF EXISTS is_favorite;
