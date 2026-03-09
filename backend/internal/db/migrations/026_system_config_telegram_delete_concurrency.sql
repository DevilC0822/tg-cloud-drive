ALTER TABLE system_config
ADD COLUMN IF NOT EXISTS telegram_delete_concurrency INT NOT NULL DEFAULT 12;
