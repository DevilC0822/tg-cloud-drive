package store

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgconn"
	"github.com/jackc/pgx/v5"
)

func (s *Store) CreateFolder(ctx context.Context, parentID *uuid.UUID, desiredName string, now time.Time) (Item, error) {
	name := strings.TrimSpace(desiredName)
	if name == "" {
		return Item{}, ErrBadInput
	}

	parentPath, err := s.resolveParentPath(ctx, parentID)
	if err != nil {
		return Item{}, err
	}

	uniqueName, err := s.uniqueName(ctx, parentID, name, nil, "")
	if err != nil {
		return Item{}, err
	}

	id := uuid.New()
	newPath := joinPath(parentPath, uniqueName)

	var parent any
	if parentID != nil {
		parent = *parentID
	}

	const q = `
INSERT INTO items(id, type, name, parent_id, path, size, mime_type, last_accessed_at,
  shared_code, shared_enabled, created_at, updated_at)
VALUES ($1, 'folder', $2, $3, $4, 0, NULL, NULL, NULL, FALSE, $5, $5)
`
	_, err = s.db.Exec(ctx, q, id, uniqueName, parent, newPath, now)
	if err != nil {
		return Item{}, err
	}

	return s.GetItem(ctx, id)
}

func (s *Store) CreateFileItem(ctx context.Context, parentID *uuid.UUID, itemType ItemType, desiredName string, size int64, mimeType *string, now time.Time) (Item, error) {
	name := strings.TrimSpace(desiredName)
	if name == "" {
		return Item{}, ErrBadInput
	}
	if itemType == ItemTypeFolder {
		return Item{}, ErrBadInput
	}

	parentPath, err := s.resolveParentPath(ctx, parentID)
	if err != nil {
		return Item{}, err
	}

	uniqueName, err := s.uniqueName(ctx, parentID, name, nil, "")
	if err != nil {
		return Item{}, err
	}

	id := uuid.New()
	newPath := joinPath(parentPath, uniqueName)

	var parent any
	if parentID != nil {
		parent = *parentID
	}

	const q = `
INSERT INTO items(id, type, name, parent_id, path, size, mime_type, last_accessed_at,
  shared_code, shared_enabled, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, NULL, FALSE, $8, $8)
`
	_, err = s.db.Exec(ctx, q, id, string(itemType), uniqueName, parent, newPath, size, mimeType, now)
	if err != nil {
		return Item{}, err
	}
	return s.GetItem(ctx, id)
}

func (s *Store) InsertChunk(ctx context.Context, c Chunk) error {
	const q = `
INSERT INTO telegram_chunks(
  id, item_id, chunk_index, chunk_size, tg_chat_id, tg_message_id, tg_file_id, tg_file_unique_id, sha256, created_at
) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NULL,$9)
`
	_, err := s.db.Exec(ctx, q,
		c.ID, c.ItemID, c.ChunkIndex, c.ChunkSize, c.TGChatID, c.TGMessageID, c.TGFileID, c.TGFileUniqueID, c.CreatedAt,
	)
	if err != nil {
		var pgerr *pgconn.PgError
		if errors.As(err, &pgerr) && pgerr.Code == "23505" {
			return ErrConflict
		}
	}
	return err
}

func (s *Store) UpdateChunkFileMeta(ctx context.Context, id uuid.UUID, fileID string, fileUniqueID string) error {
	ct, err := s.db.Exec(
		ctx,
		`UPDATE telegram_chunks SET tg_file_id = $2, tg_file_unique_id = $3 WHERE id = $1`,
		id,
		fileID,
		fileUniqueID,
	)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) UpdateItemSize(ctx context.Context, id uuid.UUID, size int64, now time.Time) error {
	ct, err := s.db.Exec(ctx, `UPDATE items SET size = $2, updated_at = $3 WHERE id = $1`, id, size, now)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) UpdateItemVault(ctx context.Context, id uuid.UUID, inVault bool, now time.Time) (Item, error) {
	ct, err := s.db.Exec(ctx, `UPDATE items SET in_vault = $2, updated_at = $3 WHERE id = $1`, id, inVault, now)
	if err != nil {
		return Item{}, err
	}
	if ct.RowsAffected() == 0 {
		return Item{}, ErrNotFound
	}
	return s.GetItem(ctx, id)
}

