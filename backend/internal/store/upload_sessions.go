package store

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

func (s *Store) CreateUploadSession(ctx context.Context, session UploadSession) error {
	const q = `
INSERT INTO upload_sessions(
  id, item_id, file_name, mime_type, file_size, chunk_size, total_chunks, access_method, status, created_at, updated_at
) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
`
	_, err := s.db.Exec(
		ctx,
		q,
		session.ID,
		session.ItemID,
		session.FileName,
		session.MimeType,
		session.FileSize,
		session.ChunkSize,
		session.TotalChunks,
		session.AccessMethod,
		string(session.Status),
		session.CreatedAt,
		session.UpdatedAt,
	)
	return err
}

func (s *Store) GetUploadSession(ctx context.Context, id uuid.UUID) (UploadSession, error) {
	const q = `
SELECT id, item_id, file_name, mime_type, file_size, chunk_size, total_chunks, access_method, status, created_at, updated_at
FROM upload_sessions
WHERE id = $1
`
	var out UploadSession
	var status string
	err := s.db.QueryRow(ctx, q, id).Scan(
		&out.ID,
		&out.ItemID,
		&out.FileName,
		&out.MimeType,
		&out.FileSize,
		&out.ChunkSize,
		&out.TotalChunks,
		&out.AccessMethod,
		&status,
		&out.CreatedAt,
		&out.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return UploadSession{}, ErrNotFound
		}
		return UploadSession{}, err
	}
	if out.AccessMethod == "" {
		out.AccessMethod = "official_bot_api"
	}
	out.Status = UploadSessionStatus(status)
	return out, nil
}

func (s *Store) TouchUploadSession(ctx context.Context, id uuid.UUID, now time.Time) error {
	ct, err := s.db.Exec(ctx, `UPDATE upload_sessions SET updated_at = $2 WHERE id = $1`, id, now)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) SetUploadSessionStatus(ctx context.Context, id uuid.UUID, status UploadSessionStatus, now time.Time) error {
	ct, err := s.db.Exec(ctx, `UPDATE upload_sessions SET status = $2, updated_at = $3 WHERE id = $1`, id, string(status), now)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) ListUploadedChunkIndices(ctx context.Context, itemID uuid.UUID) ([]int, error) {
	rows, err := s.db.Query(ctx, `SELECT chunk_index FROM telegram_chunks WHERE item_id = $1 ORDER BY chunk_index ASC`, itemID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []int
	for rows.Next() {
		var idx int
		if err := rows.Scan(&idx); err != nil {
			return nil, err
		}
		out = append(out, idx)
	}
	return out, rows.Err()
}

func (s *Store) HasChunkIndex(ctx context.Context, itemID uuid.UUID, chunkIndex int) (bool, error) {
	var n int
	if err := s.db.QueryRow(
		ctx,
		`SELECT count(*) FROM telegram_chunks WHERE item_id = $1 AND chunk_index = $2`,
		itemID,
		chunkIndex,
	).Scan(&n); err != nil {
		return false, err
	}
	return n > 0, nil
}

func (s *Store) ListExpiredUploadSessions(ctx context.Context, updatedBefore time.Time, limit int) ([]UploadSession, error) {
	if limit <= 0 {
		limit = 1
	}

	const q = `
SELECT id, item_id, file_name, mime_type, file_size, chunk_size, total_chunks, access_method, status, created_at, updated_at
FROM upload_sessions
WHERE status <> $1 AND updated_at < $2
ORDER BY updated_at ASC
LIMIT $3
`
	rows, err := s.db.Query(ctx, q, string(UploadSessionStatusCompleted), updatedBefore, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]UploadSession, 0)
	for rows.Next() {
		var (
			session UploadSession
			status  string
		)
		if err := rows.Scan(
			&session.ID,
			&session.ItemID,
			&session.FileName,
			&session.MimeType,
			&session.FileSize,
			&session.ChunkSize,
			&session.TotalChunks,
			&session.AccessMethod,
			&status,
			&session.CreatedAt,
			&session.UpdatedAt,
		); err != nil {
			return nil, err
		}
		if session.AccessMethod == "" {
			session.AccessMethod = "official_bot_api"
		}
		session.Status = UploadSessionStatus(status)
		out = append(out, session)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}
