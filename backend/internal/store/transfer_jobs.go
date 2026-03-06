package store

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

func (s *Store) CreateTransferJob(ctx context.Context, job TransferJob) error {
	const q = `
INSERT INTO transfer_jobs(
  id, direction, source_kind, source_ref, unit_kind, name, target_item_id,
  total_size, item_count, completed_count, error_count, canceled_count, status, last_error,
  started_at, finished_at, created_at, updated_at
) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
`
	_, err := s.db.Exec(ctx, q,
		job.ID,
		string(job.Direction),
		string(job.SourceKind),
		job.SourceRef,
		string(job.UnitKind),
		job.Name,
		job.TargetItemID,
		job.TotalSize,
		job.ItemCount,
		job.CompletedCount,
		job.ErrorCount,
		job.CanceledCount,
		string(job.Status),
		job.LastError,
		job.StartedAt,
		job.FinishedAt,
		job.CreatedAt,
		job.UpdatedAt,
	)
	return err
}

func (s *Store) UpsertTransferJob(ctx context.Context, job TransferJob) (TransferJob, error) {
	const q = `
INSERT INTO transfer_jobs(
  id, direction, source_kind, source_ref, unit_kind, name, target_item_id,
  total_size, item_count, completed_count, error_count, canceled_count, status, last_error,
  started_at, finished_at, created_at, updated_at
)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
ON CONFLICT (direction, source_kind, source_ref) DO UPDATE SET
  unit_kind = EXCLUDED.unit_kind,
  name = EXCLUDED.name,
  target_item_id = EXCLUDED.target_item_id,
  total_size = EXCLUDED.total_size,
  item_count = EXCLUDED.item_count,
  completed_count = EXCLUDED.completed_count,
  error_count = EXCLUDED.error_count,
  canceled_count = EXCLUDED.canceled_count,
  status = EXCLUDED.status,
  last_error = EXCLUDED.last_error,
  started_at = EXCLUDED.started_at,
  finished_at = EXCLUDED.finished_at,
  updated_at = now()
RETURNING
  id, direction, source_kind, source_ref, unit_kind, name, target_item_id,
  total_size, item_count, completed_count, error_count, canceled_count, status, last_error,
  started_at, finished_at, created_at, updated_at
`
	row := s.db.QueryRow(ctx, q,
		job.ID,
		string(job.Direction),
		string(job.SourceKind),
		job.SourceRef,
		string(job.UnitKind),
		job.Name,
		job.TargetItemID,
		job.TotalSize,
		job.ItemCount,
		job.CompletedCount,
		job.ErrorCount,
		job.CanceledCount,
		string(job.Status),
		job.LastError,
		job.StartedAt,
		job.FinishedAt,
		job.CreatedAt,
		job.UpdatedAt,
	)
	return scanTransferJob(row)
}

func (s *Store) GetTransferJobByID(ctx context.Context, id uuid.UUID) (TransferJob, error) {
	const q = `
SELECT
  id, direction, source_kind, source_ref, unit_kind, name, target_item_id,
  total_size, item_count, completed_count, error_count, canceled_count, status, last_error,
  started_at, finished_at, created_at, updated_at
FROM transfer_jobs
WHERE id = $1
`
	return scanTransferJob(s.db.QueryRow(ctx, q, id))
}

func (s *Store) GetTransferJobBySource(
	ctx context.Context,
	direction TransferDirection,
	sourceKind TransferSourceKind,
	sourceRef string,
) (TransferJob, error) {
	const q = `
SELECT
  id, direction, source_kind, source_ref, unit_kind, name, target_item_id,
  total_size, item_count, completed_count, error_count, canceled_count, status, last_error,
  started_at, finished_at, created_at, updated_at
FROM transfer_jobs
WHERE direction = $1 AND source_kind = $2 AND source_ref = $3
`
	return scanTransferJob(s.db.QueryRow(ctx, q, string(direction), string(sourceKind), sourceRef))
}

func (s *Store) ListTransferJobs(
	ctx context.Context,
	direction *TransferDirection,
	page int,
	pageSize int,
) ([]TransferJob, int64, error) {
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
	if direction != nil {
		dirRaw := strings.TrimSpace(string(*direction))
		if dirRaw != "" {
			args = append(args, dirRaw)
			where = append(where, fmt.Sprintf("direction = $%d", len(args)))
		}
	}
	whereSQL := strings.Join(where, " AND ")

	var total int64
	if err := s.db.QueryRow(ctx, `SELECT count(*) FROM transfer_jobs WHERE `+whereSQL, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	args = append(args, pageSize, (page-1)*pageSize)
	limitArg := len(args) - 1
	offsetArg := len(args)
	query := fmt.Sprintf(`
SELECT
  id, direction, source_kind, source_ref, unit_kind, name, target_item_id,
  total_size, item_count, completed_count, error_count, canceled_count, status, last_error,
  started_at, finished_at, created_at, updated_at
FROM transfer_jobs
WHERE %s
ORDER BY finished_at DESC, updated_at DESC, created_at DESC
LIMIT $%d OFFSET $%d
`, whereSQL, limitArg, offsetArg)
	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	out := make([]TransferJob, 0)
	for rows.Next() {
		item, scanErr := scanTransferJob(rows)
		if scanErr != nil {
			return nil, 0, scanErr
		}
		out = append(out, item)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	return out, total, nil
}

func (s *Store) DeleteTransferJobByID(ctx context.Context, id uuid.UUID) error {
	ct, err := s.db.Exec(ctx, `DELETE FROM transfer_jobs WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) UpdateTransferJobProgress(
	ctx context.Context,
	id uuid.UUID,
	completedCount int,
	errorCount int,
	canceledCount int,
	status TransferJobStatus,
	lastError *string,
	finishedAt time.Time,
) error {
	ct, err := s.db.Exec(
		ctx,
		`UPDATE transfer_jobs
SET completed_count = $2,
    error_count = $3,
    canceled_count = $4,
    status = $5,
    last_error = $6,
    finished_at = $7,
    updated_at = $7
WHERE id = $1`,
		id,
		completedCount,
		errorCount,
		canceledCount,
		string(status),
		lastError,
		finishedAt,
	)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

type transferJobScanner interface {
	Scan(dest ...any) error
}

func scanTransferJob(scanner transferJobScanner) (TransferJob, error) {
	var (
		out         TransferJob
		direction   string
		sourceKind  string
		unitKind    string
		status      string
	)
	err := scanner.Scan(
		&out.ID,
		&direction,
		&sourceKind,
		&out.SourceRef,
		&unitKind,
		&out.Name,
		&out.TargetItemID,
		&out.TotalSize,
		&out.ItemCount,
		&out.CompletedCount,
		&out.ErrorCount,
		&out.CanceledCount,
		&status,
		&out.LastError,
		&out.StartedAt,
		&out.FinishedAt,
		&out.CreatedAt,
		&out.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return TransferJob{}, ErrNotFound
		}
		return TransferJob{}, err
	}
	out.Direction = TransferDirection(direction)
	out.SourceKind = TransferSourceKind(sourceKind)
	out.UnitKind = TransferUnitKind(unitKind)
	out.Status = TransferJobStatus(status)
	return out, nil
}
