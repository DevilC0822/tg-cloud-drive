package api

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"tg-cloud-drive-api/internal/store"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type uploadFolderBatchStats struct {
	UploadedSize   int64
	UpdatedAt      time.Time
	DirectoryCount int
	FileCount      int
	CompletedCount int
	FailedCount    int
	ActiveCount    int
	TotalSize      int64
}

type transferFolderEntryDTO struct {
	RelativePath   string              `json:"relativePath"`
	Name           string              `json:"name"`
	EntryType      string              `json:"entryType"`
	Status         string              `json:"status"`
	Progress       transferProgressDTO `json:"progress"`
	Size           int64               `json:"size"`
	CompletedCount int                 `json:"completedCount"`
	FailedCount    int                 `json:"failedCount"`
	ActiveCount    int                 `json:"activeCount"`
	HasChildren    bool                `json:"hasChildren"`
	Error          *string             `json:"error,omitempty"`
}

type uploadFolderEntryRow struct {
	RelativePath   string
	Name           string
	EntryType      string
	Status         string
	Error          *string
	HasChildren    bool
	Size           int64
	UploadedSize   int64
	FileCount      int
	CompletedCount int
	FailedCount    int
	ActiveCount    int
}

func (s *Server) buildFolderUploadBatchTransferJobView(
	ctx context.Context,
	job store.TransferJob,
	batchID uuid.UUID,
) (transferJobViewDTO, bool, error) {
	batch, err := store.New(s.db).GetUploadFolderBatch(ctx, batchID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			return transferJobViewDTO{}, false, nil
		}
		return transferJobViewDTO{}, false, err
	}

	stats, err := s.queryUploadFolderBatchStats(ctx, batchID)
	if err != nil {
		return transferJobViewDTO{}, true, err
	}
	preview, err := s.queryUploadFolderPreviewItems(ctx, batchID)
	if err != nil {
		return transferJobViewDTO{}, true, err
	}

	dto := toTransferJobViewDTO(job)
	dto.BatchMode = "folder"
	dto.DirectoryCount = batch.TotalDirectories
	dto.ActiveCount = stats.ActiveCount
	dto.ItemCount = stats.FileCount
	dto.CompletedCount = stats.CompletedCount
	dto.ErrorCount = stats.FailedCount
	dto.TotalSize = stats.TotalSize
	dto.UpdatedAt = maxTransferTime(stats.UpdatedAt, dto.UpdatedAt)
	dto.Progress = progressFromCounts(stats.UploadedSize, maxInt64(stats.TotalSize, 1), "bytes", job.Status == store.TransferJobStatusCompleted)
	dto.Phase = resolveUploadBatchPhase(dto.Progress, job.Status)
	sessions, sessionErr := store.New(s.db).ListUploadSessionsByBatch(ctx, batchID)
	if sessionErr != nil {
		return transferJobViewDTO{}, true, sessionErr
	}
	phaseView := s.resolveUploadBatchPhaseView(ctx, sessions)
	dto.Phase = resolveTransferPhaseFromUploadDetail(phaseView.Detail, dto.Phase)
	dto.PhaseDetail = phaseView.Detail
	dto.PhaseProgress = phaseView.Progress
	dto.PhaseProgressMode = phaseView.ProgressMode
	dto.PhaseSpeedBPS = phaseView.SpeedBytesPerSec
	dto.PhaseStartedAt = phaseView.StartedAt
	dto.PreviewItems = preview
	return dto, true, nil
}

func (s *Server) buildFolderUploadDetail(
	ctx context.Context,
	sourceRef string,
) (*transferFolderUploadDetailDTO, bool, error) {
	batchID, err := uuid.Parse(strings.TrimSpace(sourceRef))
	if err != nil {
		return nil, false, err
	}

	batch, err := store.New(s.db).GetUploadFolderBatch(ctx, batchID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			return nil, false, nil
		}
		return nil, false, err
	}
	stats, err := s.queryUploadFolderBatchStats(ctx, batchID)
	if err != nil {
		return nil, true, err
	}
	return &transferFolderUploadDetailDTO{
		RootItemID:     batch.RootItemID.String(),
		RootName:       batch.RootName,
		DirectoryCount: batch.TotalDirectories,
		FileCount:      stats.FileCount,
		CompletedCount: stats.CompletedCount,
		FailedCount:    stats.FailedCount,
		ActiveCount:    stats.ActiveCount,
		TotalSize:      stats.TotalSize,
	}, true, nil
}

