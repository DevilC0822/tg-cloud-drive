package api

import (
	"context"
	"errors"
	"io"
	"os"
	"time"

	"tg-cloud-drive-api/internal/telegram"
)

type uploadPathProgressCallback func(current int64, total int64, speedBytesPerSecond int64)

func (s *Server) sendMediaFromPathWithRetryAndProgress(
	ctx context.Context,
	chatID string,
	fileName string,
	filePath string,
	mimeType string,
	caption string,
	onProgress uploadPathProgressCallback,
) (telegram.Message, *videoUploadProcessMeta, error) {
	kind := selectTelegramUploadKind(fileName, mimeType)
	if kind == telegramUploadKindVideo {
		prepared := s.prepareVideoUploadAssets(ctx, fileName, filePath)
		defer prepared.cleanup()
		previewFallback := false
		msg, err := s.sendFromPathWithKindWithRetryAndProgress(
			ctx,
			chatID,
			prepared.fileName,
			prepared.filePath,
			caption,
			kind,
			prepared.options,
			&previewFallback,
			onProgress,
		)
		prepared.process.PreviewFallback = previewFallback
		return msg, &prepared.process, err
	}
	msg, err := s.sendFromPathWithKindWithRetryAndProgress(ctx, chatID, fileName, filePath, caption, kind, nil, nil, onProgress)
	return msg, nil, err
}

func (s *Server) sendDocumentFromPathWithRetryAndProgress(
	ctx context.Context,
	chatID string,
	fileName string,
	filePath string,
	caption string,
	onProgress uploadPathProgressCallback,
) (telegram.Message, error) {
	return s.sendFromPathWithKindWithRetryAndProgress(
		ctx,
		chatID,
		fileName,
		filePath,
		caption,
		telegramUploadKindDocument,
		nil,
		nil,
		onProgress,
	)
}

func (s *Server) sendFromPathWithKindWithRetryAndProgress(
	ctx context.Context,
	chatID string,
	fileName string,
	filePath string,
	caption string,
	kind telegramUploadKind,
	videoOptions *telegram.SendVideoOptions,
	previewFallback *bool,
	onProgress uploadPathProgressCallback,
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

		size := int64(0)
		if info, statErr := f.Stat(); statErr == nil {
			size = info.Size()
		}
		if onProgress != nil {
			onProgress(0, size, 0)
		}

		reader := newUploadPathProgressReader(f, size, onProgress)
		msg, sendErr := sendTelegramFileByKind(ctx, tgClient, chatID, fileName, reader, caption, kind, videoOptions)
		if sendErr == nil || kind != telegramUploadKindVideo || !hasVideoPreviewOptions(videoOptions) {
			return msg, sendErr
		}
		if previewFallback != nil {
			*previewFallback = true
		}

		if _, seekErr := f.Seek(0, io.SeekStart); seekErr != nil {
			return telegram.Message{}, sendErr
		}
		if onProgress != nil {
			onProgress(0, size, 0)
		}

		return sendTelegramFileByKind(
			ctx,
			tgClient,
			chatID,
			fileName,
			newUploadPathProgressReader(f, size, onProgress),
			caption,
			kind,
			stripVideoPreviewOptions(videoOptions),
		)
	})
}

type uploadPathProgressReader struct {
	source       io.Reader
	total        int64
	onProgress   uploadPathProgressCallback
	currentBytes int64
	lastBytes    int64
	lastSampleAt time.Time
}

func newUploadPathProgressReader(source io.Reader, total int64, onProgress uploadPathProgressCallback) io.Reader {
	if onProgress == nil {
		return source
	}
	return &uploadPathProgressReader{
		source:       source,
		total:        maxInt64(total, 0),
		onProgress:   onProgress,
		lastSampleAt: time.Now(),
	}
}

func (r *uploadPathProgressReader) Read(p []byte) (int, error) {
	n, err := r.source.Read(p)
	if n > 0 {
		r.currentBytes += int64(n)
		now := time.Now()
		elapsedMs := now.Sub(r.lastSampleAt).Milliseconds()
		speed := int64(0)
		if elapsedMs > 0 {
			speed = ((r.currentBytes - r.lastBytes) * 1000) / elapsedMs
		}
		if now.Sub(r.lastSampleAt) >= uploadPhaseProgressSyncInterval || (r.total > 0 && r.currentBytes >= r.total) {
			r.onProgress(r.currentBytes, r.total, maxInt64(speed, 0))
			r.lastBytes = r.currentBytes
			r.lastSampleAt = now
		}
	}
	return n, err
}
