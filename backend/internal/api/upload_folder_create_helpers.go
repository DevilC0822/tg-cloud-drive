package api

import (
	"context"
	"errors"
	"strings"
	"time"

	"tg-cloud-drive-api/internal/store"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

func resolveUploadFolderParentPathTx(
	ctx context.Context,
	tx pgx.Tx,
	parentID *uuid.UUID,
) (string, error) {
	if parentID == nil {
		return "/", nil
	}

	var path string
	err := tx.QueryRow(ctx, `SELECT path FROM items WHERE id = $1 AND type = 'folder'`, *parentID).Scan(&path)
	if err == nil {
		return path, nil
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return "", store.ErrBadInput
	}
	return "", err
}

func assertUploadFolderPathsAvailableTx(
	ctx context.Context,
	tx pgx.Tx,
	parentPath string,
	manifest uploadFolderManifest,
) error {
	rootPath := store.BuildChildPath(parentPath, manifest.RootName)
	paths := collectUploadFolderTargetPaths(parentPath, manifest)
	conflicts, err := collectUploadFolderConflictPathsTx(ctx, tx, paths)
	if err != nil {
		return err
	}
	if len(conflicts) == 0 {
		return nil
	}
	if !shouldCleanupUploadFolderOrphans(rootPath, conflicts) {
		return store.ErrConflict
	}
	return deleteUploadFolderOrphansTx(ctx, tx, rootPath)
}

func collectUploadFolderTargetPaths(parentPath string, manifest uploadFolderManifest) []string {
	rootPath := store.BuildChildPath(parentPath, manifest.RootName)
	paths := make([]string, 0, 1+len(manifest.Directories)+len(manifest.Files))
	paths = append(paths, rootPath)
	for _, directory := range manifest.Directories {
		paths = append(paths, buildUploadFolderItemPath(rootPath, directory.RelativePath))
	}
	for _, file := range manifest.Files {
		paths = append(paths, buildUploadFolderItemPath(rootPath, file.RelativePath))
	}
	return paths
}

func buildUploadFolderItemPath(rootPath string, relativePath string) string {
	if strings.TrimSpace(relativePath) == "" {
		return rootPath
	}
	return store.BuildChildPath(rootPath, relativePath)
}

func insertUploadFolderRootTx(
	ctx context.Context,
	tx pgx.Tx,
	parentID *uuid.UUID,
	parentPath string,
	rootName string,
	now time.Time,
) (store.Item, error) {
	return insertUploadFolderItemTx(ctx, tx, parentID, store.ItemTypeFolder, rootName, 0, nil, store.BuildChildPath(parentPath, rootName), now)
}

func insertUploadFolderDirectoriesTx(
	ctx context.Context,
	tx pgx.Tx,
	batchID uuid.UUID,
	root store.Item,
	directories []uploadFolderDirectory,
	now time.Time,
) (map[string]uuid.UUID, error) {
	ids := map[string]uuid.UUID{"": root.ID}
	if err := insertUploadFolderEntryTx(ctx, tx, buildRootUploadFolderEntry(batchID, root, now)); err != nil {
		return nil, err
	}

	for _, directory := range directories {
		parentID := resolveUploadFolderEntryParentID(ids, directory.ParentRelativePath)
		item, err := insertUploadFolderItemTx(ctx, tx, parentID, store.ItemTypeFolder, directory.Name, 0, nil, buildUploadFolderItemPath(root.Path, directory.RelativePath), now)
		if err != nil {
			return nil, err
		}
		ids[directory.RelativePath] = item.ID
		entry := buildDirectoryUploadFolderEntry(batchID, directory, item.ID, now)
		if err := insertUploadFolderEntryTx(ctx, tx, entry); err != nil {
			return nil, err
		}
	}
	return ids, nil
}

func insertUploadFolderFilesTx(
	ctx context.Context,
	tx pgx.Tx,
	batchID uuid.UUID,
	root store.Item,
	ids map[string]uuid.UUID,
	files []uploadFolderFile,
	accessMethod string,
	chunkSizeLimit int64,
	now time.Time,
) error {
	for _, file := range files {
		parentID := resolveUploadFolderEntryParentID(ids, file.ParentRelativePath)
		item, err := insertUploadFolderItemTx(ctx, tx, parentID, file.ItemType, file.Name, 0, file.MimeType, buildUploadFolderItemPath(root.Path, file.RelativePath), now)
		if err != nil {
			return err
		}
		session := buildUploadFolderSession(batchID, item.ID, file, accessMethod, chunkSizeLimit, now)
		if err := insertUploadSessionTx(ctx, tx, session); err != nil {
			return err
		}
		entry := buildFileUploadFolderEntry(batchID, file, item.ID, session.ID, now)
		if err := insertUploadFolderEntryTx(ctx, tx, entry); err != nil {
			return err
		}
	}
	return nil
}

func resolveUploadFolderEntryParentID(ids map[string]uuid.UUID, parentRelativePath *string) *uuid.UUID {
	key := ""
	if parentRelativePath != nil {
		key = *parentRelativePath
	}
	value, ok := ids[key]
	if !ok {
		return nil
	}
	return &value
}

func insertUploadFolderItemTx(
	ctx context.Context,
	tx pgx.Tx,
	parentID *uuid.UUID,
	itemType store.ItemType,
	name string,
	size int64,
	mimeType *string,
	path string,
	now time.Time,
) (store.Item, error) {
	id := uuid.New()
	var parent any
	if parentID != nil {
		parent = *parentID
	}
	_, err := tx.Exec(ctx, `
INSERT INTO items(id, type, name, parent_id, path, size, mime_type, last_accessed_at,
  shared_code, shared_enabled, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, NULL, FALSE, $8, $8)
`, id, string(itemType), name, parent, path, size, mimeType, now)
	if err != nil {
		return store.Item{}, err
	}
	return store.Item{
		ID:        id,
		Type:      itemType,
		Name:      name,
		ParentID:  parentID,
		Path:      path,
		Size:      size,
		MimeType:  mimeType,
		CreatedAt: now,
		UpdatedAt: now,
	}, nil
}

func buildUploadFolderSession(
	batchID uuid.UUID,
	itemID uuid.UUID,
	file uploadFolderFile,
	accessMethod string,
	chunkSizeLimit int64,
	now time.Time,
) store.UploadSession {
	limit := resolveUploadFolderChunkSize(accessMethod, file.Name, strOrEmpty(file.MimeType), file.Size, chunkSizeLimit)
	totalChunks := int((file.Size + limit - 1) / limit)
	return store.UploadSession{
		ID:              uuid.New(),
		ItemID:          itemID,
		TransferBatchID: &batchID,
		FileName:        file.Name,
		MimeType:        file.MimeType,
		FileSize:        file.Size,
		ChunkSize:       int(limit),
		TotalChunks:     totalChunks,
		UploadedChunks:  0,
		AccessMethod:    accessMethod,
		UploadMode:      resolveUploadSessionModeForCreate(accessMethod, file.Name, strOrEmpty(file.MimeType), file.Size),
		Status:          store.UploadSessionStatusUploading,
		CreatedAt:       now,
		UpdatedAt:       now,
	}
}

func resolveUploadFolderChunkSize(
	accessMethod string,
	fileName string,
	mimeType string,
	fileSize int64,
	configured int64,
) int64 {
	limit := configured
	if limit <= 0 {
		limit = 20 * 1024 * 1024
	}
	if normalizeUploadAccessMethod(accessMethod) == setupAccessMethodOfficial {
		singleLimit := officialBotAPISingleUploadLimitBytes(fileName, mimeType)
		if limit > singleLimit {
			limit = singleLimit
		}
	}
	if fileSize > 0 && limit > fileSize {
		return fileSize
	}
	return limit
}

func insertUploadSessionTx(ctx context.Context, tx pgx.Tx, session store.UploadSession) error {
	_, err := tx.Exec(ctx, `
INSERT INTO upload_sessions(
  id, item_id, transfer_batch_id, file_name, mime_type, file_size, chunk_size, total_chunks, uploaded_chunks_count, access_method, upload_mode, status, created_at, updated_at
) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
`,
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

func insertUploadFolderBatchMetaTx(
	ctx context.Context,
	tx pgx.Tx,
	batchID uuid.UUID,
	parentID *uuid.UUID,
	rootItemID uuid.UUID,
	manifest uploadFolderManifest,
	now time.Time,
) error {
	_, err := tx.Exec(ctx, `
INSERT INTO upload_folder_batches(
  transfer_batch_id, root_name, root_parent_id, root_item_id, total_directories, total_files, total_size, created_at, updated_at
) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
`,
		batchID,
		manifest.RootName,
		parentID,
		rootItemID,
		len(manifest.Directories)+1,
		len(manifest.Files),
		manifest.TotalSize,
		now,
		now,
	)
	return err
}

func insertTransferJobTx(ctx context.Context, tx pgx.Tx, job store.TransferJob) error {
	_, err := tx.Exec(ctx, `
INSERT INTO transfer_jobs(
  id, direction, source_kind, source_ref, unit_kind, name, target_item_id,
  total_size, item_count, completed_count, error_count, canceled_count, status, last_error,
  started_at, finished_at, created_at, updated_at
) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
`,
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

func buildRootUploadFolderEntry(batchID uuid.UUID, root store.Item, now time.Time) store.UploadFolderEntry {
	return store.UploadFolderEntry{
		ID:              uuid.New(),
		TransferBatchID: batchID,
		EntryType:       store.UploadFolderEntryTypeFolder,
		RelativePath:    "",
		Name:            root.Name,
		Depth:           0,
		ItemID:          &root.ID,
		Status:          store.UploadFolderEntryStatusCompleted,
		CreatedAt:       now,
		UpdatedAt:       now,
	}
}

func buildDirectoryUploadFolderEntry(
	batchID uuid.UUID,
	directory uploadFolderDirectory,
	itemID uuid.UUID,
	now time.Time,
) store.UploadFolderEntry {
	return store.UploadFolderEntry{
		ID:                 uuid.New(),
		TransferBatchID:    batchID,
		EntryType:          store.UploadFolderEntryTypeFolder,
		RelativePath:       directory.RelativePath,
		ParentRelativePath: directory.ParentRelativePath,
		Name:               directory.Name,
		Depth:              directory.Depth,
		ItemID:             &itemID,
		Status:             store.UploadFolderEntryStatusCompleted,
		CreatedAt:          now,
		UpdatedAt:          now,
	}
}

func buildFileUploadFolderEntry(
	batchID uuid.UUID,
	file uploadFolderFile,
	itemID uuid.UUID,
	sessionID uuid.UUID,
	now time.Time,
) store.UploadFolderEntry {
	return store.UploadFolderEntry{
		ID:                 uuid.New(),
		TransferBatchID:    batchID,
		EntryType:          store.UploadFolderEntryTypeFile,
		RelativePath:       file.RelativePath,
		ParentRelativePath: file.ParentRelativePath,
		Name:               file.Name,
		Depth:              file.Depth,
		Size:               file.Size,
		MimeType:           file.MimeType,
		ItemID:             &itemID,
		UploadSessionID:    &sessionID,
		Status:             store.UploadFolderEntryStatusPending,
		CreatedAt:          now,
		UpdatedAt:          now,
	}
}

func insertUploadFolderEntryTx(ctx context.Context, tx pgx.Tx, entry store.UploadFolderEntry) error {
	_, err := tx.Exec(ctx, `
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
	return err
}
