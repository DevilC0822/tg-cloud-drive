package api

import (
	"context"
	"syscall"
	"time"

	"github.com/const/tg-cloud-drive/backend/internal/store"
)

func (s *Server) defaultRuntimeSettings() store.RuntimeSettings {
	ttlHours := int(s.cfg.UploadSessionTTL / time.Hour)
	if ttlHours <= 0 {
		ttlHours = 24
	}
	cleanupIntervalMins := int(s.cfg.UploadSessionCleanupInterval / time.Minute)
	if cleanupIntervalMins <= 0 {
		cleanupIntervalMins = 30
	}
	thumbnailTTLHours := int(s.cfg.ThumbnailCacheTTL / time.Hour)
	if thumbnailTTLHours <= 0 {
		thumbnailTTLHours = 30 * 24
	}

	return store.RuntimeSettings{
		UploadConcurrency:                s.cfg.UploadConcurrencyDefault,
		DownloadConcurrency:              s.cfg.DownloadConcurrencyDefault,
		ReservedDiskBytes:                s.cfg.ReservedDiskBytesDefault,
		UploadSessionTTLHours:            ttlHours,
		UploadSessionCleanupIntervalMins: cleanupIntervalMins,
		ThumbnailCacheMaxBytes:           s.cfg.ThumbnailCacheMaxBytes,
		ThumbnailCacheTTLHours:           thumbnailTTLHours,
		ThumbnailGenerateConcurrency:     s.cfg.ThumbnailGenerateConcurrency,
		VaultPasswordHash:                "",
		VaultSessionTTLMins:              60,
	}
}

func (s *Server) getRuntimeSettings(ctx context.Context) (store.RuntimeSettings, error) {
	return store.New(s.db).GetRuntimeSettings(ctx, s.defaultRuntimeSettings())
}

func (s *Server) tryAcquireUpload(limit int) bool {
	if limit <= 0 {
		limit = 1
	}

	s.transferMu.Lock()
	defer s.transferMu.Unlock()
	if s.activeUploads >= limit {
		return false
	}
	s.activeUploads++
	return true
}

func (s *Server) acquireUploadSlot(ctx context.Context, limit int) error {
	if limit <= 0 {
		limit = 1
	}

	for {
		s.transferMu.Lock()
		if s.activeUploads < limit {
			s.activeUploads++
			s.transferMu.Unlock()
			return nil
		}
		s.transferMu.Unlock()

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(120 * time.Millisecond):
		}
	}
}

func (s *Server) releaseUpload() {
	s.transferMu.Lock()
	defer s.transferMu.Unlock()
	if s.activeUploads > 0 {
		s.activeUploads--
	}
}

func (s *Server) tryAcquireDownload(limit int) bool {
	if limit <= 0 {
		limit = 1
	}

	s.transferMu.Lock()
	defer s.transferMu.Unlock()
	if s.activeDownloads >= limit {
		return false
	}
	s.activeDownloads++
	return true
}

func (s *Server) acquireDownloadSlot(ctx context.Context, limit int) error {
	if limit <= 0 {
		limit = 1
	}

	for {
		s.transferMu.Lock()
		if s.activeDownloads < limit {
			s.activeDownloads++
			s.transferMu.Unlock()
			return nil
		}
		s.transferMu.Unlock()

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(120 * time.Millisecond):
		}
	}
}

func (s *Server) releaseDownload() {
	s.transferMu.Lock()
	defer s.transferMu.Unlock()
	if s.activeDownloads > 0 {
		s.activeDownloads--
	}
}

func (s *Server) acquireThumbnailGenerateSlot(ctx context.Context, limit int) error {
	if limit <= 0 {
		limit = 1
	}

	for {
		s.transferMu.Lock()
		if s.activeThumbnailJobs < limit {
			s.activeThumbnailJobs++
			s.transferMu.Unlock()
			return nil
		}
		s.transferMu.Unlock()

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(120 * time.Millisecond):
		}
	}
}

func (s *Server) releaseThumbnailGenerate() {
	s.transferMu.Lock()
	defer s.transferMu.Unlock()
	if s.activeThumbnailJobs > 0 {
		s.activeThumbnailJobs--
	}
}

func getAvailableDiskBytes(path string) (int64, error) {
	var stat syscall.Statfs_t
	if err := syscall.Statfs(path, &stat); err != nil {
		return 0, err
	}

	return int64(stat.Bavail) * int64(stat.Bsize), nil
}
