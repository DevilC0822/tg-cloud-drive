package api

import (
	"context"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
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

func buildChunkFileName(original string, itemID uuid.UUID, idx int) string {
	base := filepath.Base(original)
	ext := filepath.Ext(base)
	name := strings.TrimSuffix(base, ext)
	if name == "" {
		name = "file"
	}
	return fmt.Sprintf("%s.part%05d%s", name+"-"+itemID.String()[:8], idx, ext)
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
	return normalizeMimeType(raw)
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
		return sendTelegramFileByKind(
			ctx,
			tgClient,
			chatID,
			fileName,
			f,
			caption,
			kind,
			stripVideoPreviewOptions(videoOptions),
		)
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
		if sendErr != nil && kind == telegramUploadKindPhoto && isTelegramImageProcessFailed(sendErr) {
			s.logger.Warn(
				"sendPhoto(local_path) failed with image_process_failed, fallback to sendDocument(local_path)",
				"chat_id", chatID,
				"path", filePath,
				"error", sendErr.Error(),
			)
			msg, sendErr = sendTelegramLocalFileByKind(ctx, tgClient, chatID, filePath, caption, telegramUploadKindDocument, nil)
		}
		if sendErr == nil || kind != telegramUploadKindVideo || !hasVideoPreviewOptions(videoOptions) {
			return msg, sendErr
		}
		if previewFallback != nil {
			*previewFallback = true
		}
		return sendTelegramLocalFileByKind(
			ctx,
			tgClient,
			chatID,
			filePath,
			caption,
			kind,
			stripVideoPreviewOptions(videoOptions),
		)
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

func isTelegramImageProcessFailed(err error) bool {
	if err == nil {
		return false
	}
	return strings.Contains(strings.ToLower(err.Error()), "image_process_failed")
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

func stripVideoPreviewOptions(options *telegram.SendVideoOptions) *telegram.SendVideoOptions {
	if options == nil {
		return nil
	}
	next := *options
	next.ThumbnailPath = ""
	next.CoverPath = ""
	return &next
}
