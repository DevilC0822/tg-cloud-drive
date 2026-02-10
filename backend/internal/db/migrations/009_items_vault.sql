ALTER TABLE items
ADD COLUMN IF NOT EXISTS in_vault BOOL NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_items_in_vault_trashed
ON items(in_vault, trashed_at);
