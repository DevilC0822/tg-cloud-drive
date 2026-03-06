ALTER TABLE upload_sessions
ADD COLUMN IF NOT EXISTS upload_mode TEXT NULL;