func (s *Store) UpdateChunkTelegramRef(ctx context.Context, id uuid.UUID, tgMessageID int64, tgFileID string, tgFileUniqueID string, chunkSize int) error {
	ct, err := s.db.Exec(
		ctx,
		`UPDATE telegram_chunks
SET tg_message_id = $2,
    tg_file_id = $3,
    tg_file_unique_id = $4,
    chunk_size = $5
WHERE id = $1`,
		id,
		tgMessageID,
		tgFileID,
		tgFileUniqueID,
		chunkSize,
	)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

type PatchItemInput struct {
	Name     *string
	ParentID **uuid.UUID // 三态：nil=不更新；指向 nil=设为根；指向 uuid=设为该目录
}

func (s *Store) PatchItemMoveRename(ctx context.Context, id uuid.UUID, input PatchItemInput, now time.Time) (Item, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return Item{}, err
	}
	defer tx.Rollback(ctx)

	var current Item
	err = tx.QueryRow(ctx, `
SELECT id, type, name, parent_id, path, size, mime_type, in_vault, last_accessed_at,
       shared_code, shared_enabled, created_at, updated_at
FROM items
WHERE id = $1
FOR UPDATE
`, id).Scan(
		&current.ID, &current.Type, &current.Name, &current.ParentID, &current.Path, &current.Size, &current.MimeType, &current.InVault,
		&current.LastAccessedAt, &current.SharedCode, &current.SharedEnabled, &current.CreatedAt, &current.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Item{}, ErrNotFound
		}
		return Item{}, err
	}

	newName := current.Name
	if input.Name != nil {
		trimmed := strings.TrimSpace(*input.Name)
		if trimmed == "" {
			return Item{}, ErrBadInput
		}
		newName = trimmed
	}

	newParentID := current.ParentID
	if input.ParentID != nil {
		newParentID = *input.ParentID
	}

	parentPath, err := resolveParentPathTx(ctx, tx, newParentID)
	if err != nil {
		return Item{}, err
	}

	// 目录移动：禁止移入自身/子目录
	if current.Type == ItemTypeFolder && newParentID != nil {
		var destPath string
		err := tx.QueryRow(ctx, `SELECT path FROM items WHERE id = $1 AND type = 'folder'`, *newParentID).Scan(&destPath)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return Item{}, ErrBadInput
			}
			return Item{}, err
		}
		prefix := current.Path
		if destPath == prefix || strings.HasPrefix(destPath, prefix+"/") {
			return Item{}, ErrForbidden
		}
	}

	exclude := current.ID
	uniqueName, err := uniqueNameTx(ctx, tx, newParentID, newName, &exclude, "")
	if err != nil {
		return Item{}, err
	}

	newPath := joinPath(parentPath, uniqueName)

	oldPath := current.Path
	var parent any
	if newParentID != nil {
		parent = *newParentID
	}

	if _, err := tx.Exec(ctx, `UPDATE items SET name = $2, parent_id = $3, path = $4, updated_at = $5 WHERE id = $1`,
		id, uniqueName, parent, newPath, now,
	); err != nil {
		return Item{}, err
	}

	// 文件夹改名/移动需要级联更新后代 path
	if current.Type == ItemTypeFolder && oldPath != newPath {
		oldPrefix := oldPath + "/"
		// descendants: path LIKE oldPrefix%
		if _, err := tx.Exec(ctx, `
UPDATE items
SET path = $2 || substring(path from $3), updated_at = $4
WHERE path LIKE $1
`, oldPrefix+"%", newPath+"/", len(oldPrefix)+1, now); err != nil {
			return Item{}, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return Item{}, err
	}
	return s.GetItem(ctx, id)
}

func (s *Store) DeleteItemsByPathPrefix(ctx context.Context, prefix string) error {
	if prefix == "" || prefix[0] != '/' {
		return ErrBadInput
	}
	_, err := s.db.Exec(ctx, `DELETE FROM items WHERE path = $1 OR path LIKE $1 || '/%'`, prefix)
	return err
}

func joinPath(parentPath string, name string) string {
	parentPath = strings.TrimSpace(parentPath)
	if parentPath == "" || parentPath == "/" {
		return "/" + strings.TrimLeft(name, "/")
	}
	return strings.TrimRight(parentPath, "/") + "/" + strings.TrimLeft(name, "/")
}

