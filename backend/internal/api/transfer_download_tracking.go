package api

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/const/tg-cloud-drive/backend/internal/store"
	"github.com/google/uuid"
)

const (
	downloadTransferPublishInterval  = 250 * time.Millisecond
	downloadTransferPublishStepBytes = 256 * 1024
)

type downloadTransferTracker struct {
	server             *Server
	job                store.TransferJob
	itemID             uuid.UUID
	totalSize          int64
	writtenBytes       int64
	lastPublishedAt    time.Time
	lastPublishedBytes int64
}

type countingTransferResponseWriter struct {
	http.ResponseWriter
	tracker *downloadTransferTracker
}

func (s *Server) prepareDownloadTransferTracking(
	ctx context.Context,
	r *http.Request,
	item store.Item,
) (*downloadTransferTracker, error) {
	if r.Method != http.MethodGet {
		return nil, nil
	}
	rawTransferID := strings.TrimSpace(r.URL.Query().Get("transferId"))
	if rawTransferID == "" {
		return nil, nil
	}

	transferID, err := uuid.Parse(rawTransferID)
	if err != nil {
		return nil, errors.New("transferId 非法")
	}
	job, err := store.New(s.db).GetTransferJobByID(ctx, transferID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			return nil, errors.New("传输任务不存在")
		}
		return nil, err
	}
	if job.Direction != store.TransferDirectionDownload || job.SourceKind != store.TransferSourceKindDownloadTask {
		return nil, errors.New("transferId 不属于下载任务")
	}
	if job.TargetItemID == nil || *job.TargetItemID != item.ID {
		return nil, errors.New("transferId 与文件不匹配")
	}
	if job.Status != store.TransferJobStatusRunning {
		return nil, errors.New("下载任务已结束")
	}

	tracker := &downloadTransferTracker{
		server:             s,
		job:                job,
		itemID:             item.ID,
		totalSize:          maxInt64(job.TotalSize, 0),
		lastPublishedAt:    time.Now(),
		lastPublishedBytes: -1,
	}
	s.setDownloadTransferProgress(job.ID, item.ID, tracker.totalSize, 0)
	s.publishRunningTransferJob(ctx, job)
	return tracker, nil
}

func (t *downloadTransferTracker) wrap(w http.ResponseWriter) http.ResponseWriter {
	return &countingTransferResponseWriter{ResponseWriter: w, tracker: t}
}

func (t *downloadTransferTracker) recordWrite(bytes int) {
	if bytes <= 0 {
		return
	}
	t.writtenBytes += int64(bytes)
	t.server.setDownloadTransferProgress(t.job.ID, t.itemID, t.totalSize, t.writtenBytes)
	t.publishProgress(false)
}

func (t *downloadTransferTracker) publishProgress(force bool) {
	now := time.Now()
	if !force {
		bytesDelta := t.writtenBytes - t.lastPublishedBytes
		if now.Sub(t.lastPublishedAt) < downloadTransferPublishInterval && bytesDelta < downloadTransferPublishStepBytes {
			return
		}
	}
	t.lastPublishedAt = now
	t.lastPublishedBytes = t.writtenBytes
	t.server.publishRunningTransferJob(context.Background(), t.job)
}

func (t *downloadTransferTracker) finish(err error) {
	if t == nil {
		return
	}

	status := store.TransferJobStatusCompleted
	completedCount, errorCount, canceledCount := 1, 0, 0
	lastError := (*string)(nil)
	if err != nil {
		status = store.TransferJobStatusError
		completedCount, errorCount, canceledCount = 0, 1, 0
		if isClientDisconnectError(err) || errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
			status = store.TransferJobStatusCanceled
			completedCount, errorCount, canceledCount = 0, 0, 1
		} else {
			lastError = normalizeTransferHistoryError(err.Error())
		}
	}
	if status == store.TransferJobStatusCompleted {
		t.server.setDownloadTransferProgress(t.job.ID, t.itemID, t.totalSize, t.totalSize)
		t.publishProgress(true)
	}

	_ = store.New(t.server.db).UpdateTransferJobProgress(
		context.Background(),
		t.job.ID,
		completedCount,
		errorCount,
		canceledCount,
		status,
		lastError,
		time.Now(),
	)
	t.server.clearDownloadTransferProgress(t.job.ID)
	t.server.syncTransferJobByID(context.Background(), t.job.ID)
}

func isClientDisconnectError(err error) bool {
	if err == nil {
		return false
	}
	message := strings.ToLower(err.Error())
	return strings.Contains(message, "broken pipe") || strings.Contains(message, "reset by peer")
}

func (w *countingTransferResponseWriter) Header() http.Header {
	return w.ResponseWriter.Header()
}

func (w *countingTransferResponseWriter) WriteHeader(statusCode int) {
	w.ResponseWriter.WriteHeader(statusCode)
}

func (w *countingTransferResponseWriter) Write(p []byte) (int, error) {
	written, err := w.ResponseWriter.Write(p)
	if written > 0 {
		w.tracker.recordWrite(written)
	}
	return written, err
}

func (w *countingTransferResponseWriter) Flush() {
	flusher, ok := resolveResponseWriterFlusher(w.ResponseWriter)
	if ok {
		flusher.Flush()
	}
}

func (w *countingTransferResponseWriter) Unwrap() http.ResponseWriter {
	return w.ResponseWriter
}
