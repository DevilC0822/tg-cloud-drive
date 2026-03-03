package api

import (
	"context"
	"errors"
	"time"
)

func (s *Server) getCachedFilePath(ctx context.Context, fileID string) (string, error) {
	meta, err := s.getCachedFileMeta(ctx, fileID)
	if err != nil {
		return "", err
	}
	return meta.FilePath, nil
}

func (s *Server) getCachedFileMeta(ctx context.Context, fileID string) (cachedFilePath, error) {
	now := time.Now()

	s.filePathMu.Lock()
	if cached, ok := s.filePathCache[fileID]; ok && cached.ExpiresAt.After(now) && cached.FilePath != "" {
		s.filePathMu.Unlock()
		return cached, nil
	}
	s.filePathMu.Unlock()

	tgClient := s.telegramClient()
	if tgClient == nil {
		return cachedFilePath{}, errors.New("telegram 客户端未初始化")
	}
	f, err := tgClient.GetFile(ctx, fileID)
	if err != nil {
		return cachedFilePath{}, err
	}

	// 官方文档说明 file_path 至少 1 小时有效，这里保守缓存 55 分钟。
	expires := now.Add(55 * time.Minute)
	cached := cachedFilePath{
		FilePath:  f.FilePath,
		FileSize:  f.FileSize,
		ExpiresAt: expires,
	}
	s.filePathMu.Lock()
	s.filePathCache[fileID] = cached
	s.filePathMu.Unlock()

	return cached, nil
}
