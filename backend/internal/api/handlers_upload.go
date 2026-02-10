package api

import (
	"context"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/const/tg-cloud-drive/backend/internal/store"
	"github.com/const/tg-cloud-drive/backend/internal/telegram"
	"github.com/google/uuid"
)

const (
	telegramBotAPIMaxPhotoUploadBytes   int64 = 10 * 1024 * 1024
	telegramBotAPIMaxGeneralUploadBytes int64 = 50 * 1024 * 1024
)

var errUploadMissingFileID = errors.New("upload_missing_file_id")

func (s *Server) handleUploadFile(w http.ResponseWriter, r *http.Request) {
	settings, err := s.getRuntimeSettings(r.Context())
	if err != nil {
		s.logger.Error("get runtime settings failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "读取运行配置失败")
		return
	}
	if err := s.acquireUploadSlot(r.Context(), settings.UploadConcurrency); err != nil {
		if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
			return
		}
		writeError(w, http.StatusServiceUnavailable, "service_unavailable", "上传队列繁忙，请稍后重试")
		return
	}
	defer s.releaseUpload()

	mr, err := r.MultipartReader()
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "请求必须为 multipart/form-data")
		return
	}

	parentRaw := strings.TrimSpace(r.Header.Get("X-TGCD-Parent-Id"))
	chunked := parseBoolLoose(strings.TrimSpace(r.Header.Get("X-TGCD-Chunked")))

	var (
		filePart *multipart.Part
		fileName string
		mimeType string
	)

