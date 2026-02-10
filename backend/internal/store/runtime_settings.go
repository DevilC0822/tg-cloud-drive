package store

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

type RuntimeSettings struct {
	UploadConcurrency                int
	DownloadConcurrency              int
	ReservedDiskBytes                int64
	UploadSessionTTLHours            int
	UploadSessionCleanupIntervalMins int
	ThumbnailCacheMaxBytes           int64
	ThumbnailCacheTTLHours           int
	ThumbnailGenerateConcurrency     int
	VaultPasswordHash                string
	VaultSessionTTLMins              int
	UpdatedAt                        time.Time
}

type RuntimeSettingsPatch struct {
	UploadConcurrency                *int
	DownloadConcurrency              *int
	ReservedDiskBytes                *int64
	UploadSessionTTLHours            *int
	UploadSessionCleanupIntervalMins *int
	ThumbnailCacheMaxBytes           *int64
	ThumbnailCacheTTLHours           *int
	ThumbnailGenerateConcurrency     *int
	VaultPasswordHash                *string
	VaultSessionTTLMins              *int
}

func (s *Store) ensureRuntimeSettingsRow(ctx context.Context, defaults RuntimeSettings) error {
	if defaults.UploadConcurrency <= 0 {
		defaults.UploadConcurrency = 1
	}
	if defaults.DownloadConcurrency <= 0 {
		defaults.DownloadConcurrency = 1
	}
	if defaults.ReservedDiskBytes < 0 {
		defaults.ReservedDiskBytes = 0
	}
	if defaults.UploadSessionTTLHours <= 0 {
		defaults.UploadSessionTTLHours = 24
	}
	if defaults.UploadSessionCleanupIntervalMins <= 0 {
		defaults.UploadSessionCleanupIntervalMins = 30
	}
	if defaults.ThumbnailCacheMaxBytes < 0 {
		defaults.ThumbnailCacheMaxBytes = 0
	}
	if defaults.ThumbnailCacheTTLHours <= 0 {
		defaults.ThumbnailCacheTTLHours = 30 * 24
	}
	if defaults.ThumbnailGenerateConcurrency <= 0 {
		defaults.ThumbnailGenerateConcurrency = 1
	}
	if defaults.VaultSessionTTLMins <= 0 {
		defaults.VaultSessionTTLMins = 60
	}

	_, err := s.db.Exec(
		ctx,
		`INSERT INTO runtime_settings(
  singleton,
  upload_concurrency,
  download_concurrency,
  reserved_disk_bytes,
  upload_session_ttl_hours,
  upload_session_cleanup_interval_minutes,
  thumbnail_cache_max_bytes,
  thumbnail_cache_ttl_hours,
  thumbnail_generate_concurrency,
  vault_password_hash,
  vault_session_ttl_minutes,
  updated_at
)
VALUES (TRUE, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
ON CONFLICT (singleton) DO NOTHING`,
		defaults.UploadConcurrency,
		defaults.DownloadConcurrency,
		defaults.ReservedDiskBytes,
		defaults.UploadSessionTTLHours,
		defaults.UploadSessionCleanupIntervalMins,
		defaults.ThumbnailCacheMaxBytes,
		defaults.ThumbnailCacheTTLHours,
		defaults.ThumbnailGenerateConcurrency,
		defaults.VaultPasswordHash,
		defaults.VaultSessionTTLMins,
	)
	return err
}

func (s *Store) GetRuntimeSettings(ctx context.Context, defaults RuntimeSettings) (RuntimeSettings, error) {
	if err := s.ensureRuntimeSettingsRow(ctx, defaults); err != nil {
		return RuntimeSettings{}, err
	}

	var out RuntimeSettings
	err := s.db.QueryRow(
		ctx,
		`SELECT
  upload_concurrency,
  download_concurrency,
  reserved_disk_bytes,
  upload_session_ttl_hours,
  upload_session_cleanup_interval_minutes,
  thumbnail_cache_max_bytes,
  thumbnail_cache_ttl_hours,
  thumbnail_generate_concurrency,
  vault_password_hash,
  vault_session_ttl_minutes,
  updated_at
FROM runtime_settings
WHERE singleton = TRUE`,
	).Scan(
		&out.UploadConcurrency,
		&out.DownloadConcurrency,
		&out.ReservedDiskBytes,
		&out.UploadSessionTTLHours,
		&out.UploadSessionCleanupIntervalMins,
		&out.ThumbnailCacheMaxBytes,
		&out.ThumbnailCacheTTLHours,
		&out.ThumbnailGenerateConcurrency,
		&out.VaultPasswordHash,
		&out.VaultSessionTTLMins,
		&out.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return RuntimeSettings{}, ErrNotFound
		}
		return RuntimeSettings{}, err
	}
	return out, nil
}

