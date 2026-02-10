package api

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	"github.com/const/tg-cloud-drive/backend/internal/store"
	"github.com/google/uuid"
)

const (
	uploadSessionChunkPrefix = "chunk-"
	uploadSessionChunkSuffix = ".part"
)

func normalizeUploadAccessMethod(raw string) string {
	method := strings.TrimSpace(raw)
	if method == setupAccessMethodSelfHosted {
		return setupAccessMethodSelfHosted
	}
	return setupAccessMethodOfficial
}

func (s *Server) resolveUploadAccessMethod(ctx context.Context) (string, error) {
	cfg, err := store.New(s.db).GetSystemConfig(ctx)
	if err != nil {
		return "", err
	}
	return normalizeUploadAccessMethod(cfg.AccessMethod), nil
}

func (s *Server) listUploadedChunkIndicesBySession(ctx context.Context, session store.UploadSession) ([]int, error) {
	if normalizeUploadAccessMethod(session.AccessMethod) == setupAccessMethodSelfHosted {
		return s.listLocalUploadedChunkIndices(session)
	}
	if useLocal, err := s.shouldUseLocalStagingForOfficialSession(ctx, session); err != nil {
		return nil, err
	} else if useLocal {
		return s.listLocalUploadedChunkIndices(session)
	}
	return store.New(s.db).ListUploadedChunkIndices(ctx, session.ItemID)
}

func (s *Server) hasUploadedChunkBySession(ctx context.Context, session store.UploadSession, chunkIndex int) (bool, error) {
	if normalizeUploadAccessMethod(session.AccessMethod) == setupAccessMethodSelfHosted {
		return s.hasLocalSessionChunk(session.ID, chunkIndex)
	}
	if useLocal, err := s.shouldUseLocalStagingForOfficialSession(ctx, session); err != nil {
		return false, err
	} else if useLocal {
		return s.hasLocalSessionChunk(session.ID, chunkIndex)
	}
	return store.New(s.db).HasChunkIndex(ctx, session.ItemID, chunkIndex)
}

func (s *Server) shouldUseLocalStagingForOfficialSession(ctx context.Context, session store.UploadSession) (bool, error) {
	if normalizeUploadAccessMethod(session.AccessMethod) != setupAccessMethodOfficial {
		return false, nil
	}

	// 兼容历史会话：如果已存在 DB 分片，继续沿用旧分片流程。
	dbUploaded, err := store.New(s.db).ListUploadedChunkIndices(ctx, session.ItemID)
	if err != nil {
		return false, err
	}
	if len(dbUploaded) > 0 {
		return false, nil
	}

	limit := officialBotAPISingleUploadLimitBytes(session.FileName, strOrEmpty(session.MimeType))
	return session.FileSize > 0 && session.FileSize <= limit, nil
}

func (s *Server) uploadSessionBaseDir() string {
	baseDir := strings.TrimSpace(s.cfg.SelfHostedBotAPIUploadDir)
	if baseDir == "" {
		baseDir = "/var/lib/tgcd-runtime/self-hosted-bot-api-upload"
	}
	return baseDir
}

func (s *Server) uploadSessionDir(sessionID uuid.UUID) string {
	return filepath.Join(s.uploadSessionBaseDir(), sessionID.String())
}

func (s *Server) uploadSessionChunkDir(sessionID uuid.UUID) string {
	return filepath.Join(s.uploadSessionDir(sessionID), "chunks")
}

func (s *Server) uploadSessionChunkPath(sessionID uuid.UUID, chunkIndex int) string {
	name := fmt.Sprintf("%s%06d%s", uploadSessionChunkPrefix, chunkIndex, uploadSessionChunkSuffix)
	return filepath.Join(s.uploadSessionChunkDir(sessionID), name)
}

func (s *Server) hasLocalSessionChunk(sessionID uuid.UUID, chunkIndex int) (bool, error) {
	_, err := os.Stat(s.uploadSessionChunkPath(sessionID, chunkIndex))
	if err == nil {
		return true, nil
	}
	if errors.Is(err, os.ErrNotExist) {
		return false, nil
	}
	return false, err
}