partLoop:
	for {
		part, nextErr := mr.NextPart()
		if nextErr == io.EOF {
			break
		}
		if nextErr != nil {
			writeError(w, http.StatusBadRequest, "bad_request", "解析上传内容失败")
			return
		}

		formName := strings.TrimSpace(part.FormName())
		switch formName {
		case "parentId":
			if filePart == nil {
				raw, readErr := readSmallPartValue(part, 8<<10)
				_ = part.Close()
				if readErr != nil {
					writeError(w, http.StatusBadRequest, "bad_request", "读取 parentId 失败")
					return
				}
				parentRaw = raw
				continue
			}
		case "chunked":
			if filePart == nil {
				raw, readErr := readSmallPartValue(part, 256)
				_ = part.Close()
				if readErr != nil {
					writeError(w, http.StatusBadRequest, "bad_request", "读取 chunked 失败")
					return
				}
				chunked = parseBoolLoose(raw)
				continue
			}
		case "file":
			if filePart == nil {
				filePart = part
				fileName = strings.TrimSpace(part.FileName())
				mimeType = strings.TrimSpace(part.Header.Get("Content-Type"))
				break partLoop
			}
		}

		_, _ = io.Copy(io.Discard, part)
		_ = part.Close()
	}

	if filePart == nil {
		writeError(w, http.StatusBadRequest, "bad_request", "缺少上传文件字段 file")
		return
	}
	defer filePart.Close()

	if fileName == "" {
		writeError(w, http.StatusBadRequest, "bad_request", "文件名不能为空")
		return
	}

	var parentID *uuid.UUID
	if parentRaw != "" && strings.ToLower(parentRaw) != "null" {
		parsed, err := uuid.Parse(parentRaw)
		if err != nil {
			writeError(w, http.StatusBadRequest, "bad_request", "parentId 非法")
			return
		}
		parentID = &parsed
	}

	chunkSizeLimit := s.cfg.ChunkSizeBytes
	if chunkSizeLimit <= 0 {
		chunkSizeLimit = 20 * 1024 * 1024
	}

	now := time.Now()
	st := store.New(s.db)

	var mimePtr *string
	if mimeType != "" {
		mimePtr = &mimeType
	}
	itemType := store.GuessItemType(fileName, mimeType)

	// 先落库创建 item（size=0），确保 name/path 唯一；失败时再回滚删除。
	it, err := st.CreateFileItem(r.Context(), parentID, itemType, fileName, 0, mimePtr, now)
	if err != nil {
		if errors.Is(err, store.ErrBadInput) {
			writeError(w, http.StatusBadRequest, "bad_request", "参数非法（请确认父目录存在且可用）")
			return
		}
		if errors.Is(err, store.ErrConflict) {
			writeError(w, http.StatusConflict, "conflict", "同一目录下已存在同名文件或文件夹")
			return
		}
		s.logger.Error("create file item failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "创建失败")
		return
	}

	cleanupItem := func(ctx context.Context) {
		_ = st.DeleteItemsByPathPrefix(ctx, it.Path)
	}

	// 关闭分片时：优先尝试单条上传；若失败则自动回退分片上传。
	if !chunked {
		if err := ensureTempSpaceAvailable(settings.ReservedDiskBytes, 1<<20); err != nil {
			cleanupItem(r.Context())
			writeError(w, http.StatusInsufficientStorage, "insufficient_storage", "服务器可用磁盘不足，请稍后重试或调低预留空间")
			return
		}

		tmpFile, err := os.CreateTemp("", "tgcd-upload-single-*")
		if err != nil {
			s.logger.Error("create temp file failed", "error", err.Error())
			cleanupItem(r.Context())
			writeError(w, http.StatusInternalServerError, "internal_error", "创建临时文件失败")
			return
		}
		defer func() {
			_ = os.Remove(tmpFile.Name())
		}()

		fileSize, readErr := copyPartToTempFileWithReserve(filePart, tmpFile, settings.ReservedDiskBytes)
		_ = tmpFile.Close()
		if readErr != nil {
			cleanupItem(r.Context())
			if errors.Is(readErr, errInsufficientTempSpace) {
				writeError(w, http.StatusInsufficientStorage, "insufficient_storage", "服务器可用磁盘不足，请稍后重试或调低预留空间")
				return
			}
			writeError(w, http.StatusBadRequest, "bad_request", "读取上传内容失败")
			return
		}

		if fileSize <= 0 {
			cleanupItem(r.Context())
			writeError(w, http.StatusBadRequest, "bad_request", "空文件不支持上传")
			return
		}

		uploadedChunk := make([]store.Chunk, 0, 1)
		cleanup := func(ctx context.Context) {
			for _, c := range uploadedChunk {
				_ = s.deleteMessageWithRetry(ctx, c.TGChatID, c.TGMessageID)
			}
			cleanupItem(ctx)
		}

		singleUploadLimit := officialBotAPISingleUploadLimitBytes(fileName, mimeType)
		trySingle := fileSize <= singleUploadLimit
		if trySingle {
			caption := fmt.Sprintf("tgcd:%s", it.ID.String())
			msg, uploadProcess, sendErr := s.sendMediaFromPathWithRetry(
				r.Context(),
				s.cfg.TGStorageChatID,
				fileName,
				tmpFile.Name(),
				mimeType,
				caption,
			)
			if sendErr == nil {
				resolvedDoc, docErr := s.resolveMessageDocument(r.Context(), msg)
				if docErr == nil {
					ch := store.Chunk{
						ID:             uuid.New(),
						ItemID:         it.ID,
						ChunkIndex:     0,
						ChunkSize:      int(fileSize),
						TGChatID:       s.cfg.TGStorageChatID,
						TGMessageID:    msg.MessageID,
						TGFileID:       resolvedDoc.FileID,
						TGFileUniqueID: resolvedDoc.FileUniqueID,
						CreatedAt:      now,
					}
					if err := st.InsertChunk(r.Context(), ch); err != nil {
						s.logger.Error("insert chunk failed", "error", err.Error())
						_ = s.deleteMessageWithRetry(r.Context(), ch.TGChatID, ch.TGMessageID)
						cleanupItem(r.Context())
						writeError(w, http.StatusInternalServerError, "internal_error", "写入文件元数据失败")
						return
					}

					if err := st.UpdateItemSize(r.Context(), it.ID, fileSize, time.Now()); err != nil {
						s.logger.Error("update item size failed", "error", err.Error())
						_ = s.deleteMessageWithRetry(r.Context(), ch.TGChatID, ch.TGMessageID)
						cleanupItem(r.Context())
						writeError(w, http.StatusInternalServerError, "internal_error", "更新文件大小失败")
						return
					}

					updated, err := st.GetItem(r.Context(), it.ID)
					if err != nil {
						s.logger.Error("get item failed", "error", err.Error())
						writeError(w, http.StatusInternalServerError, "internal_error", "查询失败")
						return
					}

					writeJSON(w, http.StatusOK, map[string]any{
						"item":          toItemDTO(updated),
						"uploadProcess": toUploadProcessDTO(uploadProcess),
					})
					return
				}

				s.logger.Warn(
					"single upload missing file_id, fallback chunked",
					"item_id", it.ID.String(),
					"message_id", msg.MessageID,
					"error", docErr.Error(),
				)
				if msg.MessageID > 0 {
					_ = s.deleteMessageWithRetry(r.Context(), s.cfg.TGStorageChatID, msg.MessageID)
				}
			} else {
				s.logger.Warn(
					"single upload failed, fallback chunked",
					"item_id", it.ID.String(),
					"file_size", fileSize,
					"error", sendErr.Error(),
				)
			}
		} else {
			s.logger.Info(
				"skip single upload by size, fallback chunked directly",
				"item_id", it.ID.String(),
				"file_size", fileSize,
				"single_limit", singleUploadLimit,
			)
		}

		fallbackChunks, totalBytes, uploadErr := s.uploadChunksFromTempFile(
			r.Context(),
			st,
			it.ID,
			fileName,
			tmpFile.Name(),
			chunkSizeLimit,
			now,
		)
		uploadedChunk = append(uploadedChunk, fallbackChunks...)
		if uploadErr != nil {
			cleanup(r.Context())
			if errors.Is(uploadErr, errUploadMissingFileID) {
				writeError(w, http.StatusBadGateway, "bad_gateway", "上传结果异常（缺少文件标识）")
				return
			}
			s.logger.Error("fallback chunk upload failed", "error", uploadErr.Error())
			writeError(w, http.StatusBadGateway, "bad_gateway", "上传到 Telegram 失败")
			return
		}

		if err := st.UpdateItemSize(r.Context(), it.ID, totalBytes, time.Now()); err != nil {
			s.logger.Error("update item size failed", "error", err.Error())
			cleanup(r.Context())
			writeError(w, http.StatusInternalServerError, "internal_error", "更新文件大小失败")
			return
		}

		updated, err := st.GetItem(r.Context(), it.ID)
		if err != nil {
			s.logger.Error("get item failed", "error", err.Error())
			writeError(w, http.StatusInternalServerError, "internal_error", "查询失败")
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"item":          toItemDTO(updated),
			"uploadProcess": nil,
		})
		return
	}

	var (
		totalBytes    int64
		chunkIndex    int
		uploadedChunk []store.Chunk
	)

	cleanup := func(ctx context.Context) {
		for _, c := range uploadedChunk {
			_ = s.deleteMessageWithRetry(ctx, c.TGChatID, c.TGMessageID)
		}
		_ = st.DeleteItemsByPathPrefix(ctx, it.Path)
	}

	for {
		if err := ensureTempSpaceAvailable(settings.ReservedDiskBytes, chunkSizeLimit); err != nil {
			cleanup(r.Context())
			writeError(w, http.StatusInsufficientStorage, "insufficient_storage", "服务器可用磁盘不足，请稍后重试或调低预留空间")
			return
		}

		tmpFile, err := os.CreateTemp("", "tgcd-upload-*")
		if err != nil {
			s.logger.Error("create temp file failed", "error", err.Error())
			cleanup(r.Context())
			writeError(w, http.StatusInternalServerError, "internal_error", "创建临时文件失败")
			return
		}

		lr := &io.LimitedReader{R: filePart, N: chunkSizeLimit}
		written, copyErr := io.Copy(tmpFile, lr)

		_ = tmpFile.Close()
		if copyErr != nil {
			_ = os.Remove(tmpFile.Name())
			cleanup(r.Context())
			s.logger.Error("read upload failed", "error", fmt.Sprintf("%v", copyErr))
			writeError(w, http.StatusBadRequest, "bad_request", "读取上传内容失败")
			return
		}

		if written == 0 && copyErr == nil {
			// 读到 EOF：上传完成
			_ = os.Remove(tmpFile.Name())
			break
		}
		if written == 0 {
			_ = os.Remove(tmpFile.Name())
			cleanup(r.Context())
			writeError(w, http.StatusBadRequest, "bad_request", "读取上传内容失败")
			return
		}

		chunkFileName := buildChunkFileName(fileName, it.ID, chunkIndex)
		caption := fmt.Sprintf("tgcd:%s:%d", it.ID.String(), chunkIndex)
		msg, err := s.sendDocumentFromPathWithRetry(r.Context(), s.cfg.TGStorageChatID, chunkFileName, tmpFile.Name(), caption)
		_ = os.Remove(tmpFile.Name())
		if err != nil {
			s.logger.Error("sendDocument failed", "error", err.Error())
			cleanup(r.Context())
			writeError(w, http.StatusBadGateway, "bad_gateway", "上传到 Telegram 失败")
			return
		}
		resolvedDoc, docErr := s.resolveMessageDocument(r.Context(), msg)
		if docErr != nil {
			s.logger.Error(
				"sendDocument missing file_id",
				"item_id", it.ID.String(),
				"chunk_index", chunkIndex,
				"message_id", msg.MessageID,
				"error", docErr.Error(),
			)
			if msg.MessageID > 0 {
				_ = s.deleteMessageWithRetry(r.Context(), s.cfg.TGStorageChatID, msg.MessageID)
			}
			cleanup(r.Context())
			writeError(w, http.StatusBadGateway, "bad_gateway", "上传结果异常（缺少文件标识）")
			return
		}

		ch := store.Chunk{
			ID:             uuid.New(),
			ItemID:         it.ID,
			ChunkIndex:     chunkIndex,
			ChunkSize:      int(written),
			TGChatID:       s.cfg.TGStorageChatID,
			TGMessageID:    msg.MessageID,
			TGFileID:       resolvedDoc.FileID,
			TGFileUniqueID: resolvedDoc.FileUniqueID,
			CreatedAt:      now,
		}
		if err := st.InsertChunk(r.Context(), ch); err != nil {
			s.logger.Error("insert chunk failed", "error", err.Error())
			// 块已上传但写库失败：清理 telegram message + 删除 item
			uploadedChunk = append(uploadedChunk, ch)
			cleanup(r.Context())
			writeError(w, http.StatusInternalServerError, "internal_error", "写入分块元数据失败")
			return
		}

		uploadedChunk = append(uploadedChunk, ch)
		totalBytes += written
		chunkIndex++
	}

	if totalBytes <= 0 {
		cleanup(r.Context())
		writeError(w, http.StatusBadRequest, "bad_request", "空文件不支持上传")
		return
	}

	if err := st.UpdateItemSize(r.Context(), it.ID, totalBytes, time.Now()); err != nil {
		s.logger.Error("update item size failed", "error", err.Error())
		cleanup(r.Context())
		writeError(w, http.StatusInternalServerError, "internal_error", "更新文件大小失败")
		return
	}

	updated, err := st.GetItem(r.Context(), it.ID)
	if err != nil {
		s.logger.Error("get item failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "查询失败")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"item":          toItemDTO(updated),
		"uploadProcess": nil,
	})
}