func (s *Store) UpdateRuntimeSettings(ctx context.Context, patch RuntimeSettingsPatch, defaults RuntimeSettings) (RuntimeSettings, error) {
	if err := s.ensureRuntimeSettingsRow(ctx, defaults); err != nil {
		return RuntimeSettings{}, err
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return RuntimeSettings{}, err
	}
	defer tx.Rollback(ctx)

	var current RuntimeSettings
	if err := tx.QueryRow(
		ctx,
		`SELECT
  upload_concurrency,
  download_concurrency,
  reserved_disk_bytes,
  upload_session_ttl_hours,
  upload_session_cleanup_interval_minutes,
  thumbnail_cache_max_bytes,
  thumbnail_cache_ttl_hours,
  thumbnail_generate_concurrency,
  vault_password_hash,
  vault_session_ttl_minutes,
  updated_at
FROM runtime_settings
WHERE singleton = TRUE
FOR UPDATE`,
	).Scan(
		&current.UploadConcurrency,
		&current.DownloadConcurrency,
		&current.ReservedDiskBytes,
		&current.UploadSessionTTLHours,
		&current.UploadSessionCleanupIntervalMins,
		&current.ThumbnailCacheMaxBytes,
		&current.ThumbnailCacheTTLHours,
		&current.ThumbnailGenerateConcurrency,
		&current.VaultPasswordHash,
		&current.VaultSessionTTLMins,
		&current.UpdatedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return RuntimeSettings{}, ErrNotFound
		}
		return RuntimeSettings{}, err
	}

	next := current
	if patch.UploadConcurrency != nil {
		next.UploadConcurrency = *patch.UploadConcurrency
	}
	if patch.DownloadConcurrency != nil {
		next.DownloadConcurrency = *patch.DownloadConcurrency
	}
	if patch.ReservedDiskBytes != nil {
		next.ReservedDiskBytes = *patch.ReservedDiskBytes
	}
	if patch.UploadSessionTTLHours != nil {
		next.UploadSessionTTLHours = *patch.UploadSessionTTLHours
	}
	if patch.UploadSessionCleanupIntervalMins != nil {
		next.UploadSessionCleanupIntervalMins = *patch.UploadSessionCleanupIntervalMins
	}
	if patch.ThumbnailCacheMaxBytes != nil {
		next.ThumbnailCacheMaxBytes = *patch.ThumbnailCacheMaxBytes
	}
	if patch.ThumbnailCacheTTLHours != nil {
		next.ThumbnailCacheTTLHours = *patch.ThumbnailCacheTTLHours
	}
	if patch.ThumbnailGenerateConcurrency != nil {
		next.ThumbnailGenerateConcurrency = *patch.ThumbnailGenerateConcurrency
	}
	if patch.VaultPasswordHash != nil {
		next.VaultPasswordHash = *patch.VaultPasswordHash
	}
	if patch.VaultSessionTTLMins != nil {
		next.VaultSessionTTLMins = *patch.VaultSessionTTLMins
	}

	if _, err := tx.Exec(
		ctx,
		`UPDATE runtime_settings
SET upload_concurrency = $1,
    download_concurrency = $2,
    reserved_disk_bytes = $3,
    upload_session_ttl_hours = $4,
    upload_session_cleanup_interval_minutes = $5,
    thumbnail_cache_max_bytes = $6,
    thumbnail_cache_ttl_hours = $7,
    thumbnail_generate_concurrency = $8,
    vault_password_hash = $9,
    vault_session_ttl_minutes = $10,
    updated_at = now()
WHERE singleton = TRUE`,
		next.UploadConcurrency,
		next.DownloadConcurrency,
		next.ReservedDiskBytes,
		next.UploadSessionTTLHours,
		next.UploadSessionCleanupIntervalMins,
		next.ThumbnailCacheMaxBytes,
		next.ThumbnailCacheTTLHours,
		next.ThumbnailGenerateConcurrency,
		next.VaultPasswordHash,
		next.VaultSessionTTLMins,
	); err != nil {
		return RuntimeSettings{}, err
	}

	if err := tx.QueryRow(
		ctx,
		`SELECT
  upload_concurrency,
  download_concurrency,
  reserved_disk_bytes,
  upload_session_ttl_hours,
  upload_session_cleanup_interval_minutes,
  thumbnail_cache_max_bytes,
  thumbnail_cache_ttl_hours,
  thumbnail_generate_concurrency,
  vault_password_hash,
  vault_session_ttl_minutes,
  updated_at
FROM runtime_settings
WHERE singleton = TRUE`,
	).Scan(
		&next.UploadConcurrency,
		&next.DownloadConcurrency,
		&next.ReservedDiskBytes,
		&next.UploadSessionTTLHours,
		&next.UploadSessionCleanupIntervalMins,
		&next.ThumbnailCacheMaxBytes,
		&next.ThumbnailCacheTTLHours,
		&next.ThumbnailGenerateConcurrency,
		&next.VaultPasswordHash,
		&next.VaultSessionTTLMins,
		&next.UpdatedAt,
	); err != nil {
		return RuntimeSettings{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return RuntimeSettings{}, err
	}

	return next, nil
}
