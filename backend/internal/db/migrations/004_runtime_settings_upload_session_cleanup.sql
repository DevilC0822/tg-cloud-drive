ALTER TABLE runtime_settings
ADD COLUMN IF NOT EXISTS upload_session_ttl_hours INT NOT NULL DEFAULT 24,
ADD COLUMN IF NOT EXISTS upload_session_cleanup_interval_minutes INT NOT NULL DEFAULT 30;