func buildChunkFileName(original string, itemID uuid.UUID, idx int) string {
	base := filepath.Base(original)
	ext := filepath.Ext(base)
	name := strings.TrimSuffix(base, ext)
	if name == "" {
		name = "file"
	}
	return fmt.Sprintf("%s.part%05d%s", name+"-"+itemID.String()[:8], idx, ext)
}

func parseBoolLoose(raw string) bool {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "1", "true", "yes", "y", "on":
		return true
	default:
		return false
	}
}

func readSmallPartValue(part *multipart.Part, max int64) (string, error) {
	b, err := io.ReadAll(io.LimitReader(part, max))
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(b)), nil
}

var errInsufficientTempSpace = errors.New("insufficient_temp_space")

func ensureTempSpaceAvailable(reservedBytes int64, requiredBytes int64) error {
	if reservedBytes < 0 {
		reservedBytes = 0
	}
	if requiredBytes < 0 {
		requiredBytes = 0
	}
	freeBytes, err := getAvailableDiskBytes(os.TempDir())
	if err != nil {
		return err
	}
	if freeBytes-reservedBytes < requiredBytes {
		return errInsufficientTempSpace
	}
	return nil
}

func copyPartToTempFileWithReserve(src io.Reader, dst *os.File, reservedBytes int64) (int64, error) {
	const bufSize = 1024 * 1024
	buf := make([]byte, bufSize)
	var total int64

	for {
		n, readErr := src.Read(buf)
		if n > 0 {
			if err := ensureTempSpaceAvailable(reservedBytes, int64(n)); err != nil {
				return total, err
			}
			written, writeErr := dst.Write(buf[:n])
			if writeErr != nil {
				return total, writeErr
			}
			if written != n {
				return total, io.ErrShortWrite
			}
			total += int64(written)
		}

		if readErr == io.EOF {
			return total, nil
		}
		if readErr != nil {
			return total, readErr
		}
	}
}

