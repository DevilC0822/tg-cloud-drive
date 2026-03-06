package api

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"tg-cloud-drive-api/internal/store"
	"github.com/google/uuid"
)

func buildUploadSessionTransferSourceRef(sessionID uuid.UUID) string {
	return sessionID.String()
}

func buildUploadBatchTransferSourceRef(batchID uuid.UUID) string {
	return batchID.String()
}

func (s *Server) createUploadBatchTransferJob(
	ctx context.Context,
	name string,
	itemCount int,
	totalSize int64,
	startedAt time.Time,
) (store.TransferJob, error) {
	now := time.Now()
	if startedAt.IsZero() {
		startedAt = now
	}
	if itemCount < 1 {
		itemCount = 1
	}
	if totalSize < 0 {
		totalSize = 0
	}
	title := strings.TrimSpace(name)
	if title == "" {
		title = fmt.Sprintf("批量上传（%d 个文件）", itemCount)
	}

	id := uuid.New()
	job := store.TransferJob{
		ID:             id,
		Direction:      store.TransferDirectionUpload,
		SourceKind:     store.TransferSourceKindUploadBatch,
		SourceRef:      buildUploadBatchTransferSourceRef(id),
		UnitKind:       store.TransferUnitKindFolder,
		Name:           title,
		TotalSize:      totalSize,
		ItemCount:      itemCount,
		CompletedCount: 0,
		ErrorCount:     0,
		CanceledCount:  0,
		Status:         store.TransferJobStatusRunning,
		LastError:      nil,
		StartedAt:      startedAt,
		FinishedAt:     startedAt,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	if err := store.New(s.db).CreateTransferJob(ctx, job); err != nil {
		return store.TransferJob{}, err
	}
	s.syncTransferJobEvent(ctx, job)
	return job, nil
}

func (s *Server) upsertUploadSessionRunningTransferJob(
	ctx context.Context,
	session store.UploadSession,
) (*store.TransferJob, error) {
	if session.TransferBatchID != nil {
		return nil, nil
	}

	now := time.Now()
	startedAt := session.CreatedAt
	if startedAt.IsZero() {
		startedAt = now
	}
	job := store.TransferJob{
		ID:             uuid.New(),
		Direction:      store.TransferDirectionUpload,
		SourceKind:     store.TransferSourceKindUploadSession,
		SourceRef:      buildUploadSessionTransferSourceRef(session.ID),
		UnitKind:       store.TransferUnitKindFile,
		Name:           strings.TrimSpace(session.FileName),
		TargetItemID:   &session.ItemID,
		TotalSize:      maxUploadInt64(session.FileSize, 0),
		ItemCount:      1,
		CompletedCount: 0,
		ErrorCount:     0,
		CanceledCount:  0,
		Status:         store.TransferJobStatusRunning,
		LastError:      nil,
		StartedAt:      startedAt,
		FinishedAt:     startedAt,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	saved, err := store.New(s.db).UpsertTransferJob(ctx, job)
	if err != nil {
		return nil, err
	}
	s.syncTransferJobEvent(ctx, saved)
	return &saved, nil
}

func (s *Server) syncUploadSessionProgressEvent(ctx context.Context, session store.UploadSession) {
	if session.TransferBatchID != nil {
		s.syncTransferJobByID(ctx, *session.TransferBatchID)
		return
	}
	if _, err := s.upsertUploadSessionRunningTransferJob(ctx, session); err != nil {
		s.logger.Warn("sync upload session progress failed", "error", err.Error(), "session_id", session.ID.String())
	}
}

func (s *Server) recordUploadSessionTransferHistory(
	ctx context.Context,
	session store.UploadSession,
	itemID *uuid.UUID,
	status store.TransferStatus,
	errMsg string,
	processMeta *videoUploadProcessMeta,
	finishedAt time.Time,
) {
	_ = processMeta
	st := store.New(s.db)
	if finishedAt.IsZero() {
		finishedAt = time.Now()
	}
	if session.TransferBatchID != nil {
		s.refreshUploadBatchTransferJob(ctx, st, *session.TransferBatchID, strings.TrimSpace(errMsg), finishedAt)
		return
	}

	targetItemID := itemID
	if targetItemID == nil && session.ItemID != uuid.Nil {
		fallback := session.ItemID
		targetItemID = &fallback
	}
	completedCount, errorCount, canceledCount, jobStatus := mapUploadSessionHistoryResult(status)
	lastError := normalizeTransferHistoryError(errMsg)
	startedAt := session.CreatedAt
	if startedAt.IsZero() {
		startedAt = finishedAt
	}
	name := strings.TrimSpace(session.FileName)
	if name == "" {
		name = session.ID.String()
	}
	job := store.TransferJob{
		ID:             uuid.New(),
		Direction:      store.TransferDirectionUpload,
		SourceKind:     store.TransferSourceKindUploadSession,
		SourceRef:      buildUploadSessionTransferSourceRef(session.ID),
		UnitKind:       store.TransferUnitKindFile,
		Name:           name,
		TargetItemID:   targetItemID,
		TotalSize:      maxUploadInt64(session.FileSize, 0),
		ItemCount:      1,
		CompletedCount: completedCount,
		ErrorCount:     errorCount,
		CanceledCount:  canceledCount,
		Status:         jobStatus,
		LastError:      lastError,
		StartedAt:      startedAt,
		FinishedAt:     finishedAt,
		CreatedAt:      finishedAt,
		UpdatedAt:      finishedAt,
	}
	saved, err := st.UpsertTransferJob(ctx, job)
	if err != nil {
		s.logger.Warn("upsert upload session transfer job failed", "error", err.Error(), "session_id", session.ID.String())
		return
	}
	s.syncTransferJobEvent(ctx, saved)
}

func (s *Server) refreshUploadBatchTransferJob(
	ctx context.Context,
	st *store.Store,
	batchID uuid.UUID,
	latestError string,
	finishedAt time.Time,
) {
	progress, err := st.CountUploadSessionsByBatch(ctx, batchID)
	if err != nil {
		s.logger.Warn("count upload batch sessions failed", "error", err.Error(), "batch_id", batchID.String())
		return
	}
	if progress.Total <= 0 {
		return
	}
	existingError := (*string)(nil)
	if existing, getErr := st.GetTransferJobByID(ctx, batchID); getErr == nil {
		existingError = existing.LastError
	}
	jobStatus, lastError := resolveUploadBatchTransferJobStatus(progress, latestError, existingError)
	if err := st.UpdateTransferJobProgress(
		ctx,
		batchID,
		progress.Completed,
		progress.Failed,
		0,
		jobStatus,
		lastError,
		finishedAt,
	); err == nil {
		s.syncTransferJobByID(ctx, batchID)
		return
	}
	if !errors.Is(err, store.ErrNotFound) {
		s.logger.Warn("update upload batch transfer job failed", "error", err.Error(), "batch_id", batchID.String())
		return
	}

	fallbackName := fmt.Sprintf("批量上传（%d 个文件）", progress.Total)
	now := time.Now()
	job := store.TransferJob{
		ID:             batchID,
		Direction:      store.TransferDirectionUpload,
		SourceKind:     store.TransferSourceKindUploadBatch,
		SourceRef:      buildUploadBatchTransferSourceRef(batchID),
		UnitKind:       store.TransferUnitKindFolder,
		Name:           fallbackName,
		TotalSize:      0,
		ItemCount:      progress.Total,
		CompletedCount: progress.Completed,
		ErrorCount:     progress.Failed,
		CanceledCount:  0,
		Status:         jobStatus,
		LastError:      lastError,
		StartedAt:      now,
		FinishedAt:     finishedAt,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	if _, upsertErr := st.UpsertTransferJob(ctx, job); upsertErr != nil {
		s.logger.Warn("upsert upload batch transfer job failed", "error", upsertErr.Error(), "batch_id", batchID.String())
		return
	}
	s.syncTransferJobByID(ctx, batchID)
}

func mapUploadSessionHistoryResult(
	status store.TransferStatus,
) (completedCount int, errorCount int, canceledCount int, jobStatus store.TransferJobStatus) {
	switch status {
	case store.TransferStatusCompleted:
		return 1, 0, 0, store.TransferJobStatusCompleted
	case store.TransferStatusCanceled:
		return 0, 0, 1, store.TransferJobStatusCanceled
	default:
		return 0, 1, 0, store.TransferJobStatusError
	}
}

func resolveUploadBatchTransferJobStatus(
	progress store.UploadBatchProgress,
	latestError string,
	existingError *string,
) (store.TransferJobStatus, *string) {
	inProgress := progress.Completed+progress.Failed < progress.Total
	if inProgress {
		if progress.Failed > 0 {
			return store.TransferJobStatusRunning, mergeTransferError(latestError, existingError)
		}
		return store.TransferJobStatusRunning, nil
	}
	if progress.Failed > 0 {
		return store.TransferJobStatusError, mergeTransferError(latestError, existingError)
	}
	return store.TransferJobStatusCompleted, nil
}

func mergeTransferError(latestError string, existingError *string) *string {
	if latest := normalizeTransferHistoryError(latestError); latest != nil {
		return latest
	}
	if existingError == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*existingError)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func normalizeTransferHistoryError(errMsg string) *string {
	trimmed := strings.TrimSpace(errMsg)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func maxUploadInt64(a int64, b int64) int64 {
	if a > b {
		return a
	}
	return b
}
