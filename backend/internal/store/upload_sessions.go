package store

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgconn"
	"github.com/jackc/pgx/v5"
)

func (s *Store) CreateUploadSession(ctx context.Context, session UploadSession) error {
	const q = `
INSERT INTO upload_sessions(
  id, item_id, transfer_batch_id, file_name, mime_type, file_size, chunk_size, total_chunks, uploaded_chunks_count, access_method, upload_mode, status, created_at, updated_at
) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
`
	_, err := s.db.Exec(
		ctx,
		q,
		session.ID,
		session.ItemID,
		session.TransferBatchID,
		session.FileName,
		session.MimeType,
		session.FileSize,
		session.ChunkSize,
		session.TotalChunks,
		session.UploadedChunks,
		session.AccessMethod,
		string(session.UploadMode),
		string(session.Status),
		session.CreatedAt,
		session.UpdatedAt,
	)
	return err
}

func (s *Store) GetUploadSession(ctx context.Context, id uuid.UUID) (UploadSession, error) {
	const q = `
SELECT id, item_id, transfer_batch_id, file_name, mime_type, file_size, chunk_size, total_chunks, uploaded_chunks_count, access_method, upload_mode, status, created_at, updated_at
FROM upload_sessions
WHERE id = $1
`
	var out UploadSession
	var (
		status string
		mode   string
	)
	err := s.db.QueryRow(ctx, q, id).Scan(
		&out.ID,
		&out.ItemID,
		&out.TransferBatchID,
		&out.FileName,
		&out.MimeType,
		&out.FileSize,
		&out.ChunkSize,
		&out.TotalChunks,
		&out.UploadedChunks,
		&out.AccessMethod,
		&mode,
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
	out.UploadMode = parseUploadSessionMode(mode)
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

func (s *Store) SetUploadSessionProgress(ctx context.Context, id uuid.UUID, uploadedChunks int, now time.Time) error {
	ct, err := s.db.Exec(
		ctx,
		`UPDATE upload_sessions SET uploaded_chunks_count = $2, updated_at = $3 WHERE id = $1`,
		id,
		uploadedChunks,
		now,
	)
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

func (s *Store) CountUploadedChunks(ctx context.Context, itemID uuid.UUID) (int, error) {
	var count int
	if err := s.db.QueryRow(ctx, `SELECT count(*) FROM telegram_chunks WHERE item_id = $1`, itemID).Scan(&count); err != nil {
		return 0, err
	}
	return count, nil
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
SELECT id, item_id, transfer_batch_id, file_name, mime_type, file_size, chunk_size, total_chunks, uploaded_chunks_count, access_method, upload_mode, status, created_at, updated_at
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
			mode    string
		)
		if err := rows.Scan(
			&session.ID,
			&session.ItemID,
			&session.TransferBatchID,
			&session.FileName,
			&session.MimeType,
			&session.FileSize,
			&session.ChunkSize,
			&session.TotalChunks,
			&session.UploadedChunks,
			&session.AccessMethod,
			&mode,
			&status,
			&session.CreatedAt,
			&session.UpdatedAt,
		); err != nil {
			return nil, err
		}
		if session.AccessMethod == "" {
			session.AccessMethod = "official_bot_api"
		}
		session.UploadMode = parseUploadSessionMode(mode)
		session.Status = UploadSessionStatus(status)
		out = append(out, session)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

type UploadBatchProgress struct {
	Total     int
	Completed int
	Failed    int
}

func (s *Store) ListUploadSessionsByBatch(ctx context.Context, batchID uuid.UUID) ([]UploadSession, error) {
	const q = `
SELECT id, item_id, transfer_batch_id, file_name, mime_type, file_size, chunk_size, total_chunks, uploaded_chunks_count, access_method, upload_mode, status, created_at, updated_at
FROM upload_sessions
WHERE transfer_batch_id = $1
ORDER BY created_at ASC, updated_at ASC
`
	rows, err := s.db.Query(ctx, q, batchID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]UploadSession, 0)
	for rows.Next() {
		session, scanErr := scanUploadSessionRow(rows)
		if scanErr != nil {
			return nil, scanErr
		}
		items = append(items, session)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

func (s *Store) CountUploadSessionsByBatch(ctx context.Context, batchID uuid.UUID) (UploadBatchProgress, error) {
	const q = `
SELECT
  count(*)::int AS total,
  count(*) FILTER (WHERE status = $2)::int AS completed,
  count(*) FILTER (WHERE status = $3)::int AS failed
FROM upload_sessions
WHERE transfer_batch_id = $1
`
	var out UploadBatchProgress
	if err := s.db.QueryRow(
		ctx,
		q,
		batchID,
		string(UploadSessionStatusCompleted),
		string(UploadSessionStatusFailed),
	).Scan(&out.Total, &out.Completed, &out.Failed); err != nil {
		return UploadBatchProgress{}, err
	}
	return out, nil
}

func parseUploadSessionMode(raw string) UploadSessionMode {
	switch UploadSessionMode(raw) {
	case UploadSessionModeDirectChunk, UploadSessionModeLocalStaged:
		return UploadSessionMode(raw)
	default:
		return ""
	}
}

type FinalizeUploadSessionInput struct {
	SessionID      uuid.UUID
	ItemID         uuid.UUID
	ItemSize       int64
	UploadedChunks int
	UpdatedAt      time.Time
	Chunk          *Chunk
}

func (s *Store) FinalizeUploadSession(ctx context.Context, input FinalizeUploadSessionInput) (Item, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return Item{}, err
	}
	defer tx.Rollback(ctx)

	if err := insertUploadChunkTx(ctx, tx, input.Chunk); err != nil {
		return Item{}, err
	}
	if err := updateUploadItemSizeTx(ctx, tx, input.ItemID, input.ItemSize, input.UpdatedAt); err != nil {
		return Item{}, err
	}
	if err := updateUploadSessionStatusTx(ctx, tx, input.SessionID, UploadSessionStatusCompleted, input.UploadedChunks, input.UpdatedAt); err != nil {
		return Item{}, err
	}
	item, err := getItemTx(ctx, tx, input.ItemID)
	if err != nil {
		return Item{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Item{}, err
	}
	return item, nil
}

func insertUploadChunkTx(ctx context.Context, tx pgx.Tx, chunk *Chunk) error {
	if chunk == nil {
		return nil
	}
	const q = `
INSERT INTO telegram_chunks(
  id, item_id, chunk_index, chunk_size, tg_chat_id, tg_message_id, tg_file_id, tg_file_unique_id, sha256, created_at
) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NULL,$9)
`
	_, err := tx.Exec(ctx, q,
		chunk.ID,
		chunk.ItemID,
		chunk.ChunkIndex,
		chunk.ChunkSize,
		chunk.TGChatID,
		chunk.TGMessageID,
		chunk.TGFileID,
		chunk.TGFileUniqueID,
		chunk.CreatedAt,
	)
	if err == nil {
		return nil
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return ErrConflict
	}
	return err
}

func updateUploadItemSizeTx(ctx context.Context, tx pgx.Tx, itemID uuid.UUID, itemSize int64, now time.Time) error {
	ct, err := tx.Exec(ctx, `UPDATE items SET size = $2, updated_at = $3 WHERE id = $1`, itemID, itemSize, now)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

type uploadSessionScanner interface {
	Scan(dest ...any) error
}

func scanUploadSessionRow(scanner uploadSessionScanner) (UploadSession, error) {
	var out UploadSession
	var status string
	var mode string
	err := scanner.Scan(
		&out.ID,
		&out.ItemID,
		&out.TransferBatchID,
		&out.FileName,
		&out.MimeType,
		&out.FileSize,
		&out.ChunkSize,
		&out.TotalChunks,
		&out.UploadedChunks,
		&out.AccessMethod,
		&mode,
		&status,
		&out.CreatedAt,
		&out.UpdatedAt,
	)
	if err != nil {
		return UploadSession{}, err
	}
	if out.AccessMethod == "" {
		out.AccessMethod = "official_bot_api"
	}
	out.UploadMode = parseUploadSessionMode(mode)
	out.Status = UploadSessionStatus(status)
	return out, nil
}

func updateUploadSessionStatusTx(
	ctx context.Context,
	tx pgx.Tx,
	sessionID uuid.UUID,
	status UploadSessionStatus,
	uploadedChunks int,
	now time.Time,
) error {
	ct, err := tx.Exec(
		ctx,
		`UPDATE upload_sessions SET status = $2, uploaded_chunks_count = $3, updated_at = $4 WHERE id = $1`,
		sessionID,
		string(status),
		uploadedChunks,
		now,
	)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func getItemTx(ctx context.Context, tx pgx.Tx, itemID uuid.UUID) (Item, error) {
	const q = `
SELECT id, type, name, parent_id, path, size, mime_type, in_vault, starred, last_accessed_at,
       shared_code, shared_enabled, created_at, updated_at
FROM items
WHERE id = $1
`
	var out Item
	err := tx.QueryRow(ctx, q, itemID).Scan(
		&out.ID, &out.Type, &out.Name, &out.ParentID, &out.Path, &out.Size, &out.MimeType, &out.InVault,
		&out.Starred, &out.LastAccessedAt, &out.SharedCode, &out.SharedEnabled, &out.CreatedAt, &out.UpdatedAt,
	)
	if err == nil {
		return out, nil
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return Item{}, ErrNotFound
	}
	return Item{}, err
}