func (s *Server) uploadChunksFromTempFile(
	ctx context.Context,
	st *store.Store,
	itemID uuid.UUID,
	originalFileName string,
	tempPath string,
	chunkSizeLimit int64,
	now time.Time,
) ([]store.Chunk, int64, error) {
	if chunkSizeLimit <= 0 {
		chunkSizeLimit = 20 * 1024 * 1024
	}

	file, err := os.Open(tempPath)
	if err != nil {
		return nil, 0, err
	}
	defer file.Close()

	info, err := file.Stat()
	if err != nil {
		return nil, 0, err
	}
	totalSize := info.Size()
	if totalSize <= 0 {
		return nil, 0, nil
	}

	estimatedChunks := int((totalSize + chunkSizeLimit - 1) / chunkSizeLimit)
	uploaded := make([]store.Chunk, 0, estimatedChunks)
	var (
		offset     int64
		chunkIndex int
	)

	for offset < totalSize {
		chunkLen := chunkSizeLimit
		remain := totalSize - offset
		if remain < chunkLen {
			chunkLen = remain
		}

		chunkFileName := buildChunkFileName(originalFileName, itemID, chunkIndex)
		caption := fmt.Sprintf("tgcd:%s:%d", itemID.String(), chunkIndex)
		section := io.NewSectionReader(file, offset, chunkLen)
		msg, sendErr := s.sendDocumentFromReadSeekerWithRetry(ctx, s.cfg.TGStorageChatID, chunkFileName, section, caption)
		if sendErr != nil {
			return uploaded, offset, sendErr
		}

		resolvedDoc, docErr := s.resolveMessageDocument(ctx, msg)
		if docErr != nil {
			s.logger.Error(
				"sendDocument missing file_id",
				"item_id", itemID.String(),
				"chunk_index", chunkIndex,
				"message_id", msg.MessageID,
				"error", docErr.Error(),
			)
			if msg.MessageID > 0 {
				_ = s.deleteMessageWithRetry(ctx, s.cfg.TGStorageChatID, msg.MessageID)
			}
			return uploaded, offset, errUploadMissingFileID
		}

		chunk := store.Chunk{
			ID:             uuid.New(),
			ItemID:         itemID,
			ChunkIndex:     chunkIndex,
			ChunkSize:      int(chunkLen),
			TGChatID:       s.cfg.TGStorageChatID,
			TGMessageID:    msg.MessageID,
			TGFileID:       resolvedDoc.FileID,
			TGFileUniqueID: resolvedDoc.FileUniqueID,
			CreatedAt:      now,
		}
		if err := st.InsertChunk(ctx, chunk); err != nil {
			s.logger.Error("insert chunk failed", "error", err.Error())
			_ = s.deleteMessageWithRetry(ctx, chunk.TGChatID, chunk.TGMessageID)
			return uploaded, offset, err
		}

		uploaded = append(uploaded, chunk)
		offset += chunkLen
		chunkIndex++
	}

	return uploaded, totalSize, nil
}

