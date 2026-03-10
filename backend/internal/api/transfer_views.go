package api

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"
	"tg-cloud-drive-api/internal/store"
)

const (
	transferPhaseUploadingChunks           = "uploading_chunks"
	transferPhaseFinalizing                = "finalizing"
	transferPhaseDownloading               = "downloading"
	transferPhaseQueued                    = "queued"
	transferPhaseTorrentDownloading        = "torrent_downloading"
	transferPhaseAwaitingSelection         = "awaiting_selection"
	transferPhaseTorrentUploading          = "torrent_uploading"
	transferPhaseDetailLocalChunkUploading = "local_chunk_uploading"
	transferPhaseDetailChunkProcessing     = "chunk_processing"
	transferPhaseDetailAssemblingFile      = "assembling_file"
	transferPhaseDetailUploadingToTelegram = "uploading_to_telegram"
	transferPhaseDetailFinalizingRecord    = "finalizing_record"
)

type transferProgressDTO struct {
	Percent int    `json:"percent"`
	Current int64  `json:"current"`
	Total   int64  `json:"total"`
	Unit    string `json:"unit"`
}

type transferPreviewItemDTO struct {
	ID           string  `json:"id"`
	Name         string  `json:"name"`
	RelativePath *string `json:"relativePath,omitempty"`
	Status       string  `json:"status"`
	Percent      int     `json:"percent"`
	Error        *string `json:"error,omitempty"`
}

type transferJobViewDTO struct {
	ID                string                   `json:"id"`
	Direction         string                   `json:"direction"`
	SourceKind        string                   `json:"sourceKind"`
	SourceRef         string                   `json:"sourceRef"`
	UnitKind          string                   `json:"unitKind"`
	Name              string                   `json:"name"`
	TargetItemID      *string                  `json:"targetItemId"`
	TotalSize         int64                    `json:"totalSize"`
	ItemCount         int                      `json:"itemCount"`
	CompletedCount    int                      `json:"completedCount"`
	ErrorCount        int                      `json:"errorCount"`
	CanceledCount     int                      `json:"canceledCount"`
	Status            string                   `json:"status"`
	LastError         *string                  `json:"lastError"`
	StartedAt         time.Time                `json:"startedAt"`
	FinishedAt        time.Time                `json:"finishedAt"`
	CreatedAt         time.Time                `json:"createdAt"`
	UpdatedAt         time.Time                `json:"updatedAt"`
	BatchMode         string                   `json:"batchMode,omitempty"`
	DirectoryCount    int                      `json:"directoryCount,omitempty"`
	ActiveCount       int                      `json:"activeCount,omitempty"`
	Phase             string                   `json:"phase"`
	PhaseDetail       string                   `json:"phaseDetail,omitempty"`
	PhaseSteps        []string                 `json:"phaseSteps,omitempty"`
	PhaseProgress     *transferProgressDTO     `json:"phaseProgress,omitempty"`
	PhaseProgressMode string                   `json:"phaseProgressMode,omitempty"`
	PhaseSpeedBPS     int64                    `json:"phaseSpeedBytesPerSecond,omitempty"`
	PhaseStartedAt    *time.Time               `json:"phaseStartedAt,omitempty"`
	Progress          transferProgressDTO      `json:"progress"`
	PreviewItems      []transferPreviewItemDTO `json:"previewItems,omitempty"`
}

type transferUploadSessionItemDTO struct {
	ID            string              `json:"id"`
	ItemID        string              `json:"itemId"`
	FileName      string              `json:"fileName"`
	FileSize      int64               `json:"fileSize"`
	Status        string              `json:"status"`
	UpdatedAt     time.Time           `json:"updatedAt"`
	Phase         string              `json:"phase"`
	Progress      transferProgressDTO `json:"progress"`
	UploadedCount int                 `json:"uploadedCount"`
	TotalChunks   int                 `json:"totalChunks"`
}

