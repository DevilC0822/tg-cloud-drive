CREATE TABLE IF NOT EXISTS transfer_jobs (
  id UUID PRIMARY KEY,
  direction TEXT NOT NULL,
  source_kind TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  unit_kind TEXT NOT NULL,
  name TEXT NOT NULL,
  target_item_id UUID NULL REFERENCES items(id) ON DELETE SET NULL,
  total_size BIGINT NOT NULL DEFAULT 0,
  item_count INT NOT NULL DEFAULT 1,
  completed_count INT NOT NULL DEFAULT 0,
  error_count INT NOT NULL DEFAULT 0,
  canceled_count INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  last_error TEXT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_transfer_jobs_direction_source
ON transfer_jobs(direction, source_kind, source_ref);

CREATE INDEX IF NOT EXISTS idx_transfer_jobs_finished_at
ON transfer_jobs(finished_at DESC);

CREATE INDEX IF NOT EXISTS idx_transfer_jobs_direction_finished
ON transfer_jobs(direction, finished_at DESC);
