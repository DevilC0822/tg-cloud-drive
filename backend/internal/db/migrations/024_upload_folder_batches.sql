ALTER TABLE upload_sessions
ADD COLUMN IF NOT EXISTS uploaded_chunks_count INT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS upload_folder_batches (
  transfer_batch_id UUID PRIMARY KEY REFERENCES transfer_jobs(id) ON DELETE CASCADE,
  root_name TEXT NOT NULL,
  root_parent_id UUID NULL REFERENCES items(id) ON DELETE SET NULL,
  root_item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  total_directories INT NOT NULL DEFAULT 0,
  total_files INT NOT NULL DEFAULT 0,
  total_size BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_upload_folder_batches_root_item
ON upload_folder_batches(root_item_id);

CREATE TABLE IF NOT EXISTS upload_folder_entries (
  id UUID PRIMARY KEY,
  transfer_batch_id UUID NOT NULL REFERENCES upload_folder_batches(transfer_batch_id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  parent_relative_path TEXT NULL,
  name TEXT NOT NULL,
  depth INT NOT NULL DEFAULT 0,
  size BIGINT NOT NULL DEFAULT 0,
  mime_type TEXT NULL,
  item_id UUID NULL REFERENCES items(id) ON DELETE CASCADE,
  upload_session_id UUID NULL REFERENCES upload_sessions(id) ON DELETE SET NULL,
  status TEXT NOT NULL,
  error TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_upload_folder_entries_batch_relative
ON upload_folder_entries(transfer_batch_id, relative_path);

CREATE UNIQUE INDEX IF NOT EXISTS uq_upload_folder_entries_session
ON upload_folder_entries(upload_session_id)
WHERE upload_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_upload_folder_entries_batch_parent
ON upload_folder_entries(transfer_batch_id, parent_relative_path, name);