type transferUploadSessionDetailDTO struct {
	Session        transferUploadSessionItemDTO `json:"session"`
	UploadedChunks []int                        `json:"uploadedChunks"`
	MissingChunks  []int                        `json:"missingChunks"`
}

type transferUploadBatchDetailDTO struct {
	Sessions []transferUploadSessionItemDTO `json:"sessions"`
}

type transferFolderUploadDetailDTO struct {
	RootItemID     string `json:"rootItemId"`
	RootName       string `json:"rootName"`
	DirectoryCount int    `json:"directoryCount"`
	FileCount      int    `json:"fileCount"`
	CompletedCount int    `json:"completedCount"`
	FailedCount    int    `json:"failedCount"`
	ActiveCount    int    `json:"activeCount"`
	TotalSize      int64  `json:"totalSize"`
}

type transferDownloadDetailDTO struct {
	ItemID   *string             `json:"itemId"`
	FileName string              `json:"fileName"`
	Phase    string              `json:"phase"`
	Progress transferProgressDTO `json:"progress"`
}

type transferDetailDTO struct {
	Item          transferJobViewDTO              `json:"item"`
	UploadSession *transferUploadSessionDetailDTO `json:"uploadSession,omitempty"`
	UploadBatch   *transferUploadBatchDetailDTO   `json:"uploadBatch,omitempty"`
	FolderUpload  *transferFolderUploadDetailDTO  `json:"folderUpload,omitempty"`
	TorrentTask   *torrentTaskDTO                 `json:"torrentTask,omitempty"`
	DownloadTask  *transferDownloadDetailDTO      `json:"downloadTask,omitempty"`
}

func toTransferJobViewDTO(job store.TransferJob) transferJobViewDTO {
	var targetItemID *string
	if job.TargetItemID != nil {
		value := job.TargetItemID.String()
		targetItemID = &value
	}

	return transferJobViewDTO{
		ID:             job.ID.String(),
		Direction:      string(job.Direction),
		SourceKind:     string(job.SourceKind),
		SourceRef:      job.SourceRef,
		UnitKind:       string(job.UnitKind),
		Name:           job.Name,
		TargetItemID:   targetItemID,
		TotalSize:      job.TotalSize,
		ItemCount:      job.ItemCount,
		CompletedCount: job.CompletedCount,
		ErrorCount:     job.ErrorCount,
		CanceledCount:  job.CanceledCount,
		Status:         string(job.Status),
		LastError:      job.LastError,
		StartedAt:      job.StartedAt,
		FinishedAt:     job.FinishedAt,
		CreatedAt:      job.CreatedAt,
		UpdatedAt:      job.UpdatedAt,
		Progress:       defaultTransferProgress(job),
	}
}

func defaultTransferProgress(job store.TransferJob) transferProgressDTO {
	if job.Status == store.TransferJobStatusCompleted {
		return transferProgressDTO{Percent: 100, Current: int64(max(job.ItemCount, 1)), Total: int64(max(job.ItemCount, 1)), Unit: "items"}
	}
	return transferProgressDTO{Percent: 0, Current: 0, Total: int64(max(job.ItemCount, 1)), Unit: "items"}
}

func toTransferHistoryDTO(job store.TransferJob) transferJobViewDTO {
	return toTransferJobViewDTO(job)
}

func (s *Server) buildTransferJobViewDTO(ctx context.Context, job store.TransferJob) (transferJobViewDTO, error) {
	switch job.SourceKind {
	case store.TransferSourceKindUploadSession:
		return s.buildUploadSessionTransferJobView(ctx, job)
	case store.TransferSourceKindUploadBatch:
		return s.buildUploadBatchTransferJobView(ctx, job)
	case store.TransferSourceKindTorrentTask:
		return s.buildTorrentTransferJobView(ctx, job)
	case store.TransferSourceKindDownloadTask:
		return s.buildDownloadTransferJobView(job), nil
	default:
		return toTransferJobViewDTO(job), nil
	}
}

