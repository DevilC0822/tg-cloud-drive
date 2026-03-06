package store

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

func (s *Store) CreateUploadFolderBatch(ctx context.Context, batch UploadFolderBatch) error {
	const q = `
INSERT INTO upload_folder_batches(
  transfer_batch_id, root_name, root_parent_id, root_item_id, total_directories, total_files, total_size, created_at, updated_at
) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
`
	_, err := s.db.Exec(
		ctx,
		q,
		batch.TransferBatchID,
		batch.RootName,
		batch.RootParentID,
		batch.RootItemID,
		batch.TotalDirectories,
		batch.TotalFiles,
		batch.TotalSize,
		batch.CreatedAt,
		batch.UpdatedAt,
	)
	return err
}

func (s *Store) GetUploadFolderBatch(ctx context.Context, batchID uuid.UUID) (UploadFolderBatch, error) {
	const q = `
SELECT transfer_batch_id, root_name, root_parent_id, root_item_id, total_directories, total_files, total_size, created_at, updated_at
FROM upload_folder_batches
WHERE transfer_batch_id = $1
`
	var out UploadFolderBatch
	err := s.db.QueryRow(ctx, q, batchID).Scan(
		&out.TransferBatchID,
		&out.RootName,
		&out.RootParentID,
		&out.RootItemID,
		&out.TotalDirectories,
		&out.TotalFiles,
		&out.TotalSize,
		&out.CreatedAt,
		&out.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return UploadFolderBatch{}, ErrNotFound
		}
		return UploadFolderBatch{}, err
	}
	return out, nil
}

func (s *Store) DeleteUploadFolderBatch(ctx context.Context, batchID uuid.UUID) error {
	ct, err := s.db.Exec(ctx, `DELETE FROM upload_folder_batches WHERE transfer_batch_id = $1`, batchID)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) InsertUploadFolderEntries(ctx context.Context, entries []UploadFolderEntry) error {
	if len(entries) == 0 {
		return nil
	}

	batch := &pgx.Batch{}
	for _, entry := range entries {
		batch.Queue(`
INSERT INTO upload_folder_entries(
  id, transfer_batch_id, entry_type, relative_path, parent_relative_path, name, depth, size, mime_type, item_id, upload_session_id, status, error, created_at, updated_at
) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
`,
			entry.ID,
			entry.TransferBatchID,
			string(entry.EntryType),
			entry.RelativePath,
			entry.ParentRelativePath,
			entry.Name,
			entry.Depth,
			entry.Size,
			entry.MimeType,
			entry.ItemID,
			entry.UploadSessionID,
			string(entry.Status),
			entry.Error,
			entry.CreatedAt,
			entry.UpdatedAt,
		)
	}

	results := s.db.SendBatch(ctx, batch)
	defer results.Close()
	for range entries {
		if _, err := results.Exec(); err != nil {
			return err
		}
	}
	return results.Close()
}

func (s *Store) ListUploadFolderEntriesByBatch(ctx context.Context, batchID uuid.UUID) ([]UploadFolderEntry, error) {
	const q = `
SELECT
  id, transfer_batch_id, entry_type, relative_path, parent_relative_path, name, depth, size, mime_type, item_id, upload_session_id, status, error, created_at, updated_at
FROM upload_folder_entries
WHERE transfer_batch_id = $1
ORDER BY depth ASC, relative_path ASC
`
	rows, err := s.db.Query(ctx, q, batchID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]UploadFolderEntry, 0)
	for rows.Next() {
		item, scanErr := scanUploadFolderEntry(rows)
		if scanErr != nil {
			return nil, scanErr
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

func (s *Store) ListUploadFolderEntriesPage(
	ctx context.Context,
	batchID uuid.UUID,
	afterRelativePath string,
	limit int,
) ([]UploadFolderEntry, error) {
	if limit <= 0 {
		limit = 100
	}
	if limit > 500 {
		limit = 500
	}

	const q = `
SELECT
  id, transfer_batch_id, entry_type, relative_path, parent_relative_path, name, depth, size, mime_type, item_id, upload_session_id, status, error, created_at, updated_at
FROM upload_folder_entries
WHERE transfer_batch_id = $1
  AND entry_type = $2
  AND relative_path > $3
ORDER BY relative_path ASC
LIMIT $4
`
	rows, err := s.db.Query(ctx, q, batchID, string(UploadFolderEntryTypeFile), afterRelativePath, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]UploadFolderEntry, 0, limit)
	for rows.Next() {
		item, scanErr := scanUploadFolderEntry(rows)
		if scanErr != nil {
			return nil, scanErr
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

func (s *Store) GetUploadFolderEntryBySessionID(ctx context.Context, sessionID uuid.UUID) (UploadFolderEntry, error) {
	const q = `
SELECT
  id, transfer_batch_id, entry_type, relative_path, parent_relative_path, name, depth, size, mime_type, item_id, upload_session_id, status, error, created_at, updated_at
FROM upload_folder_entries
WHERE upload_session_id = $1
`
	var out UploadFolderEntry
	err := s.db.QueryRow(ctx, q, sessionID).Scan(
		&out.ID,
		&out.TransferBatchID,
		&out.EntryType,
		&out.RelativePath,
		&out.ParentRelativePath,
		&out.Name,
		&out.Depth,
		&out.Size,
		&out.MimeType,
		&out.ItemID,
		&out.UploadSessionID,
		&out.Status,
		&out.Error,
		&out.CreatedAt,
		&out.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return UploadFolderEntry{}, ErrNotFound
		}
		return UploadFolderEntry{}, err
	}
	return normalizeUploadFolderEntry(out), nil
}

func (s *Store) SetUploadFolderEntryStatusBySessionID(
	ctx context.Context,
	sessionID uuid.UUID,
	status UploadFolderEntryStatus,
	errText *string,
	now time.Time,
) error {
	ct, err := s.db.Exec(
		ctx,
		`UPDATE upload_folder_entries SET status = $2, error = $3, updated_at = $4 WHERE upload_session_id = $1`,
		sessionID,
		string(status),
		errText,
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

type uploadFolderEntryScanner interface {
	Scan(dest ...any) error
}

func scanUploadFolderEntry(scanner uploadFolderEntryScanner) (UploadFolderEntry, error) {
	var (
		out       UploadFolderEntry
		entryType string
		status    string
	)
	err := scanner.Scan(
		&out.ID,
		&out.TransferBatchID,
		&entryType,
		&out.RelativePath,
		&out.ParentRelativePath,
		&out.Name,
		&out.Depth,
		&out.Size,
		&out.MimeType,
		&out.ItemID,
		&out.UploadSessionID,
		&status,
		&out.Error,
		&out.CreatedAt,
		&out.UpdatedAt,
	)
	if err != nil {
		return UploadFolderEntry{}, err
	}
	out.EntryType = UploadFolderEntryType(entryType)
	out.Status = UploadFolderEntryStatus(status)
	return normalizeUploadFolderEntry(out), nil
}

func normalizeUploadFolderEntry(entry UploadFolderEntry) UploadFolderEntry {
	if entry.ParentRelativePath != nil && *entry.ParentRelativePath == "" {
		entry.ParentRelativePath = nil
	}
	return entry
}
