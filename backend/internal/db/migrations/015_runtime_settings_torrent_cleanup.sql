ALTER TABLE runtime_settings
ADD COLUMN IF NOT EXISTS torrent_qbt_password TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS torrent_source_delete_mode TEXT NOT NULL DEFAULT 'immediate',
ADD COLUMN IF NOT EXISTS torrent_source_delete_fixed_minutes INT NOT NULL DEFAULT 30,
ADD COLUMN IF NOT EXISTS torrent_source_delete_random_min_minutes INT NOT NULL DEFAULT 30,
ADD COLUMN IF NOT EXISTS torrent_source_delete_random_max_minutes INT NOT NULL DEFAULT 120;

UPDATE runtime_settings
SET torrent_source_delete_mode = 'immediate'
WHERE torrent_source_delete_mode NOT IN ('immediate', 'fixed', 'random');

ALTER TABLE torrent_tasks
ADD COLUMN IF NOT EXISTS source_cleanup_due_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS source_cleanup_done BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_torrent_tasks_cleanup_due
ON torrent_tasks(source_cleanup_done, source_cleanup_due_at ASC)
WHERE status = 'completed';
