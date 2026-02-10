ALTER TABLE system_config
ADD COLUMN IF NOT EXISTS tg_api_base_url TEXT NULL;

