package api

import (
	"context"
	"errors"
	"time"
)

func (s *Server) getCachedFilePath(ctx context.Context, fileID string) (string, error) {
	now := time.Now()

	s.filePathMu.Lock()
	if cached, ok := s.filePathCache[fileID]; ok && cached.ExpiresAt.After(now) && cached.FilePath != "" {
		s.filePathMu.Unlock()
		return cached.FilePath, nil
	}
	s.filePathMu.Unlock()

	tgClient := s.telegramClient()
	if tgClient == nil {
		return "", errors.New("telegram 客户端未初始化")
	}
	f, err := tgClient.GetFile(ctx, fileID)
	if err != nil {
		return "", err
	}

	// 官方文档说明 file_path 至少 1 小时有效，这里保守缓存 55 分钟。
	expires := now.Add(55 * time.Minute)
	s.filePathMu.Lock()
	s.filePathCache[fileID] = cachedFilePath{FilePath: f.FilePath, ExpiresAt: expires}
	s.filePathMu.Unlock()

	return f.FilePath, nil
}