type telegramUploadKind string

const (
	telegramUploadKindDocument  telegramUploadKind = "document"
	telegramUploadKindPhoto     telegramUploadKind = "photo"
	telegramUploadKindVideo     telegramUploadKind = "video"
	telegramUploadKindAudio     telegramUploadKind = "audio"
	telegramUploadKindAnimation telegramUploadKind = "animation"
)

func normalizeTelegramMimeType(raw string) string {
	normalized := strings.ToLower(strings.TrimSpace(raw))
	if idx := strings.Index(normalized, ";"); idx >= 0 {
		normalized = strings.TrimSpace(normalized[:idx])
	}
	return normalized
}

func selectTelegramUploadKind(fileName string, mimeType string) telegramUploadKind {
	ext := strings.ToLower(strings.TrimSpace(filepath.Ext(fileName)))
	mime := normalizeTelegramMimeType(mimeType)

	switch {
	case isVideoUploadKind(ext, mime):
		return telegramUploadKindVideo
	case isAnimationUploadKind(ext, mime):
		return telegramUploadKindAnimation
	case isPhotoUploadKind(ext, mime):
		return telegramUploadKindPhoto
	case isAudioUploadKind(ext, mime):
		return telegramUploadKindAudio
	default:
		return telegramUploadKindDocument
	}
}

