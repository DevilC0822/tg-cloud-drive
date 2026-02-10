CREATE TABLE IF NOT EXISTS upload_sessions (
  id UUID PRIMARY KEY,
  item_id UUID NOT NULL UNIQUE REFERENCES items(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  mime_type TEXT NULL,
  file_size BIGINT NOT NULL,
  chunk_size INT NOT NULL,
  total_chunks INT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_upload_sessions_status_updated ON upload_sessions(status, updated_at DESC);
