package api

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/const/tg-cloud-drive/backend/internal/store"
	"github.com/go-chi/chi/v5"
)

func (s *Server) handleItemContent(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		settings, err := s.getRuntimeSettings(r.Context())
		if err != nil {
			s.logger.Error("get runtime settings failed", "error", err.Error())
			writeError(w, http.StatusInternalServerError, "internal_error", "读取运行配置失败")
			return
		}
		if err := s.acquireDownloadSlot(r.Context(), settings.DownloadConcurrency); err != nil {
			if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
				return
			}
			writeError(w, http.StatusServiceUnavailable, "service_unavailable", "下载队列繁忙，请稍后重试")
			return
		}
		defer s.releaseDownload()
	}

	id, err := parseUUIDParam(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "id 非法")
		return
	}

	st := store.New(s.db)
	it, err := st.GetItem(r.Context(), id)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "文件不存在")
			return
		}
		s.logger.Error("get item failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "查询失败")
		return
	}
	if it.Type == store.ItemTypeFolder {
		writeError(w, http.StatusBadRequest, "bad_request", "文件夹不支持下载")
		return
	}
	if it.InVault {
		if !s.requireVaultUnlocked(w, r) {
			return
		}
	}

	chunks, err := st.ListChunks(r.Context(), it.ID)
	if err != nil {
		s.logger.Error("list chunks failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "查询失败")
		return
	}

	_ = st.TouchItem(r.Context(), it.ID, time.Now())
	s.serveChunkedDownload(w, r, it, chunks)
}

func (s *Server) handleSharedDownload(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		settings, err := s.getRuntimeSettings(r.Context())
		if err != nil {
			s.logger.Error("get runtime settings failed", "error", err.Error())
			writeError(w, http.StatusInternalServerError, "internal_error", "读取运行配置失败")
			return
		}
		if err := s.acquireDownloadSlot(r.Context(), settings.DownloadConcurrency); err != nil {
			if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
				return
			}
			writeError(w, http.StatusServiceUnavailable, "service_unavailable", "下载队列繁忙，请稍后重试")
			return
		}
		defer s.releaseDownload()
	}

	code := strings.TrimSpace(chi.URLParam(r, "code"))
	if code == "" {
		writeError(w, http.StatusNotFound, "not_found", "链接无效")
		return
	}

	st := store.New(s.db)
	it, err := st.GetItemByShareCode(r.Context(), code)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "链接无效或已失效")
			return
		}
		s.logger.Error("get item by share code failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "查询失败")
		return
	}
	if it.InVault {
		writeError(w, http.StatusNotFound, "not_found", "链接无效或已失效")
		return
	}
	if it.Type == store.ItemTypeFolder {
		writeError(w, http.StatusBadRequest, "bad_request", "文件夹暂不支持分享下载")
		return
	}

	chunks, err := st.ListChunks(r.Context(), it.ID)
	if err != nil {
		s.logger.Error("list chunks failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "查询失败")
		return
	}

	_ = st.TouchItem(r.Context(), it.ID, time.Now())
	s.serveChunkedDownload(w, r, it, chunks)
}