func (s *Server) handleGetTransferEntries(w http.ResponseWriter, r *http.Request) {
	transferID, err := parseUUIDParam(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "id 非法")
		return
	}
	parentPath, err := normalizeUploadFolderRelativePath(r.URL.Query().Get("parentPath"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "parentPath 非法")
		return
	}

	job, err := store.New(s.db).GetTransferJobByID(r.Context(), transferID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "传输记录不存在")
			return
		}
		s.logger.Error("get transfer entries failed", "error", err.Error(), "id", transferID.String())
		writeError(w, http.StatusInternalServerError, "internal_error", "读取传输明细失败")
		return
	}
	if job.SourceKind != store.TransferSourceKindUploadBatch {
		writeError(w, http.StatusBadRequest, "bad_request", "该任务不支持树形条目")
		return
	}

	batchID, err := uuid.Parse(strings.TrimSpace(job.SourceRef))
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "sourceRef 非法")
		return
	}
	if _, err := store.New(s.db).GetUploadFolderBatch(r.Context(), batchID); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusBadRequest, "bad_request", "该任务不是目录上传任务")
			return
		}
		s.logger.Error("get folder batch for transfer entries failed", "error", err.Error(), "batch_id", batchID.String())
		writeError(w, http.StatusInternalServerError, "internal_error", "读取目录上传批次失败")
		return
	}

	items, err := s.queryTransferFolderEntries(r.Context(), batchID, parentPath)
	if err != nil {
		s.logger.Error("query transfer folder entries failed", "error", err.Error(), "batch_id", batchID.String())
		writeError(w, http.StatusInternalServerError, "internal_error", "读取目录上传条目失败")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (s *Server) queryUploadFolderBatchStats(ctx context.Context, batchID uuid.UUID) (uploadFolderBatchStats, error) {
	const q = `
SELECT
  COALESCE(max(COALESCE(us.updated_at, e.updated_at)), now()) AS updated_at,
  count(*) FILTER (WHERE e.entry_type = 'folder' AND e.relative_path <> '')::int AS directory_count,
  count(*) FILTER (WHERE e.entry_type = 'file')::int AS file_count,
  count(*) FILTER (WHERE e.entry_type = 'file' AND e.status = 'completed')::int AS completed_count,
  count(*) FILTER (WHERE e.entry_type = 'file' AND e.status = 'failed')::int AS failed_count,
  count(*) FILTER (WHERE e.entry_type = 'file' AND e.status = 'uploading')::int AS active_count,
  COALESCE(sum(e.size) FILTER (WHERE e.entry_type = 'file'), 0)::bigint AS total_size,
  COALESCE(sum(LEAST(COALESCE(us.uploaded_chunks_count, 0) * COALESCE(us.chunk_size, 0), e.size)) FILTER (WHERE e.entry_type = 'file'), 0)::bigint AS uploaded_size
FROM upload_folder_entries e
LEFT JOIN upload_sessions us ON us.id = e.upload_session_id
WHERE e.transfer_batch_id = $1
`
	var stats uploadFolderBatchStats
	err := s.db.QueryRow(ctx, q, batchID).Scan(
		&stats.UpdatedAt,
		&stats.DirectoryCount,
		&stats.FileCount,
		&stats.CompletedCount,
		&stats.FailedCount,
		&stats.ActiveCount,
		&stats.TotalSize,
		&stats.UploadedSize,
	)
	return stats, err
}

func (s *Server) queryUploadFolderPreviewItems(ctx context.Context, batchID uuid.UUID) ([]transferPreviewItemDTO, error) {
	const q = `
SELECT
  e.upload_session_id,
  e.name,
  e.relative_path,
  e.status,
  e.error,
  COALESCE(us.uploaded_chunks_count, 0)::int AS uploaded_chunks,
  COALESCE(us.total_chunks, 0)::int AS total_chunks
FROM upload_folder_entries e
LEFT JOIN upload_sessions us ON us.id = e.upload_session_id
WHERE e.transfer_batch_id = $1
  AND e.entry_type = 'file'
ORDER BY
  CASE e.status WHEN 'failed' THEN 0 WHEN 'uploading' THEN 1 WHEN 'pending' THEN 2 ELSE 3 END,
  e.updated_at DESC,
  e.relative_path ASC
LIMIT 5
`
	rows, err := s.db.Query(ctx, q, batchID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]transferPreviewItemDTO, 0, 5)
	for rows.Next() {
		var (
			sessionID     *uuid.UUID
			name          string
			relativePath  string
			status        string
			errText       *string
			uploadedCount int
			totalChunks   int
		)
		if err := rows.Scan(&sessionID, &name, &relativePath, &status, &errText, &uploadedCount, &totalChunks); err != nil {
			return nil, err
		}
		if sessionID == nil {
			continue
		}
		items = append(items, transferPreviewItemDTO{
			ID:           sessionID.String(),
			Name:         name,
			RelativePath: stringPointerOrNil(relativePath),
			Status:       status,
			Percent:      progressPercent(int64(uploadedCount), int64(max(totalChunks, 1)), status == string(store.UploadSessionStatusCompleted)),
			Error:        errText,
		})
	}
	return items, rows.Err()
}

