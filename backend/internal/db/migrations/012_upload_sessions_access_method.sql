ALTER TABLE upload_sessions
ADD COLUMN IF NOT EXISTS access_method TEXT NOT NULL DEFAULT 'official_bot_api';