func (s *Server) saveLocalSessionChunk(session store.UploadSession, chunkIndex int, tempFilePath string) error {
	if err := os.MkdirAll(s.uploadSessionDir(session.ID), 0o755); err != nil {
		return fmt.Errorf("创建上传会话目录失败: %w", err)
	}
	targetDir := s.uploadSessionChunkDir(session.ID)
	if err := os.MkdirAll(targetDir, 0o750); err != nil {
		return fmt.Errorf("创建上传分片目录失败: %w", err)
	}
	targetPath := s.uploadSessionChunkPath(session.ID, chunkIndex)
	if _, err := os.Stat(targetPath); err == nil {
		return store.ErrConflict
	} else if err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}

	if err := moveFile(tempFilePath, targetPath, 0o600); err != nil {
		return err
	}
	return nil
}

func moveFile(src string, dst string, perm os.FileMode) error {
	if err := os.Rename(src, dst); err == nil {
		return os.Chmod(dst, perm)
	}

	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.OpenFile(dst, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, perm)
	if err != nil {
		return err
	}
	defer out.Close()

	if _, err := io.Copy(out, in); err != nil {
		_ = os.Remove(dst)
		return err
	}
	if err := out.Sync(); err != nil {
		_ = os.Remove(dst)
		return err
	}
	if err := os.Remove(src); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	return nil
}

func (s *Server) listLocalUploadedChunkIndices(session store.UploadSession) ([]int, error) {
	chunkDir := s.uploadSessionChunkDir(session.ID)
	entries, err := os.ReadDir(chunkDir)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return []int{}, nil
		}
		return nil, err
	}

	indices := make([]int, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if !strings.HasPrefix(name, uploadSessionChunkPrefix) || !strings.HasSuffix(name, uploadSessionChunkSuffix) {
			continue
		}
		trimmed := strings.TrimSuffix(strings.TrimPrefix(name, uploadSessionChunkPrefix), uploadSessionChunkSuffix)
		idx, parseErr := strconv.Atoi(trimmed)
		if parseErr != nil || idx < 0 || idx >= session.TotalChunks {
			continue
		}
		indices = append(indices, idx)
	}

	sort.Ints(indices)
	return indices, nil
}

func (s *Server) mergeLocalSessionChunks(session store.UploadSession) (string, error) {
	sessionDir := s.uploadSessionDir(session.ID)
	if err := os.MkdirAll(sessionDir, 0o755); err != nil {
		return "", fmt.Errorf("创建会话目录失败: %w", err)
	}

	merged, err := os.CreateTemp(sessionDir, "merged-*")
	if err != nil {
		return "", fmt.Errorf("创建合并文件失败: %w", err)
	}
	mergedPath := merged.Name()
	cleanup := true
	defer func() {
		_ = merged.Close()
		if cleanup {
			_ = os.Remove(mergedPath)
		}
	}()

	var totalWritten int64
	for idx := 0; idx < session.TotalChunks; idx++ {
		chunkPath := s.uploadSessionChunkPath(session.ID, idx)
		chunkFile, openErr := os.Open(chunkPath)
		if openErr != nil {
			return "", fmt.Errorf("读取上传分片失败（index=%d）: %w", idx, openErr)
		}
		written, copyErr := io.Copy(merged, chunkFile)
		_ = chunkFile.Close()
		if copyErr != nil {
			return "", fmt.Errorf("合并上传分片失败（index=%d）: %w", idx, copyErr)
		}
		expected := int64(chunkSizeForIndex(session, idx))
		if expected <= 0 || written != expected {
			return "", fmt.Errorf("上传分片大小异常（index=%d，实际=%d，期望=%d）", idx, written, expected)
		}
		totalWritten += written
	}
	if totalWritten != session.FileSize {
		return "", fmt.Errorf("合并文件大小异常（实际=%d，期望=%d）", totalWritten, session.FileSize)
	}
	if err := merged.Sync(); err != nil {
		return "", err
	}
	if err := merged.Close(); err != nil {
		return "", err
	}
	if err := os.Chmod(mergedPath, 0o644); err != nil {
		return "", err
	}

	cleanup = false
	return mergedPath, nil
}

func (s *Server) clearLocalUploadSession(sessionID uuid.UUID) error {
	if err := os.RemoveAll(s.uploadSessionDir(sessionID)); err != nil {
		return err
	}
	return nil
}
