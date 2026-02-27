-- 回收站功能移除后，将历史软删除数据清理并移除 trashed_at 列。
DELETE FROM items
WHERE trashed_at IS NOT NULL;

DROP INDEX IF EXISTS idx_items_parent_trashed_name;
DROP INDEX IF EXISTS idx_items_trashed_at;
DROP INDEX IF EXISTS idx_items_in_vault_trashed;

ALTER TABLE items
  DROP COLUMN IF EXISTS trashed_at;

CREATE INDEX IF NOT EXISTS idx_items_parent_name ON items(parent_id, name);
CREATE INDEX IF NOT EXISTS idx_items_in_vault ON items(in_vault);
