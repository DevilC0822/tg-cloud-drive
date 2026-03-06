ALTER TABLE system_config
ADD COLUMN IF NOT EXISTS upload_concurrency INT NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS download_concurrency INT NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS reserved_disk_bytes BIGINT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS upload_session_ttl_hours INT NOT NULL DEFAULT 24,
ADD COLUMN IF NOT EXISTS upload_session_cleanup_interval_minutes INT NOT NULL DEFAULT 30,
ADD COLUMN IF NOT EXISTS thumbnail_cache_max_bytes BIGINT NOT NULL DEFAULT 536870912,
ADD COLUMN IF NOT EXISTS thumbnail_cache_ttl_hours INT NOT NULL DEFAULT 720,
ADD COLUMN IF NOT EXISTS thumbnail_generate_concurrency INT NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS vault_password_hash TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS vault_session_ttl_minutes INT NOT NULL DEFAULT 60,
ADD COLUMN IF NOT EXISTS torrent_qbt_password TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS torrent_source_delete_mode TEXT NOT NULL DEFAULT 'immediate',
ADD COLUMN IF NOT EXISTS torrent_source_delete_fixed_minutes INT NOT NULL DEFAULT 30,
ADD COLUMN IF NOT EXISTS torrent_source_delete_random_min_minutes INT NOT NULL DEFAULT 30,
ADD COLUMN IF NOT EXISTS torrent_source_delete_random_max_minutes INT NOT NULL DEFAULT 120;

UPDATE system_config AS sc
SET
  upload_concurrency = rs.upload_concurrency,
  download_concurrency = rs.download_concurrency,
  reserved_disk_bytes = rs.reserved_disk_bytes,
  upload_session_ttl_hours = rs.upload_session_ttl_hours,
  upload_session_cleanup_interval_minutes = rs.upload_session_cleanup_interval_minutes,
  thumbnail_cache_max_bytes = rs.thumbnail_cache_max_bytes,
  thumbnail_cache_ttl_hours = rs.thumbnail_cache_ttl_hours,
  thumbnail_generate_concurrency = rs.thumbnail_generate_concurrency,
  vault_password_hash = rs.vault_password_hash,
  vault_session_ttl_minutes = rs.vault_session_ttl_minutes,
  torrent_qbt_password = rs.torrent_qbt_password,
  torrent_source_delete_mode = rs.torrent_source_delete_mode,
  torrent_source_delete_fixed_minutes = rs.torrent_source_delete_fixed_minutes,
  torrent_source_delete_random_min_minutes = rs.torrent_source_delete_random_min_minutes,
  torrent_source_delete_random_max_minutes = rs.torrent_source_delete_random_max_minutes,
  updated_at = now()
FROM runtime_settings AS rs
WHERE sc.singleton = TRUE
  AND rs.singleton = TRUE;

DROP TABLE IF EXISTS runtime_settings;
