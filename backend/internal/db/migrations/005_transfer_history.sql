CREATE TABLE IF NOT EXISTS transfer_history (
  id UUID PRIMARY KEY,
  source_task_id TEXT NOT NULL,
  direction TEXT NOT NULL,
  file_id UUID NULL REFERENCES items(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  size BIGINT NOT NULL,
  status TEXT NOT NULL,
  error TEXT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_transfer_history_direction_source_task
ON transfer_history(direction, source_task_id);

CREATE INDEX IF NOT EXISTS idx_transfer_history_finished_at
ON transfer_history(finished_at DESC);

CREATE INDEX IF NOT EXISTS idx_transfer_history_direction_finished
ON transfer_history(direction, finished_at DESC);
