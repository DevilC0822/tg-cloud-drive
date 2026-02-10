CREATE TABLE IF NOT EXISTS system_config (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  tg_bot_token TEXT NOT NULL,
  tg_storage_chat_id TEXT NOT NULL,
  admin_password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
