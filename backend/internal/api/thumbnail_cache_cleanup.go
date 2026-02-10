package api

import (
	"context"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

const thumbnailCacheCleanupInterval = 30 * time.Minute

type thumbnailFileInfo struct {
	path    string
	size    int64
	modTime time.Time
}

func (s *Server) startThumbnailCacheCleanupLoop() {
	go func() {
		for {
			settings, err := s.getRuntimeSettings(context.Background())
			if err != nil {
				s.logger.Warn("load runtime settings for thumbnail cleanup failed", "error", err.Error())
				settings = s.defaultRuntimeSettings()
			}

			ttl := thumbnailCacheTTLFromHours(settings.ThumbnailCacheTTLHours)
			s.cleanupThumbnailCache(ttl, settings.ThumbnailCacheMaxBytes)
			time.Sleep(thumbnailCacheCleanupInterval)
		}
	}()
}

func thumbnailCacheTTLFromHours(hours int) time.Duration {
	if hours <= 0 {
		hours = 30 * 24
	}
	return time.Duration(hours) * time.Hour
}

func (s *Server) cleanupThumbnailCache(ttl time.Duration, maxBytes int64) {
	if maxBytes < 0 {
		maxBytes = 0
	}
	if ttl <= 0 {
		ttl = 30 * 24 * time.Hour
	}

	dir := s.thumbnailCacheDir()
	if err := os.MkdirAll(dir, 0o755); err != nil {
		s.logger.Warn("create thumbnail cache dir failed", "error", err.Error(), "dir", dir)
		return
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		s.logger.Warn("read thumbnail cache dir failed", "error", err.Error(), "dir", dir)
		return
	}

	now := time.Now()
	files := make([]thumbnailFileInfo, 0, len(entries))
	var totalSize int64

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		name := strings.ToLower(strings.TrimSpace(entry.Name()))
		if !strings.HasSuffix(name, ".jpg") {
			continue
		}

		fullPath := filepath.Join(dir, entry.Name())
		info, statErr := entry.Info()
		if statErr != nil {
			continue
		}

		if ttl > 0 && now.Sub(info.ModTime()) > ttl {
			_ = os.Remove(fullPath)
			continue
		}

		size := info.Size()
		if size < 0 {
			size = 0
		}
		totalSize += size
		files = append(files, thumbnailFileInfo{
			path:    fullPath,
			size:    size,
			modTime: info.ModTime(),
		})
	}

	if maxBytes <= 0 {
		for _, file := range files {
			_ = os.Remove(file.path)
		}
		return
	}

	if totalSize <= maxBytes {
		return
	}

	sort.Slice(files, func(i, j int) bool {
		return files[i].modTime.Before(files[j].modTime)
	})

	for _, file := range files {
		if totalSize <= maxBytes {
			break
		}
		if err := os.Remove(file.path); err != nil {
			continue
		}
		totalSize -= file.size
	}
}