func officialBotAPISingleUploadLimitBytes(fileName string, mimeType string) int64 {
	kind := selectTelegramUploadKind(fileName, mimeType)
	switch kind {
	case telegramUploadKindPhoto:
		return telegramBotAPIMaxPhotoUploadBytes
	default:
		return telegramBotAPIMaxGeneralUploadBytes
	}
}

func isVideoUploadKind(ext string, mime string) bool {
	switch ext {
	case ".mp4", ".mov", ".m4v", ".webm", ".mkv", ".avi", ".mpeg", ".mpg", ".3gp":
		return true
	}
	return strings.HasPrefix(mime, "video/")
}

func isPhotoUploadKind(ext string, mime string) bool {
	switch ext {
	case ".jpg", ".jpeg", ".png", ".webp":
		return true
	}
	switch mime {
	case "image/jpeg", "image/jpg", "image/png", "image/webp":
		return true
	default:
		return false
	}
}

func isAnimationUploadKind(ext string, mime string) bool {
	if ext == ".gif" {
		return true
	}
	return mime == "image/gif"
}

func isAudioUploadKind(ext string, mime string) bool {
	switch ext {
	case ".mp3", ".m4a", ".aac", ".ogg", ".oga", ".flac", ".wav", ".opus":
		return true
	}
	return strings.HasPrefix(mime, "audio/")
}

func (s *Server) sendMediaFromPathWithRetry(
	ctx context.Context,
	chatID string,
	fileName string,
	filePath string,
	mimeType string,
	caption string,
) (telegram.Message, *videoUploadProcessMeta, error) {
	kind := selectTelegramUploadKind(fileName, mimeType)
	if kind == telegramUploadKindVideo {
		prepared := s.prepareVideoUploadAssets(ctx, fileName, filePath)
		defer prepared.cleanup()
		previewFallback := false
		msg, err := s.sendFromPathWithKindWithRetry(
			ctx,
			chatID,
			prepared.fileName,
			prepared.filePath,
			caption,
			kind,
			prepared.options,
			&previewFallback,
		)
		prepared.process.PreviewFallback = previewFallback
		return msg, &prepared.process, err
	}
	msg, err := s.sendFromPathWithKindWithRetry(ctx, chatID, fileName, filePath, caption, kind, nil, nil)
	return msg, nil, err
}

