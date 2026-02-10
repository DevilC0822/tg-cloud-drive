package api

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/const/tg-cloud-drive/backend/internal/store"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

const (
	thumbnailInputMaxBytes int64 = 64 * 1024 * 1024
	thumbnailCaptureAtSec        = "00:00:00.100"
	thumbnailWidthPx             = 480
)

func (s *Server) handleItemThumbnail(w http.ResponseWriter, r *http.Request) {
	id, err := parseUUIDParam(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "id 非法")
		return
	}

	st := store.New(s.db)
	item, err := st.GetItem(r.Context(), id)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "文件不存在")
			return
		}
		s.logger.Error("get item failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "查询失败")
		return
	}
	if item.Type != store.ItemTypeVideo {
		writeError(w, http.StatusBadRequest, "bad_request", "仅视频文件支持首帧缩略图")
		return
	}
	if item.InVault {
		if !s.requireVaultUnlocked(w, r) {
			return
		}
	}

	settings, err := s.getRuntimeSettings(r.Context())
	if err != nil {
		s.logger.Error("get runtime settings failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "读取运行配置失败")
		return
	}

	cacheTTL := thumbnailCacheTTLFromHours(settings.ThumbnailCacheTTLHours)
	cachePath, err := s.thumbnailCachePath(item)
	if err != nil {
		s.logger.Error("resolve thumbnail cache path failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "缩略图缓存初始化失败")
		return
	}

	if s.tryServeThumbnailFromCache(w, r, cachePath, cacheTTL) {
		return
	}

	cacheKey := s.thumbnailCacheKey(item)
	leader, wait := s.beginThumbnailGeneration(cacheKey)
	if !leader {
		select {
		case <-wait:
			if s.tryServeThumbnailFromCache(w, r, cachePath, cacheTTL) {
				return
			}
			writeError(w, http.StatusBadGateway, "bad_gateway", "缩略图生成失败")
			return
		case <-r.Context().Done():
			return
		}
	}
	defer s.finishThumbnailGeneration(cacheKey)

	if err := s.acquireThumbnailGenerateSlot(r.Context(), settings.ThumbnailGenerateConcurrency); err != nil {
		if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
			return
		}
		writeError(w, http.StatusServiceUnavailable, "service_unavailable", "缩略图任务队列繁忙，请稍后重试")
		return
	}
	defer s.releaseThumbnailGenerate()

	if err := s.generateAndCacheVideoThumbnail(r.Context(), item, cachePath); err != nil {
		var execErr *exec.Error
		if errors.As(err, &execErr) && strings.Contains(strings.ToLower(execErr.Error()), "executable file not found") {
			writeError(w, http.StatusServiceUnavailable, "service_unavailable", "ffmpeg 未安装，无法生成视频缩略图")
			return
		}
		s.logger.Warn(
			"generate thumbnail failed",
			"error", err.Error(),
			"item_id", item.ID.String(),
			"path", item.Path,
		)
		writeError(w, http.StatusBadGateway, "bad_gateway", "视频缩略图生成失败")
		return
	}

	go s.cleanupThumbnailCache(cacheTTL, settings.ThumbnailCacheMaxBytes)

	if s.tryServeThumbnailFromCache(w, r, cachePath, cacheTTL) {
		return
	}
	writeError(w, http.StatusBadGateway, "bad_gateway", "视频缩略图读取失败")
}

func (s *Server) thumbnailCacheKey(item store.Item) string {
	return fmt.Sprintf("%s-%d", item.ID.String(), item.UpdatedAt.Unix())
}

func (s *Server) thumbnailCacheDir() string {
	if strings.TrimSpace(s.cfg.ThumbnailCacheDir) != "" {
		return strings.TrimSpace(s.cfg.ThumbnailCacheDir)
	}
	return filepath.Join(os.TempDir(), "tgcd-thumbnail-cache")
}

func (s *Server) thumbnailCachePath(item store.Item) (string, error) {
	dir := s.thumbnailCacheDir()
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	return filepath.Join(dir, s.thumbnailCacheKey(item)+".jpg"), nil
}

func (s *Server) tryServeThumbnailFromCache(
	w http.ResponseWriter,
	r *http.Request,
	cachePath string,
	ttl time.Duration,
) bool {
	info, err := os.Stat(cachePath)
	if err != nil || info.IsDir() {
		return false
	}
	if ttl > 0 && time.Since(info.ModTime()) > ttl {
		_ = os.Remove(cachePath)
		return false
	}

	now := time.Now()
	_ = os.Chtimes(cachePath, now, now)

	w.Header().Set("Content-Type", "image/jpeg")
	w.Header().Set("Cache-Control", "private, max-age=300")
	http.ServeFile(w, r, cachePath)
	return true
}

func (s *Server) beginThumbnailGeneration(key string) (bool, <-chan struct{}) {
	s.thumbGenMu.Lock()
	defer s.thumbGenMu.Unlock()

	if wait, ok := s.thumbGenerating[key]; ok {
		return false, wait
	}

	wait := make(chan struct{})
	s.thumbGenerating[key] = wait
	return true, wait
}

