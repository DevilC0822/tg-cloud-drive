CREATE TABLE IF NOT EXISTS runtime_settings (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  upload_concurrency INT NOT NULL,
  download_concurrency INT NOT NULL,
  reserved_disk_bytes BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