func (s *Server) sendMediaFromLocalPathWithRetry(
	ctx context.Context,
	chatID string,
	fileName string,
	filePath string,
	mimeType string,
	caption string,
) (telegram.Message, *videoUploadProcessMeta, error) {
	kind := selectTelegramUploadKind(fileName, mimeType)
	if kind == telegramUploadKindVideo {
		prepared := s.prepareVideoUploadAssets(ctx, fileName, filePath)
		defer prepared.cleanup()
		previewFallback := false
		msg, err := s.sendFromLocalPathWithKindWithRetry(
			ctx,
			chatID,
			prepared.filePath,
			caption,
			kind,
			prepared.options,
			&previewFallback,
		)
		prepared.process.PreviewFallback = previewFallback
		return msg, &prepared.process, err
	}
	msg, err := s.sendFromLocalPathWithKindWithRetry(ctx, chatID, filePath, caption, kind, nil, nil)
	return msg, nil, err
}

func (s *Server) sendDocumentFromReadSeekerWithRetry(ctx context.Context, chatID string, fileName string, rs io.ReadSeeker, caption string) (telegram.Message, error) {
	return s.sendFromReadSeekerWithKindWithRetry(ctx, chatID, fileName, rs, caption, telegramUploadKindDocument)
}

func (s *Server) sendDocumentFromPathWithRetry(ctx context.Context, chatID string, fileName string, filePath string, caption string) (telegram.Message, error) {
	return s.sendFromPathWithKindWithRetry(ctx, chatID, fileName, filePath, caption, telegramUploadKindDocument, nil, nil)
}

func (s *Server) sendDocumentFromLocalPathWithRetry(ctx context.Context, chatID string, filePath string, caption string) (telegram.Message, error) {
	return s.sendFromLocalPathWithKindWithRetry(ctx, chatID, filePath, caption, telegramUploadKindDocument, nil, nil)
}

func (s *Server) sendFromReadSeekerWithKindWithRetry(
	ctx context.Context,
	chatID string,
	fileName string,
	rs io.ReadSeeker,
	caption string,
	kind telegramUploadKind,
) (telegram.Message, error) {
	tgClient := s.telegramClient()
	if tgClient == nil {
		return telegram.Message{}, errors.New("telegram 客户端未初始化")
	}

	return retryTelegramMessageSend(ctx, func() (telegram.Message, error) {
		if _, err := rs.Seek(0, io.SeekStart); err != nil {
			return telegram.Message{}, err
		}
		return sendTelegramFileByKind(ctx, tgClient, chatID, fileName, rs, caption, kind, nil)
	})
}

func (s *Server) sendFromPathWithKindWithRetry(
	ctx context.Context,
	chatID string,
	fileName string,
	filePath string,
	caption string,
	kind telegramUploadKind,
	videoOptions *telegram.SendVideoOptions,
	previewFallback *bool,
) (telegram.Message, error) {
	tgClient := s.telegramClient()
	if tgClient == nil {
		return telegram.Message{}, errors.New("telegram 客户端未初始化")
	}

	return retryTelegramMessageSend(ctx, func() (telegram.Message, error) {
		f, err := os.Open(filePath)
		if err != nil {
			return telegram.Message{}, err
		}
		defer f.Close()
		msg, sendErr := sendTelegramFileByKind(ctx, tgClient, chatID, fileName, f, caption, kind, videoOptions)
		if sendErr == nil || kind != telegramUploadKindVideo || !hasVideoPreviewOptions(videoOptions) {
			return msg, sendErr
		}
		if previewFallback != nil {
			*previewFallback = true
		}

		if _, seekErr := f.Seek(0, io.SeekStart); seekErr != nil {
			return telegram.Message{}, sendErr
		}
		return sendTelegramFileByKind(ctx, tgClient, chatID, fileName, f, caption, kind, nil)
	})
}

func (s *Server) sendFromLocalPathWithKindWithRetry(
	ctx context.Context,
	chatID string,
	filePath string,
	caption string,
	kind telegramUploadKind,
	videoOptions *telegram.SendVideoOptions,
	previewFallback *bool,
) (telegram.Message, error) {
	tgClient := s.telegramClient()
	if tgClient == nil {
		return telegram.Message{}, errors.New("telegram 客户端未初始化")
	}

	return retryTelegramMessageSend(ctx, func() (telegram.Message, error) {
		msg, sendErr := sendTelegramLocalFileByKind(ctx, tgClient, chatID, filePath, caption, kind, videoOptions)
		if sendErr == nil || kind != telegramUploadKindVideo || !hasVideoPreviewOptions(videoOptions) {
			return msg, sendErr
		}
		if previewFallback != nil {
			*previewFallback = true
		}
		return sendTelegramLocalFileByKind(ctx, tgClient, chatID, filePath, caption, kind, nil)
	})
}