func (s *Server) finishThumbnailGeneration(key string) {
	s.thumbGenMu.Lock()
	wait, ok := s.thumbGenerating[key]
	if ok {
		delete(s.thumbGenerating, key)
	}
	s.thumbGenMu.Unlock()
	if ok {
		close(wait)
	}
}

func (s *Server) generateAndCacheVideoThumbnail(ctx context.Context, item store.Item, cachePath string) error {
	inputPath, err := s.downloadVideoPrefixToTempFile(ctx, item.ID, thumbnailInputMaxBytes)
	if err != nil {
		return err
	}
	defer os.Remove(inputPath)

	outTmp, err := os.CreateTemp(filepath.Dir(cachePath), "tgcd-thumb-*.jpg")
	if err != nil {
		return err
	}
	outPath := outTmp.Name()
	_ = outTmp.Close()
	defer os.Remove(outPath)

	filter := fmt.Sprintf("scale=min(%d\\,iw):-2", thumbnailWidthPx)
	cmd := exec.CommandContext(
		ctx,
		s.cfg.FFmpegBinary,
		"-hide_banner",
		"-loglevel", "error",
		"-y",
		"-ss", thumbnailCaptureAtSec,
		"-i", inputPath,
		"-frames:v", "1",
		"-vf", filter,
		"-q:v", "4",
		outPath,
	)
	if out, runErr := cmd.CombinedOutput(); runErr != nil {
		msg := strings.TrimSpace(string(out))
		if msg == "" {
			return runErr
		}
		return fmt.Errorf("ffmpeg 执行失败: %w: %s", runErr, msg)
	}

	stat, err := os.Stat(outPath)
	if err != nil {
		return err
	}
	if stat.Size() <= 0 {
		return errors.New("ffmpeg 未生成有效缩略图")
	}

	if err := os.Rename(outPath, cachePath); err != nil {
		return err
	}
	return nil
}

func (s *Server) downloadVideoPrefixToTempFile(ctx context.Context, itemID uuid.UUID, maxBytes int64) (string, error) {
	if maxBytes <= 0 {
		maxBytes = thumbnailInputMaxBytes
	}

	st := store.New(s.db)
	chunks, err := st.ListChunks(ctx, itemID)
	if err != nil {
		return "", err
	}
	if len(chunks) == 0 {
		return "", errors.New("视频分块不存在")
	}

	tmpFile, err := os.CreateTemp("", "tgcd-thumb-src-*.bin")
	if err != nil {
		return "", err
	}
	defer tmpFile.Close()

	httpClient := &http.Client{}
	tgClient := s.telegramClient()
	if tgClient == nil {
		return "", errors.New("telegram 客户端未初始化")
	}
	remain := maxBytes

	for _, chunk := range chunks {
		if remain <= 0 {
			break
		}
		if chunk.ChunkSize <= 0 {
			continue
		}

		chunkNeed := int64(chunk.ChunkSize)
		if chunkNeed > remain {
			chunkNeed = remain
		}
		if chunkNeed <= 0 {
			continue
		}

		fileID, err := s.ensureChunkFileID(ctx, chunk)
		if err != nil {
			return "", err
		}
		filePath, err := s.getCachedFilePath(ctx, fileID)
		if err != nil {
			return "", err
		}

		// 自建 Bot API local 模式下优先读取本地绝对路径，避免 /file 404。
		trimmedPath := strings.TrimSpace(filePath)
		if filepath.IsAbs(trimmedPath) {
			localFile, openErr := os.Open(trimmedPath)
			if openErr == nil {
				written, copyErr := io.CopyN(tmpFile, localFile, chunkNeed)
				_ = localFile.Close()
				if copyErr != nil && !errors.Is(copyErr, io.EOF) {
					return "", copyErr
				}
				if written > 0 {
					remain -= written
				}
				if written < chunkNeed {
					break
				}
				continue
			}
		}

		downloadURL := tgClient.DownloadURLFromFilePath(filePath)
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, downloadURL, nil)
		if err != nil {
			return "", err
		}
		if chunkNeed < int64(chunk.ChunkSize) {
			req.Header.Set("Range", fmt.Sprintf("bytes=0-%d", chunkNeed-1))
		}

		resp, err := httpClient.Do(req)
		if err != nil {
			return "", err
		}
		if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusPartialContent {
			resp.Body.Close()
			return "", fmt.Errorf("上游文件服务状态异常: %d", resp.StatusCode)
		}

		written, copyErr := io.CopyN(tmpFile, resp.Body, chunkNeed)
		resp.Body.Close()
		if copyErr != nil && !errors.Is(copyErr, io.EOF) {
			return "", copyErr
		}
		if written > 0 {
			remain -= written
		}
		if written < chunkNeed {
			break
		}
	}

	info, err := tmpFile.Stat()
	if err != nil {
		return "", err
	}
	if info.Size() <= 0 {
		return "", errors.New("未读取到可用于生成缩略图的视频数据")
	}

	if _, err := tmpFile.Seek(0, io.SeekStart); err != nil {
		return "", err
	}

	return tmpFile.Name(), nil
}