func (s *Server) buildUploadSessionTransferJobView(
	ctx context.Context,
	job store.TransferJob,
) (transferJobViewDTO, error) {
	dto := toTransferJobViewDTO(job)
	sessionID, err := uuid.Parse(strings.TrimSpace(job.SourceRef))
	if err != nil {
		return dto, nil
	}
	session, err := store.New(s.db).GetUploadSession(ctx, sessionID)
	if err != nil {
		return dto, nil
	}
	uploadedCount, err := s.countUploadedChunksBySession(ctx, session)
	if err != nil {
		return dto, nil
	}
	dto.Phase = resolveUploadSessionPhase(job.Status, uploadedCount, session.TotalChunks)
	phaseView := s.resolveUploadSessionPhaseView(ctx, session, dto.Phase, uploadedCount)
	dto.PhaseDetail = phaseView.Detail
	dto.PhaseSteps = phaseView.Steps
	dto.PhaseProgress = phaseView.Progress
	dto.PhaseProgressMode = phaseView.ProgressMode
	dto.PhaseSpeedBPS = phaseView.SpeedBytesPerSec
	dto.PhaseStartedAt = phaseView.StartedAt
	dto.Progress = progressFromCounts(int64(uploadedCount), int64(session.TotalChunks), "chunks", job.Status == store.TransferJobStatusCompleted)
	dto.CompletedCount = completedCountFromStatus(job.Status)
	dto.ErrorCount = errorCountFromStatus(job.Status)
	dto.UpdatedAt = session.UpdatedAt
	return dto, nil
}

func (s *Server) buildUploadBatchTransferJobView(
	ctx context.Context,
	job store.TransferJob,
) (transferJobViewDTO, error) {
	dto := toTransferJobViewDTO(job)
	batchID, err := uuid.Parse(strings.TrimSpace(job.SourceRef))
	if err != nil {
		return dto, nil
	}
	if folderDTO, ok, folderErr := s.buildFolderUploadBatchTransferJobView(ctx, job, batchID); ok || folderErr != nil {
		return folderDTO, folderErr
	}
	sessions, err := store.New(s.db).ListUploadSessionsByBatch(ctx, batchID)
	if err != nil {
		return dto, nil
	}
	dto.Progress, dto.PreviewItems = s.resolveUploadBatchProgress(ctx, sessions, job.Status)
	dto.Phase = resolveUploadBatchPhase(dto.Progress, job.Status)
	phaseView := s.resolveUploadBatchPhaseView(ctx, sessions)
	dto.Phase = resolveTransferPhaseFromUploadDetail(phaseView.Detail, dto.Phase)
	dto.PhaseDetail = phaseView.Detail
	dto.PhaseProgress = phaseView.Progress
	dto.PhaseProgressMode = phaseView.ProgressMode
	dto.PhaseSpeedBPS = phaseView.SpeedBytesPerSec
	dto.PhaseStartedAt = phaseView.StartedAt
	progress := summarizeUploadBatchSessions(sessions)
	dto.CompletedCount = progress.Completed
	dto.ErrorCount = progress.Failed
	return dto, nil
}

func (s *Server) resolveUploadBatchProgress(
	ctx context.Context,
	sessions []store.UploadSession,
	status store.TransferJobStatus,
) (transferProgressDTO, []transferPreviewItemDTO) {
	if len(sessions) == 0 {
		return progressFromCounts(0, 1, "items", status == store.TransferJobStatusCompleted), nil
	}

	preview := make([]transferPreviewItemDTO, 0, min(len(sessions), 5))
	current := int64(0)
	total := int64(0)
	for index, session := range sessions {
		uploadedCount, _ := s.countUploadedChunksBySession(ctx, session)
		current += int64(uploadedCount)
		total += int64(max(session.TotalChunks, 1))
		if index < 5 {
			preview = append(preview, transferPreviewItemDTO{
				ID:      session.ID.String(),
				Name:    session.FileName,
				Status:  string(session.Status),
				Percent: progressPercent(int64(uploadedCount), int64(max(session.TotalChunks, 1)), session.Status == store.UploadSessionStatusCompleted),
			})
		}
	}
	return progressFromCounts(current, total, "chunks", status == store.TransferJobStatusCompleted), preview
}

