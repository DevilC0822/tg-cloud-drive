package store

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

func (s *Store) UpsertTransferHistory(ctx context.Context, entry TransferHistory) (TransferHistory, error) {
	q := `
INSERT INTO transfer_history(
  id,
  source_task_id,
  direction,
  file_id,
  file_name,
  size,
  status,
  error,
  upload_video_faststart_applied,
  upload_video_faststart_fallback,
  upload_video_preview_attached,
  upload_video_preview_fallback,
  started_at,
  finished_at,
  created_at,
  updated_at
)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
ON CONFLICT (direction, source_task_id) DO UPDATE SET
  file_id = EXCLUDED.file_id,
  file_name = EXCLUDED.file_name,
  size = EXCLUDED.size,
  status = EXCLUDED.status,
  error = EXCLUDED.error,
  upload_video_faststart_applied = EXCLUDED.upload_video_faststart_applied,
  upload_video_faststart_fallback = EXCLUDED.upload_video_faststart_fallback,
  upload_video_preview_attached = EXCLUDED.upload_video_preview_attached,
  upload_video_preview_fallback = EXCLUDED.upload_video_preview_fallback,
  started_at = EXCLUDED.started_at,
  finished_at = EXCLUDED.finished_at,
  updated_at = now()
RETURNING
  id,
  source_task_id,
  direction,
  file_id,
  file_name,
  size,
  status,
  error,
  upload_video_faststart_applied,
  upload_video_faststart_fallback,
  upload_video_preview_attached,
  upload_video_preview_fallback,
  started_at,
  finished_at,
  created_at,
  updated_at
`

	var out TransferHistory
	var direction string
	var status string
	err := s.db.QueryRow(
		ctx,
		q,
		entry.ID,
		entry.SourceTaskID,
		string(entry.Direction),
		entry.FileID,
		entry.FileName,
		entry.Size,
		string(entry.Status),
		entry.Error,
		entry.UploadVideoFaststartApplied,
		entry.UploadVideoFaststartFallback,
		entry.UploadVideoPreviewAttached,
		entry.UploadVideoPreviewFallback,
		entry.StartedAt,
		entry.FinishedAt,
		entry.CreatedAt,
		entry.UpdatedAt,
	).Scan(
		&out.ID,
		&out.SourceTaskID,
		&direction,
		&out.FileID,
		&out.FileName,
		&out.Size,
		&status,
		&out.Error,
		&out.UploadVideoFaststartApplied,
		&out.UploadVideoFaststartFallback,
		&out.UploadVideoPreviewAttached,
		&out.UploadVideoPreviewFallback,
		&out.StartedAt,
		&out.FinishedAt,
		&out.CreatedAt,
		&out.UpdatedAt,
	)
	if err != nil {
		return TransferHistory{}, err
	}
	out.Direction = TransferDirection(direction)
	out.Status = TransferStatus(status)
	return out, nil
}

func (s *Store) ListTransferHistory(
	ctx context.Context,
	direction *TransferDirection,
	page int,
	pageSize int,
) ([]TransferHistory, int64, error) {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 50
	}
	if pageSize > 200 {
		pageSize = 200
	}

	where := []string{"1=1"}
	args := make([]any, 0, 4)
	add := func(cond string, val any) {
		args = append(args, val)
		where = append(where, fmt.Sprintf(cond, len(args)))
	}

	if direction != nil && strings.TrimSpace(string(*direction)) != "" {
		add("direction = $%d", string(*direction))
	}

	whereSQL := strings.Join(where, " AND ")

	var total int64
	if err := s.db.QueryRow(
		ctx,
		`SELECT count(*) FROM transfer_history WHERE `+whereSQL,
		args...,
	).Scan(&total); err != nil {
		return nil, 0, err
	}

	limit := pageSize
	offset := (page - 1) * pageSize
	args = append(args, limit, offset)
	limitArg := len(args) - 1
	offsetArg := len(args)

	query := fmt.Sprintf(`
SELECT
  id, source_task_id, direction, file_id, file_name, size, status, error,
  upload_video_faststart_applied, upload_video_faststart_fallback, upload_video_preview_attached, upload_video_preview_fallback,
  started_at, finished_at, created_at, updated_at
FROM transfer_history
WHERE %s
ORDER BY finished_at DESC, updated_at DESC, created_at DESC
LIMIT $%d OFFSET $%d
`, whereSQL, limitArg, offsetArg)

	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	items := make([]TransferHistory, 0)
	for rows.Next() {
		var (
			item      TransferHistory
			direction string
			status    string
		)
		if err := rows.Scan(
			&item.ID,
			&item.SourceTaskID,
			&direction,
			&item.FileID,
			&item.FileName,
			&item.Size,
			&status,
			&item.Error,
			&item.UploadVideoFaststartApplied,
			&item.UploadVideoFaststartFallback,
			&item.UploadVideoPreviewAttached,
			&item.UploadVideoPreviewFallback,
			&item.StartedAt,
			&item.FinishedAt,
			&item.CreatedAt,
			&item.UpdatedAt,
		); err != nil {
			return nil, 0, err
		}
		item.Direction = TransferDirection(direction)
		item.Status = TransferStatus(status)
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (s *Store) DeleteTransferHistoryByID(ctx context.Context, id uuid.UUID) error {
	ct, err := s.db.Exec(ctx, `DELETE FROM transfer_history WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) DeleteTransferHistoryOlderThan(ctx context.Context, cutoff time.Time) (int64, error) {
	ct, err := s.db.Exec(ctx, `DELETE FROM transfer_history WHERE finished_at < $1`, cutoff)
	if err != nil {
		return 0, err
	}
	return ct.RowsAffected(), nil
}

func (s *Store) DeleteAllTransferHistory(ctx context.Context) (int64, error) {
	ct, err := s.db.Exec(ctx, `DELETE FROM transfer_history`)
	if err != nil {
		return 0, err
	}
	return ct.RowsAffected(), nil
}

func (s *Store) CleanupTransferHistoryOlderThan(ctx context.Context, cutoff time.Time, limit int) (int64, error) {
	if limit <= 0 {
		limit = 100
	}
	ct, err := s.db.Exec(
		ctx,
		`DELETE FROM transfer_history
WHERE id IN (
  SELECT id
  FROM transfer_history
  WHERE finished_at < $1
  ORDER BY finished_at ASC
  LIMIT $2
)`,
		cutoff,
		limit,
	)
	if err != nil {
		return 0, err
	}
	return ct.RowsAffected(), nil
}

func parseTransferDirection(raw string) (TransferDirection, error) {
	v := TransferDirection(strings.ToLower(strings.TrimSpace(raw)))
	switch v {
	case TransferDirectionUpload, TransferDirectionDownload:
		return v, nil
	default:
		return "", ErrBadInput
	}
}

func parseTransferStatus(raw string) (TransferStatus, error) {
	v := TransferStatus(strings.ToLower(strings.TrimSpace(raw)))
	switch v {
	case TransferStatusCompleted, TransferStatusError, TransferStatusCanceled:
		return v, nil
	default:
		return "", ErrBadInput
	}
}

func IsValidTransferDirection(raw string) bool {
	_, err := parseTransferDirection(raw)
	return !errors.Is(err, ErrBadInput)
}

func IsValidTransferStatus(raw string) bool {
	_, err := parseTransferStatus(raw)
	return !errors.Is(err, ErrBadInput)
}