func sendTelegramFileByKind(
	ctx context.Context,
	tgClient *telegram.Client,
	chatID string,
	fileName string,
	r io.Reader,
	caption string,
	kind telegramUploadKind,
	videoOptions *telegram.SendVideoOptions,
) (telegram.Message, error) {
	switch kind {
	case telegramUploadKindPhoto:
		return tgClient.SendPhotoFile(ctx, chatID, fileName, r, caption)
	case telegramUploadKindVideo:
		return tgClient.SendVideoFileWithOptions(ctx, chatID, fileName, r, caption, videoOptions)
	case telegramUploadKindAnimation:
		return tgClient.SendAnimationFile(ctx, chatID, fileName, r, caption)
	case telegramUploadKindAudio:
		return tgClient.SendAudioFile(ctx, chatID, fileName, r, caption)
	default:
		return tgClient.SendDocumentFile(ctx, chatID, fileName, r, caption)
	}
}

func sendTelegramLocalFileByKind(
	ctx context.Context,
	tgClient *telegram.Client,
	chatID string,
	filePath string,
	caption string,
	kind telegramUploadKind,
	videoOptions *telegram.SendVideoOptions,
) (telegram.Message, error) {
	switch kind {
	case telegramUploadKindPhoto:
		return tgClient.SendPhotoByLocalPath(ctx, chatID, filePath, caption)
	case telegramUploadKindVideo:
		return tgClient.SendVideoByLocalPathWithOptions(ctx, chatID, filePath, caption, videoOptions)
	case telegramUploadKindAnimation:
		return tgClient.SendAnimationByLocalPath(ctx, chatID, filePath, caption)
	case telegramUploadKindAudio:
		return tgClient.SendAudioByLocalPath(ctx, chatID, filePath, caption)
	default:
		return tgClient.SendDocumentByLocalPath(ctx, chatID, filePath, caption)
	}
}

func hasVideoPreviewOptions(options *telegram.SendVideoOptions) bool {
	if options == nil {
		return false
	}
	return strings.TrimSpace(options.ThumbnailPath) != "" || strings.TrimSpace(options.CoverPath) != ""
}

func retryTelegramMessageSend(ctx context.Context, fn func() (telegram.Message, error)) (telegram.Message, error) {
	var lastErr error
	for attempt := 0; attempt < 6; attempt++ {
		msg, err := fn()
		if err == nil {
			return msg, nil
		}
		lastErr = err

		var ra telegram.RetryAfterError
		if errors.As(err, &ra) {
			if sleepErr := sleepWithContext(ctx, ra.After); sleepErr != nil {
				return telegram.Message{}, sleepErr
			}
			continue
		}

		backoff := time.Duration(attempt+1) * 500 * time.Millisecond
		if sleepErr := sleepWithContext(ctx, backoff); sleepErr != nil {
			return telegram.Message{}, sleepErr
		}
	}
	return telegram.Message{}, lastErr
}

func (s *Server) deleteMessageWithRetry(ctx context.Context, chatID string, messageID int64) error {
	tgClient := s.telegramClient()
	if tgClient == nil {
		return errors.New("telegram 客户端未初始化")
	}
	var lastErr error
	for attempt := 0; attempt < 5; attempt++ {
		err := tgClient.DeleteMessage(ctx, chatID, messageID)
		if err == nil {
			return nil
		}
		lastErr = err

		var ra telegram.RetryAfterError
		if errors.As(err, &ra) {
			if sleepErr := sleepWithContext(ctx, ra.After); sleepErr != nil {
				return sleepErr
			}
			continue
		}
		backoff := time.Duration(attempt+1) * 300 * time.Millisecond
		if sleepErr := sleepWithContext(ctx, backoff); sleepErr != nil {
			return sleepErr
		}
	}
	return lastErr
}
