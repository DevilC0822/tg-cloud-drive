ALTER TABLE runtime_settings
ADD COLUMN IF NOT EXISTS vault_password_hash TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS vault_session_ttl_minutes INT NOT NULL DEFAULT 60;

