package api

import (
	"context"
	"strings"
	"time"

	"github.com/const/tg-cloud-drive/backend/internal/store"
	"github.com/google/uuid"
)

func buildTorrentTransferSourceRef(taskID uuid.UUID) string {
	return taskID.String()
}

func (s *Server) refreshTorrentTransferJobByTaskID(
	ctx context.Context,
	taskID uuid.UUID,
	fallbackStatus store.TransferJobStatus,
	fallbackError string,
) {
	st := store.New(s.db)
	task, err := st.GetTorrentTask(ctx, taskID)
	if err != nil {
		s.logger.Warn("refresh torrent transfer job failed: load task", "error", err.Error(), "task_id", taskID.String())
		return
	}
	files, err := st.ListTorrentTaskFiles(ctx, taskID)
	if err != nil {
		s.logger.Warn("refresh torrent transfer job failed: load files", "error", err.Error(), "task_id", taskID.String())
		return
	}
	if err := s.upsertTorrentTransferJobFromTask(ctx, task, files, fallbackStatus, fallbackError); err != nil {
		s.logger.Warn("refresh torrent transfer job failed: upsert", "error", err.Error(), "task_id", taskID.String())
	}
}

func (s *Server) upsertTorrentTransferJobFromTask(
	ctx context.Context,
	task store.TorrentTask,
	files []store.TorrentTaskFile,
	fallbackStatus store.TransferJobStatus,
	fallbackError string,
) error {
	itemCount, totalSize, completedCount, errorCount := summarizeTorrentTransferFiles(files)
	if itemCount <= 0 {
		itemCount = 1
	}
	status := resolveTorrentTransferJobStatus(task.Status, itemCount, completedCount, errorCount, fallbackStatus)
	if status == store.TransferJobStatusError && errorCount == 0 {
		errorCount = 1
	}
	if completedCount > itemCount {
		completedCount = itemCount
	}
	if errorCount > itemCount {
		errorCount = itemCount
	}
	startedAt, finishedAt := resolveTorrentTransferJobTimes(task)
	name := strings.TrimSpace(task.TorrentName)
	if name == "" {
		name = task.ID.String()
	}
	lastError := resolveTorrentTransferLastError(status, task, fallbackError)
	job := store.TransferJob{
		ID:             task.ID,
		Direction:      store.TransferDirectionUpload,
		SourceKind:     store.TransferSourceKindTorrentTask,
		SourceRef:      buildTorrentTransferSourceRef(task.ID),
		UnitKind:       resolveTorrentTransferUnitKind(itemCount),
		Name:           name,
		TotalSize:      totalSize,
		ItemCount:      itemCount,
		CompletedCount: completedCount,
		ErrorCount:     errorCount,
		CanceledCount:  0,
		Status:         status,
		LastError:      lastError,
		StartedAt:      startedAt,
		FinishedAt:     finishedAt,
		CreatedAt:      startedAt,
		UpdatedAt:      finishedAt,
	}
	saved, err := store.New(s.db).UpsertTransferJob(ctx, job)
	if err != nil {
		return err
	}
	s.syncTransferJobEvent(ctx, saved)
	return nil
}

func summarizeTorrentTransferFiles(files []store.TorrentTaskFile) (int, int64, int, int) {
	itemCount := 0
	totalSize := int64(0)
	completedCount := 0
	errorCount := 0
	for _, file := range files {
		if !file.Selected {
			continue
		}
		itemCount++
		if file.FileSize > 0 {
			totalSize += file.FileSize
		}
		if file.Uploaded {
			completedCount++
		}
		if file.Error != nil && strings.TrimSpace(*file.Error) != "" {
			errorCount++
		}
	}
	return itemCount, totalSize, completedCount, errorCount
}

func resolveTorrentTransferUnitKind(itemCount int) store.TransferUnitKind {
	if itemCount <= 1 {
		return store.TransferUnitKindFile
	}
	return store.TransferUnitKindFolder
}

func resolveTorrentTransferJobTimes(task store.TorrentTask) (time.Time, time.Time) {
	startedAt := task.CreatedAt
	if task.StartedAt != nil && !task.StartedAt.IsZero() {
		startedAt = *task.StartedAt
	}
	finishedAt := time.Now()
	if task.FinishedAt != nil && !task.FinishedAt.IsZero() {
		finishedAt = *task.FinishedAt
	}
	if finishedAt.Before(startedAt) {
		finishedAt = startedAt
	}
	return startedAt, finishedAt
}

func resolveTorrentTransferJobStatus(
	taskStatus store.TorrentTaskStatus,
	itemCount int,
	completedCount int,
	errorCount int,
	fallbackStatus store.TransferJobStatus,
) store.TransferJobStatus {
	if itemCount > 0 && completedCount >= itemCount {
		return store.TransferJobStatusCompleted
	}
	if taskStatus == store.TorrentTaskStatusError {
		return store.TransferJobStatusError
	}
	if errorCount > 0 && taskStatus == store.TorrentTaskStatusCompleted {
		return store.TransferJobStatusError
	}
	switch taskStatus {
	case store.TorrentTaskStatusQueued,
		store.TorrentTaskStatusDownloading,
		store.TorrentTaskStatusAwaitingSelection,
		store.TorrentTaskStatusUploading:
		return store.TransferJobStatusRunning
	case store.TorrentTaskStatusCompleted:
		if errorCount > 0 {
			return store.TransferJobStatusError
		}
		return store.TransferJobStatusCompleted
	default:
		return fallbackStatus
	}
}

func resolveTorrentTransferLastError(
	status store.TransferJobStatus,
	task store.TorrentTask,
	fallbackError string,
) *string {
	if status == store.TransferJobStatusCompleted {
		return nil
	}
	if task.Error != nil {
		if normalized := normalizeTransferHistoryError(*task.Error); normalized != nil {
			return normalized
		}
	}
	return normalizeTransferHistoryError(fallbackError)
}