func (s *Store) resolveParentPath(ctx context.Context, parentID *uuid.UUID) (string, error) {
	if parentID == nil {
		return "/", nil
	}
	var p string
	err := s.db.QueryRow(ctx, `SELECT path FROM items WHERE id = $1 AND type = 'folder'`, *parentID).Scan(&p)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", ErrBadInput
		}
		return "", err
	}
	return p, nil
}

func resolveParentPathTx(ctx context.Context, tx pgx.Tx, parentID *uuid.UUID) (string, error) {
	if parentID == nil {
		return "/", nil
	}
	var p string
	err := tx.QueryRow(ctx, `SELECT path FROM items WHERE id = $1 AND type = 'folder'`, *parentID).Scan(&p)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", ErrBadInput
		}
		return "", err
	}
	return p, nil
}

func (s *Store) uniqueName(ctx context.Context, parentID *uuid.UUID, desired string, excludeID *uuid.UUID, suffix string) (string, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)
	name, err := uniqueNameTx(ctx, tx, parentID, desired, excludeID, suffix)
	if err != nil {
		return "", err
	}
	if err := tx.Commit(ctx); err != nil {
		return "", err
	}
	return name, nil
}

func uniqueNameTx(ctx context.Context, tx pgx.Tx, parentID *uuid.UUID, desired string, excludeID *uuid.UUID, suffix string) (string, error) {
	if strings.TrimSpace(desired) == "" {
		return "", ErrBadInput
	}

	base := desired
	ext := ""
	if dot := strings.LastIndex(desired, "."); dot > 0 {
		base = desired[:dot]
		ext = desired[dot:]
	}

	if suffix != "" {
		candidate := base + suffix + ext
		exists, err := nameExistsTx(ctx, tx, parentID, candidate, excludeID)
		if err != nil {
			return "", err
		}
		if !exists {
			return candidate, nil
		}
		for i := 2; i < 1000; i++ {
			candidate = fmt.Sprintf("%s%s (%d)%s", base, suffix, i, ext)
			exists, err := nameExistsTx(ctx, tx, parentID, candidate, excludeID)
			if err != nil {
				return "", err
			}
			if !exists {
				return candidate, nil
			}
		}
		return "", ErrConflict
	}

	exists, err := nameExistsTx(ctx, tx, parentID, desired, excludeID)
	if err != nil {
		return "", err
	}
	if !exists {
		return desired, nil
	}

	// 普通重名：在扩展名前追加 (n)
	for i := 1; i < 1000; i++ {
		candidate := fmt.Sprintf("%s (%d)%s", base, i, ext)
		exists, err := nameExistsTx(ctx, tx, parentID, candidate, excludeID)
		if err != nil {
			return "", err
		}
		if !exists {
			return candidate, nil
		}
	}
	return "", ErrConflict
}

func nameExistsTx(ctx context.Context, tx pgx.Tx, parentID *uuid.UUID, name string, excludeID *uuid.UUID) (bool, error) {
	var parent any
	if parentID != nil {
		parent = *parentID
	}
	var exclude any
	if excludeID != nil {
		exclude = *excludeID
	}

	var dummy int
	err := tx.QueryRow(ctx, `
SELECT 1
FROM items
WHERE parent_id IS NOT DISTINCT FROM $1
  AND name = $2
  AND ($3::uuid IS NULL OR id <> $3)
LIMIT 1
`, parent, name, exclude).Scan(&dummy)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

func GuessItemType(fileName string, mimeType string) ItemType {
	ext := strings.ToLower(filepath.Ext(fileName))

	switch ext {
	case ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg":
		return ItemTypeImage
	case ".mp4", ".mov", ".mkv", ".webm", ".avi":
		return ItemTypeVideo
	case ".mp3", ".wav", ".aac", ".m4a", ".flac", ".ogg":
		return ItemTypeAudio
	case ".zip", ".rar", ".7z", ".tar", ".gz":
		return ItemTypeArchive
	case ".js", ".ts", ".tsx", ".jsx", ".go", ".py", ".java", ".rs", ".c", ".cc", ".cpp", ".h", ".hpp", ".json", ".yaml", ".yml", ".xml", ".toml", ".md", ".txt":
		return ItemTypeCode
	}

	if strings.HasPrefix(mimeType, "image/") {
		return ItemTypeImage
	}
	if strings.HasPrefix(mimeType, "video/") {
		return ItemTypeVideo
	}
	if strings.HasPrefix(mimeType, "audio/") {
		return ItemTypeAudio
	}

	return ItemTypeDocument
}
