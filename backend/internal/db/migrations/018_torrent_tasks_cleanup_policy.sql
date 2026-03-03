ALTER TABLE torrent_tasks
ADD COLUMN IF NOT EXISTS source_cleanup_policy TEXT NOT NULL DEFAULT 'immediate';

UPDATE torrent_tasks
SET source_cleanup_policy = 'never'
WHERE source_cleanup_done = FALSE
  AND source_cleanup_due_at IS NULL
  AND status IN ('completed', 'uploading', 'error');

UPDATE torrent_tasks
SET source_cleanup_policy = 'immediate'
WHERE source_cleanup_policy NOT IN ('never', 'immediate', 'fixed', 'random');