func (s *Server) serveChunkedDownload(w http.ResponseWriter, r *http.Request, it store.Item, chunks []store.Chunk) {
	size := it.Size
	if size <= 0 {
		var sum int64
		for _, c := range chunks {
			sum += int64(c.ChunkSize)
		}
		size = sum
	}
	if size < 0 {
		writeError(w, http.StatusInternalServerError, "internal_error", "文件元数据异常")
		return
	}

	br, partial, err := parseSingleRange(r.Header.Get("Range"), size)
	if err != nil {
		switch {
		case errors.Is(err, errMultipleRangesNotAllow):
			w.Header().Set("Accept-Ranges", "bytes")
			w.Header().Set("Content-Range", fmt.Sprintf("bytes */%d", size))
			writeError(w, http.StatusRequestedRangeNotSatisfiable, "range_not_satisfiable", "不支持多段 Range")
		case errors.Is(err, errRangeNotSatisfiable):
			w.Header().Set("Accept-Ranges", "bytes")
			w.Header().Set("Content-Range", fmt.Sprintf("bytes */%d", size))
			writeError(w, http.StatusRequestedRangeNotSatisfiable, "range_not_satisfiable", "Range 不可满足")
		default:
			writeError(w, http.StatusBadRequest, "bad_request", "Range 头非法")
		}
		return
	}

	contentLen := int64(0)
	if br.End >= br.Start {
		contentLen = br.End - br.Start + 1
	}

	download := strings.TrimSpace(r.URL.Query().Get("download")) == "1"
	mimeType := "application/octet-stream"
	if it.MimeType != nil && strings.TrimSpace(*it.MimeType) != "" {
		mimeType = strings.TrimSpace(*it.MimeType)
	}
	inline := !download && isPreviewableMime(mimeType)

	headers := map[string]string{
		"Accept-Ranges":       "bytes",
		"Content-Type":        mimeType,
		"Content-Disposition": contentDisposition(it.Name, inline),
		"ETag":                fmt.Sprintf("W/\"%s-%d\"", it.ID.String(), it.UpdatedAt.Unix()),
	}

	status := http.StatusOK
	if partial {
		status = http.StatusPartialContent
		headers["Content-Range"] = fmt.Sprintf("bytes %d-%d/%d", br.Start, br.End, size)
	}
	if r.Method == http.MethodHead {
		headers["Content-Length"] = strconv.FormatInt(contentLen, 10)
		for k, v := range headers {
			w.Header().Set(k, v)
		}
		w.WriteHeader(status)
		return
	}

	ctx := r.Context()
	var wroteHeader bool

	writeHeaders := func() {
		if wroteHeader {
			return
		}
		for k, v := range headers {
			w.Header().Set(k, v)
		}
		w.Header().Set("Content-Length", strconv.FormatInt(contentLen, 10))
		w.WriteHeader(status)
		wroteHeader = true
	}

	if contentLen == 0 {
		writeHeaders()
		return
	}

	type chunkSpan struct {
		C        store.Chunk
		StartAbs int64
		EndAbs   int64
	}
	spans := make([]chunkSpan, 0, len(chunks))
	var offset int64
	for _, c := range chunks {
		if c.ChunkSize <= 0 {
			continue
		}
		start := offset
		end := offset + int64(c.ChunkSize) - 1
		spans = append(spans, chunkSpan{C: c, StartAbs: start, EndAbs: end})
		offset = end + 1
	}
	if size > 0 && offset < size {
		// 元数据与分块不一致，避免返回错误内容
		s.logger.Error("chunk size mismatch", "item_id", it.ID.String(), "declared_size", size, "sum_chunks", offset)
		writeError(w, http.StatusInternalServerError, "internal_error", "文件分块缺失")
		return
	}

	// 逐块拉取并拼接输出（只支持单 Range）
	remainingStart := br.Start
	remainingEnd := br.End

	fileHTTP := &http.Client{} // 不设置 Timeout，依赖 ctx 取消
	flusher, _ := w.(http.Flusher)
	tgClient := s.telegramClient()
	if tgClient == nil {
		writeError(w, http.StatusServiceUnavailable, "setup_required", "系统尚未初始化，请先完成初始化配置")
		return
	}

	for _, sp := range spans {
		if remainingStart > sp.EndAbs {
			continue
		}
		if remainingEnd < sp.StartAbs {
			break
		}

		subStart := maxInt64(remainingStart, sp.StartAbs) - sp.StartAbs
		subEnd := minInt64(remainingEnd, sp.EndAbs) - sp.StartAbs
		subLen := subEnd - subStart + 1
		if subLen <= 0 {
			continue
		}

		chunkFileID, err := s.ensureChunkFileID(ctx, sp.C)
		if err != nil {
			s.logger.Error(
				"resolve chunk file id failed",
				"error",
				err.Error(),
				"item_id",
				it.ID.String(),
				"chunk_id",
				sp.C.ID.String(),
				"chunk_index",
				sp.C.ChunkIndex,
				"message_id",
				sp.C.TGMessageID,
			)
			if !wroteHeader {
				writeError(w, http.StatusInternalServerError, "internal_error", "文件元数据异常，请重新上传该文件")
			}
			return
		}

		filePath, err := s.getCachedFilePath(ctx, chunkFileID)
		if err != nil {
			s.logger.Error("getFile failed", "error", err.Error())
			if !wroteHeader {
				writeError(w, http.StatusBadGateway, "bad_gateway", "上游文件服务不可用")
			}
			return
		}

		// 自建 Bot API local 模式下，getFile 可能返回容器内绝对路径；
		// 若后端已挂载相同数据卷，优先走本地文件读取，避免 /file 404。
		trimmedPath := strings.TrimSpace(filePath)
		if filepath.IsAbs(trimmedPath) {
			localFile, openErr := os.Open(trimmedPath)
			if openErr == nil {
				if subStart > 0 {
					if _, seekErr := localFile.Seek(subStart, io.SeekStart); seekErr != nil {
						_ = localFile.Close()
						s.logger.Error("seek local telegram file failed", "error", seekErr.Error())
						if !wroteHeader {
							writeError(w, http.StatusBadGateway, "bad_gateway", "上游文件服务异常")
						}
						return
					}
				}

				if !wroteHeader {
					writeHeaders()
				}
				if _, copyErr := io.CopyN(w, localFile, subLen); copyErr != nil {
					_ = localFile.Close()
					s.logger.Error("stream local telegram file failed", "error", copyErr.Error())
					return
				}
				_ = localFile.Close()
				if flusher != nil {
					flusher.Flush()
				}
				continue
			}
		}
		downloadURL := tgClient.DownloadURLFromFilePath(filePath)

		req, err := http.NewRequestWithContext(ctx, http.MethodGet, downloadURL, nil)
		if err != nil {
			if !wroteHeader {
				writeError(w, http.StatusInternalServerError, "internal_error", "请求初始化失败")
			}
			return
		}

		// 尽量对 Telegram file endpoint 也使用 Range，减少带宽；若不支持则回退读/丢弃。
		if subStart != 0 || subEnd != int64(sp.C.ChunkSize-1) {
			req.Header.Set("Range", fmt.Sprintf("bytes=%d-%d", subStart, subEnd))
		}

		resp, err := fileHTTP.Do(req)
		if err != nil {
			s.logger.Error("download chunk failed", "error", err.Error())
			if !wroteHeader {
				writeError(w, http.StatusBadGateway, "bad_gateway", "上游文件服务不可用")
			}
			return
		}

		func() {
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusPartialContent {
				s.logger.Error("telegram file endpoint bad status", "status", resp.StatusCode)
				if !wroteHeader {
					writeError(w, http.StatusBadGateway, "bad_gateway", "上游文件服务异常")
				}
				return
			}

			if !wroteHeader {
				writeHeaders()
			}

			body := resp.Body
			if resp.StatusCode == http.StatusOK && subStart > 0 {
				// Range 不生效，丢弃前置字节
				if _, err := io.CopyN(io.Discard, body, subStart); err != nil {
					s.logger.Error("discard prefix failed", "error", err.Error())
					return
				}
			}

			if _, err := io.CopyN(w, body, subLen); err != nil {
				// 客户端断开也会走到这里，不再额外写错误
				s.logger.Error("stream copy failed", "error", err.Error())
				return
			}

			if flusher != nil {
				flusher.Flush()
			}
		}()

		select {
		case <-ctx.Done():
			return
		default:
		}
	}
}