func summarizeUploadBatchSessions(sessions []store.UploadSession) store.UploadBatchProgress {
	progress := store.UploadBatchProgress{Total: len(sessions)}
	for _, session := range sessions {
		if session.Status == store.UploadSessionStatusCompleted {
			progress.Completed++
		}
		if session.Status == store.UploadSessionStatusFailed {
			progress.Failed++
		}
	}
	return progress
}

func (s *Server) buildTorrentTransferJobView(
	ctx context.Context,
	job store.TransferJob,
) (transferJobViewDTO, error) {
	dto := toTransferJobViewDTO(job)
	taskID, err := uuid.Parse(strings.TrimSpace(job.SourceRef))
	if err != nil {
		return dto, nil
	}
	st := store.New(s.db)
	task, taskErr := st.GetTorrentTask(ctx, taskID)
	files, filesErr := st.ListTorrentTaskFiles(ctx, taskID)
	if taskErr != nil || filesErr != nil {
		return dto, nil
	}
	dto.Phase = resolveTorrentTransferPhase(task.Status)
	dto.Progress = resolveTorrentTransferProgress(task, files)
	dto.PreviewItems = buildTorrentPreviewItems(files)
	return dto, nil
}

func resolveTorrentTransferProgress(task store.TorrentTask, files []store.TorrentTaskFile) transferProgressDTO {
	if task.Status == store.TorrentTaskStatusDownloading || task.Status == store.TorrentTaskStatusAwaitingSelection {
		return progressFromCounts(task.DownloadedBytes, maxInt64(task.EstimatedSize, 1), "bytes", task.Status == store.TorrentTaskStatusAwaitingSelection)
	}
	completed, total := summarizeTorrentUploadFileProgress(files)
	return progressFromCounts(int64(completed), int64(max(total, 1)), "items", task.Status == store.TorrentTaskStatusCompleted)
}

func buildTorrentPreviewItems(files []store.TorrentTaskFile) []transferPreviewItemDTO {
	items := make([]transferPreviewItemDTO, 0, 5)
	for _, file := range files {
		if !file.Selected {
			continue
		}
		items = append(items, transferPreviewItemDTO{
			ID:      file.TaskID.String(),
			Name:    file.FileName,
			Status:  resolveTorrentPreviewStatus(file),
			Percent: resolveTorrentPreviewPercent(file),
			Error:   file.Error,
		})
		if len(items) == 5 {
			break
		}
	}
	return items
}

func resolveTorrentPreviewStatus(file store.TorrentTaskFile) string {
	if file.Uploaded {
		return "completed"
	}
	if file.Error != nil && strings.TrimSpace(*file.Error) != "" {
		return "error"
	}
	return "running"
}

func resolveTorrentPreviewPercent(file store.TorrentTaskFile) int {
	if file.Uploaded {
		return 100
	}
	if file.Error != nil && strings.TrimSpace(*file.Error) != "" {
		return 0
	}
	return 0
}

func summarizeTorrentUploadFileProgress(files []store.TorrentTaskFile) (int, int) {
	completed := 0
	total := 0
	for _, file := range files {
		if !file.Selected {
			continue
		}
		total++
		if file.Uploaded {
			completed++
		}
	}
	return completed, total
}

func (s *Server) buildDownloadTransferJobView(job store.TransferJob) transferJobViewDTO {
	dto := toTransferJobViewDTO(job)
	dto.Phase = transferPhaseDownloading
	progress, ok := s.getDownloadTransferProgress(job.ID)
	if ok {
		dto.Progress = progressFromCounts(progress.WrittenBytes, maxInt64(progress.TotalSize, 1), "bytes", false)
		dto.UpdatedAt = progress.UpdatedAt
		return dto
	}
	if job.Status == store.TransferJobStatusCompleted {
		dto.Progress = progressFromCounts(job.TotalSize, maxInt64(job.TotalSize, 1), "bytes", true)
	}
	return dto
}

