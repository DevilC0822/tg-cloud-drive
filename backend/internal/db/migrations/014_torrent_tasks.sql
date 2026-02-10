CREATE TABLE IF NOT EXISTS torrent_tasks (
  id UUID PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_url TEXT NULL,
  torrent_name TEXT NOT NULL,
  info_hash TEXT NOT NULL,
  torrent_file_path TEXT NOT NULL,
  qb_torrent_hash TEXT NULL,
  target_chat_id TEXT NOT NULL,
  target_parent_id UUID NULL REFERENCES items(id) ON DELETE SET NULL,
  submitted_by TEXT NOT NULL,
  estimated_size BIGINT NOT NULL DEFAULT 0,
  downloaded_bytes BIGINT NOT NULL DEFAULT 0,
  progress DOUBLE PRECISION NOT NULL DEFAULT 0,
  is_private BOOLEAN NOT NULL DEFAULT FALSE,
  tracker_hosts_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL,
  error TEXT NULL,
  started_at TIMESTAMPTZ NULL,
  finished_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_torrent_tasks_status_updated_at
ON torrent_tasks(status, updated_at ASC);

CREATE INDEX IF NOT EXISTS idx_torrent_tasks_created_at
ON torrent_tasks(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_torrent_tasks_info_hash
ON torrent_tasks(info_hash);

CREATE TABLE IF NOT EXISTS torrent_task_files (
  task_id UUID NOT NULL REFERENCES torrent_tasks(id) ON DELETE CASCADE,
  file_index INT NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  selected BOOLEAN NOT NULL DEFAULT FALSE,
  uploaded BOOLEAN NOT NULL DEFAULT FALSE,
  uploaded_item_id UUID NULL REFERENCES items(id) ON DELETE SET NULL,
  error TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (task_id, file_index)
);

CREATE INDEX IF NOT EXISTS idx_torrent_task_files_task_selected_uploaded
ON torrent_task_files(task_id, selected, uploaded, file_index ASC);