func (s *Server) ensureChunkFileID(ctx context.Context, c store.Chunk) (string, error) {
	fileID := strings.TrimSpace(c.TGFileID)
	if fileID != "" {
		return fileID, nil
	}

	fromChatID := strings.TrimSpace(c.TGChatID)
	if fromChatID == "" {
		fromChatID = strings.TrimSpace(s.cfg.TGStorageChatID)
	}
	if fromChatID == "" || c.TGMessageID <= 0 {
		return "", errors.New("chunk 缺少 file_id 且消息引用不可用")
	}

	msg, err := s.forwardMessageWithRetry(ctx, s.cfg.TGStorageChatID, fromChatID, c.TGMessageID)
	if err != nil {
		return "", err
	}

	recoveredID := strings.TrimSpace(msg.Document.FileID)
	recoveredUniqueID := strings.TrimSpace(msg.Document.FileUniqueID)
	if recoveredID == "" {
		return "", errors.New("forwardMessage 返回缺少 file_id")
	}

	st := store.New(s.db)
	if err := st.UpdateChunkFileMeta(ctx, c.ID, recoveredID, recoveredUniqueID); err != nil && !errors.Is(err, store.ErrNotFound) {
		s.logger.Warn("update chunk file meta failed", "error", err.Error(), "chunk_id", c.ID.String())
	}

	if msg.MessageID > 0 {
		if err := s.deleteMessageWithRetry(ctx, s.cfg.TGStorageChatID, msg.MessageID); err != nil {
			s.logger.Warn("cleanup forwarded message failed", "error", err.Error(), "message_id", msg.MessageID)
		}
	}

	return recoveredID, nil
}

func maxInt64(a, b int64) int64 {
	if a > b {
		return a
	}
	return b
}

func minInt64(a, b int64) int64 {
	if a < b {
		return a
	}
	return b
}

// 仅用于上传/删除等 sleep；下载链路用 ctx 取消即可。
func sleepWithContext(ctx context.Context, d time.Duration) error {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-t.C:
		return nil
	}
}