func progressFromCounts(current int64, total int64, unit string, completed bool) transferProgressDTO {
	return transferProgressDTO{
		Percent: progressPercent(current, total, completed),
		Current: maxInt64(current, 0),
		Total:   maxInt64(total, 0),
		Unit:    unit,
	}
}

func progressPercent(current int64, total int64, completed bool) int {
	if completed {
		return 100
	}
	if total <= 0 {
		return 0
	}
	if current <= 0 {
		return 0
	}
	if current >= total {
		return 99
	}
	return int((current * 100) / total)
}

func resolveUploadSessionPhase(status store.TransferJobStatus, uploadedCount int, totalChunks int) string {
	return resolveUploadPhase(status == store.TransferJobStatusRunning, uploadedCount, totalChunks)
}

func resolveUploadSessionStatusPhase(status store.UploadSessionStatus, uploadedCount int, totalChunks int) string {
	return resolveUploadPhase(status == store.UploadSessionStatusUploading, uploadedCount, totalChunks)
}

func resolveUploadPhase(isRunning bool, uploadedCount int, totalChunks int) string {
	if !isRunning {
		return ""
	}
	if totalChunks > 0 && uploadedCount >= totalChunks {
		return transferPhaseFinalizing
	}
	return transferPhaseUploadingChunks
}

func resolveUploadBatchPhase(progress transferProgressDTO, status store.TransferJobStatus) string {
	if status != store.TransferJobStatusRunning {
		return ""
	}
	if progress.Total > 0 && progress.Current >= progress.Total {
		return transferPhaseFinalizing
	}
	return transferPhaseUploadingChunks
}

func resolveTorrentTransferPhase(status store.TorrentTaskStatus) string {
	switch status {
	case store.TorrentTaskStatusQueued:
		return transferPhaseQueued
	case store.TorrentTaskStatusDownloading:
		return transferPhaseTorrentDownloading
	case store.TorrentTaskStatusAwaitingSelection:
		return transferPhaseAwaitingSelection
	case store.TorrentTaskStatusUploading:
		return transferPhaseTorrentUploading
	default:
		return ""
	}
}

func completedCountFromStatus(status store.TransferJobStatus) int {
	if status == store.TransferJobStatusCompleted {
		return 1
	}
	return 0
}

func errorCountFromStatus(status store.TransferJobStatus) int {
	if status == store.TransferJobStatusError {
		return 1
	}
	return 0
}

func (s *Server) buildTransferDetailDTO(ctx context.Context, job store.TransferJob) (transferDetailDTO, error) {
	item, err := s.buildTransferJobViewDTO(ctx, job)
	if err != nil {
		return transferDetailDTO{}, err
	}
	detail := transferDetailDTO{Item: item}

	switch job.SourceKind {
	case store.TransferSourceKindUploadSession:
		sessionDetail, sessionErr := s.buildUploadSessionDetail(ctx, job.SourceRef)
		if sessionErr == nil {
			detail.UploadSession = sessionDetail
		}
	case store.TransferSourceKindUploadBatch:
		folderDetail, ok, folderErr := s.buildFolderUploadDetail(ctx, job.SourceRef)
		if folderErr == nil && ok {
			detail.FolderUpload = folderDetail
			break
		}
		batchDetail, batchErr := s.buildUploadBatchDetail(ctx, job.SourceRef)
		if batchErr == nil {
			detail.UploadBatch = batchDetail
		}
	case store.TransferSourceKindTorrentTask:
		taskDetail, taskErr := s.buildTorrentTaskDetail(ctx, job.SourceRef)
		if taskErr == nil {
			detail.TorrentTask = taskDetail
		}
	case store.TransferSourceKindDownloadTask:
		detail.DownloadTask = s.buildDownloadTaskDetail(job)
	}
	return detail, nil
}