func (s *Server) queryTransferFolderEntries(
	ctx context.Context,
	batchID uuid.UUID,
	parentPath string,
) ([]transferFolderEntryDTO, error) {
	const q = `
SELECT
  e.relative_path,
  e.name,
  e.entry_type,
  e.status,
  CASE
    WHEN e.entry_type = 'folder' THEN (
      SELECT f.error
      FROM upload_folder_entries f
      WHERE f.transfer_batch_id = e.transfer_batch_id
        AND f.entry_type = 'file'
        AND f.status = 'failed'
        AND f.relative_path LIKE e.relative_path || '/%'
      ORDER BY f.updated_at DESC
      LIMIT 1
    )
    ELSE e.error
  END AS error,
  CASE
    WHEN e.entry_type = 'folder' THEN EXISTS(
      SELECT 1
      FROM upload_folder_entries child
      WHERE child.transfer_batch_id = e.transfer_batch_id
        AND child.parent_relative_path = e.relative_path
    )
    ELSE FALSE
  END AS has_children,
  CASE
    WHEN e.entry_type = 'folder' THEN COALESCE((
      SELECT sum(f.size)::bigint
      FROM upload_folder_entries f
      WHERE f.transfer_batch_id = e.transfer_batch_id
        AND f.entry_type = 'file'
        AND f.relative_path LIKE e.relative_path || '/%'
    ), 0)
    ELSE e.size
  END AS size,
  CASE
    WHEN e.entry_type = 'folder' THEN COALESCE((
      SELECT sum(LEAST(COALESCE(us2.uploaded_chunks_count, 0) * COALESCE(us2.chunk_size, 0), f.size))::bigint
      FROM upload_folder_entries f
      LEFT JOIN upload_sessions us2 ON us2.id = f.upload_session_id
      WHERE f.transfer_batch_id = e.transfer_batch_id
        AND f.entry_type = 'file'
        AND f.relative_path LIKE e.relative_path || '/%'
    ), 0)
    ELSE LEAST(COALESCE(us.uploaded_chunks_count, 0) * COALESCE(us.chunk_size, 0), e.size)
  END AS uploaded_size,
  CASE
    WHEN e.entry_type = 'folder' THEN COALESCE((
      SELECT count(*)::int
      FROM upload_folder_entries f
      WHERE f.transfer_batch_id = e.transfer_batch_id
        AND f.entry_type = 'file'
        AND f.relative_path LIKE e.relative_path || '/%'
    ), 0)
    ELSE 1
  END AS file_count,
  CASE
    WHEN e.entry_type = 'folder' THEN COALESCE((
      SELECT count(*)::int
      FROM upload_folder_entries f
      WHERE f.transfer_batch_id = e.transfer_batch_id
        AND f.entry_type = 'file'
        AND f.status = 'completed'
        AND f.relative_path LIKE e.relative_path || '/%'
    ), 0)
    ELSE CASE WHEN e.status = 'completed' THEN 1 ELSE 0 END
  END AS completed_count,
  CASE
    WHEN e.entry_type = 'folder' THEN COALESCE((
      SELECT count(*)::int
      FROM upload_folder_entries f
      WHERE f.transfer_batch_id = e.transfer_batch_id
        AND f.entry_type = 'file'
        AND f.status = 'failed'
        AND f.relative_path LIKE e.relative_path || '/%'
    ), 0)
    ELSE CASE WHEN e.status = 'failed' THEN 1 ELSE 0 END
  END AS failed_count,
  CASE
    WHEN e.entry_type = 'folder' THEN COALESCE((
      SELECT count(*)::int
      FROM upload_folder_entries f
      WHERE f.transfer_batch_id = e.transfer_batch_id
        AND f.entry_type = 'file'
        AND f.status = 'uploading'
        AND f.relative_path LIKE e.relative_path || '/%'
    ), 0)
    ELSE CASE WHEN e.status = 'uploading' THEN 1 ELSE 0 END
  END AS active_count
FROM upload_folder_entries e
LEFT JOIN upload_sessions us ON us.id = e.upload_session_id
WHERE e.transfer_batch_id = $1
  AND (
    ($2 = '' AND e.parent_relative_path IS NULL AND e.relative_path <> '')
    OR e.parent_relative_path = NULLIF($2, '')
  )
ORDER BY CASE e.entry_type WHEN 'folder' THEN 0 ELSE 1 END, e.name ASC
`
	rows, err := s.db.Query(ctx, q, batchID, parentPath)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]transferFolderEntryDTO, 0)
	for rows.Next() {
		row, err := scanUploadFolderEntryRow(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, toTransferFolderEntryDTO(row))
	}
	return items, rows.Err()
}

