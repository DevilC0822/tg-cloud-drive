CREATE TABLE IF NOT EXISTS items (
  id UUID PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  parent_id UUID NULL,
  path TEXT NOT NULL,
  size BIGINT NOT NULL DEFAULT 0,
  mime_type TEXT NULL,
  is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
  trashed_at TIMESTAMPTZ NULL,
  last_accessed_at TIMESTAMPTZ NULL,
  shared_code TEXT NULL UNIQUE,
  shared_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_items_parent_trashed_name ON items(parent_id, trashed_at, name);
CREATE INDEX IF NOT EXISTS idx_items_trashed_at ON items(trashed_at);
CREATE INDEX IF NOT EXISTS idx_items_favorite_trashed ON items(is_favorite, trashed_at);
CREATE INDEX IF NOT EXISTS idx_items_last_accessed ON items(last_accessed_at);
CREATE INDEX IF NOT EXISTS idx_items_path ON items(path);

CREATE TABLE IF NOT EXISTS telegram_chunks (
  id UUID PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  chunk_size INT NOT NULL,
  tg_chat_id TEXT NOT NULL,
  tg_message_id BIGINT NOT NULL,
  tg_file_id TEXT NOT NULL,
  tg_file_unique_id TEXT NOT NULL,
  sha256 BYTEA NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_telegram_chunks_item_index ON telegram_chunks(item_id, chunk_index);
CREATE INDEX IF NOT EXISTS idx_telegram_chunks_chat_message ON telegram_chunks(tg_chat_id, tg_message_id);

