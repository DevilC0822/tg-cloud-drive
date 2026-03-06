ALTER TABLE upload_sessions
ADD COLUMN IF NOT EXISTS transfer_batch_id UUID NULL;

CREATE INDEX IF NOT EXISTS idx_upload_sessions_transfer_batch_id
ON upload_sessions(transfer_batch_id);