func scanUploadFolderEntryRow(scanner interface{ Scan(dest ...any) error }) (uploadFolderEntryRow, error) {
	var row uploadFolderEntryRow
	err := scanner.Scan(
		&row.RelativePath,
		&row.Name,
		&row.EntryType,
		&row.Status,
		&row.Error,
		&row.HasChildren,
		&row.Size,
		&row.UploadedSize,
		&row.FileCount,
		&row.CompletedCount,
		&row.FailedCount,
		&row.ActiveCount,
	)
	return row, err
}

func toTransferFolderEntryDTO(row uploadFolderEntryRow) transferFolderEntryDTO {
	status := row.Status
	if row.EntryType == string(store.UploadFolderEntryTypeFolder) {
		status = resolveTransferFolderNodeStatus(row)
	}
	progress := progressFromCounts(row.UploadedSize, maxInt64(row.Size, 1), "bytes", status == string(store.UploadFolderEntryStatusCompleted))
	return transferFolderEntryDTO{
		RelativePath:   row.RelativePath,
		Name:           row.Name,
		EntryType:      row.EntryType,
		Status:         status,
		Progress:       progress,
		Size:           row.Size,
		CompletedCount: row.CompletedCount,
		FailedCount:    row.FailedCount,
		ActiveCount:    row.ActiveCount,
		HasChildren:    row.HasChildren,
		Error:          row.Error,
	}
}

func resolveTransferFolderNodeStatus(row uploadFolderEntryRow) string {
	if row.FailedCount > 0 {
		return string(store.UploadFolderEntryStatusFailed)
	}
	if row.ActiveCount > 0 {
		return string(store.UploadFolderEntryStatusUploading)
	}
	if row.FileCount == 0 || row.CompletedCount >= row.FileCount {
		return string(store.UploadFolderEntryStatusCompleted)
	}
	return string(store.UploadFolderEntryStatusPending)
}

func maxTransferTime(left time.Time, right time.Time) time.Time {
	if left.After(right) {
		return left
	}
	return right
}
