CREATE TABLE IF NOT EXISTS telegram_delete_failures (
  id UUID PRIMARY KEY,
  item_id UUID NULL,
  item_path TEXT NOT NULL,
  tg_chat_id TEXT NOT NULL,
  tg_message_id BIGINT NOT NULL,
  error_message TEXT NOT NULL,
  retry_count INT NOT NULL DEFAULT 0,
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  failed_at TIMESTAMPTZ NOT NULL,
  last_retry_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tg_delete_failures_chat_message
ON telegram_delete_failures(tg_chat_id, tg_message_id);

CREATE INDEX IF NOT EXISTS idx_tg_delete_failures_resolved_retry
ON telegram_delete_failures(resolved, last_retry_at DESC);