func (s *Server) buildUploadSessionDetail(
	ctx context.Context,
	sourceRef string,
) (*transferUploadSessionDetailDTO, error) {
	sessionID, err := uuid.Parse(strings.TrimSpace(sourceRef))
	if err != nil {
		return nil, err
	}
	session, err := store.New(s.db).GetUploadSession(ctx, sessionID)
	if err != nil {
		return nil, err
	}
	uploadedChunks, err := s.listUploadedChunkIndicesBySession(ctx, session)
	if err != nil {
		return nil, err
	}
	uploadedCount := len(uploadedChunks)
	return &transferUploadSessionDetailDTO{
		Session: transferUploadSessionItemDTO{
			ID:            session.ID.String(),
			ItemID:        session.ItemID.String(),
			FileName:      session.FileName,
			FileSize:      session.FileSize,
			Status:        string(session.Status),
			UpdatedAt:     session.UpdatedAt,
			Phase:         resolveUploadSessionStatusPhase(session.Status, uploadedCount, session.TotalChunks),
			Progress:      progressFromCounts(int64(uploadedCount), int64(max(session.TotalChunks, 1)), "chunks", session.Status == store.UploadSessionStatusCompleted),
			UploadedCount: uploadedCount,
			TotalChunks:   session.TotalChunks,
		},
		UploadedChunks: uploadedChunks,
		MissingChunks:  missingChunkIndices(session.TotalChunks, uploadedChunks),
	}, nil
}

func (s *Server) buildUploadBatchDetail(
	ctx context.Context,
	sourceRef string,
) (*transferUploadBatchDetailDTO, error) {
	batchID, err := uuid.Parse(strings.TrimSpace(sourceRef))
	if err != nil {
		return nil, err
	}
	sessions, err := store.New(s.db).ListUploadSessionsByBatch(ctx, batchID)
	if err != nil {
		return nil, err
	}

	items := make([]transferUploadSessionItemDTO, 0, len(sessions))
	for _, session := range sessions {
		uploadedCount, _ := s.countUploadedChunksBySession(ctx, session)
		items = append(items, transferUploadSessionItemDTO{
			ID:            session.ID.String(),
			ItemID:        session.ItemID.String(),
			FileName:      session.FileName,
			FileSize:      session.FileSize,
			Status:        string(session.Status),
			UpdatedAt:     session.UpdatedAt,
			Phase:         resolveUploadSessionStatusPhase(session.Status, uploadedCount, session.TotalChunks),
			Progress:      progressFromCounts(int64(uploadedCount), int64(max(session.TotalChunks, 1)), "chunks", session.Status == store.UploadSessionStatusCompleted),
			UploadedCount: uploadedCount,
			TotalChunks:   session.TotalChunks,
		})
	}
	return &transferUploadBatchDetailDTO{Sessions: items}, nil
}

func (s *Server) buildTorrentTaskDetail(ctx context.Context, sourceRef string) (*torrentTaskDTO, error) {
	taskID, err := uuid.Parse(strings.TrimSpace(sourceRef))
	if err != nil {
		return nil, err
	}
	st := store.New(s.db)
	task, err := st.GetTorrentTask(ctx, taskID)
	if err != nil {
		return nil, err
	}
	files, err := st.ListTorrentTaskFiles(ctx, taskID)
	if err != nil {
		return nil, err
	}
	dto := toTorrentTaskDTO(task, files)
	return &dto, nil
}

func (s *Server) buildDownloadTaskDetail(job store.TransferJob) *transferDownloadDetailDTO {
	progress := s.buildDownloadTransferJobView(job).Progress
	return &transferDownloadDetailDTO{
		ItemID:   transferTargetItemID(job.TargetItemID),
		FileName: job.Name,
		Phase:    transferPhaseDownloading,
		Progress: progress,
	}
}

func transferTargetItemID(target *uuid.UUID) *string {
	if target == nil {
		return nil
	}
	value := target.String()
	return &value
}
