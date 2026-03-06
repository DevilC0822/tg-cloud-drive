package store

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Store struct {
	db *pgxpool.Pool
}

func New(db *pgxpool.Pool) *Store {
	return &Store{db: db}
}

func (s *Store) GetItem(ctx context.Context, id uuid.UUID) (Item, error) {
	const q = `
SELECT id, type, name, parent_id, path, size, mime_type, in_vault, starred, last_accessed_at,
       shared_code, shared_enabled, created_at, updated_at
FROM items
WHERE id = $1
`
	var it Item
	err := s.db.QueryRow(ctx, q, id).Scan(
		&it.ID, &it.Type, &it.Name, &it.ParentID, &it.Path, &it.Size, &it.MimeType, &it.InVault, &it.Starred,
		&it.LastAccessedAt, &it.SharedCode, &it.SharedEnabled, &it.CreatedAt, &it.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Item{}, ErrNotFound
		}
		return Item{}, err
	}
	return it, nil
}

func (s *Store) GetItemByShareCode(ctx context.Context, code string) (Item, error) {
	const q = `
SELECT id, type, name, parent_id, path, size, mime_type, in_vault, starred, last_accessed_at,
       shared_code, shared_enabled, created_at, updated_at
FROM items
WHERE shared_enabled = TRUE AND shared_code = $1
`
	var it Item
	err := s.db.QueryRow(ctx, q, code).Scan(
		&it.ID, &it.Type, &it.Name, &it.ParentID, &it.Path, &it.Size, &it.MimeType, &it.InVault, &it.Starred,
		&it.LastAccessedAt, &it.SharedCode, &it.SharedEnabled, &it.CreatedAt, &it.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Item{}, ErrNotFound
		}
		return Item{}, err
	}
	return it, nil
}

func (s *Store) ListFolders(ctx context.Context, scope FolderScope) ([]Item, error) {
	if scope == "" {
		scope = FolderScopeFiles
	}

	whereClause := "i.in_vault = FALSE"
	switch scope {
	case FolderScopeFiles:
		whereClause = "i.in_vault = FALSE"
	case FolderScopeVault:
		whereClause = vaultFolderVisibleSQL
	case FolderScopeAll:
		whereClause = sqlTrue
	default:
		return nil, ErrBadInput
	}

	q := fmt.Sprintf(`
SELECT id, type, name, parent_id, path, size, mime_type, in_vault, starred, last_accessed_at,
       shared_code, shared_enabled, created_at, updated_at
FROM items i
WHERE i.type = 'folder' AND %s
ORDER BY i.path ASC
`, whereClause)
	rows, err := s.db.Query(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Item
	for rows.Next() {
		var it Item
		if err := rows.Scan(
			&it.ID, &it.Type, &it.Name, &it.ParentID, &it.Path, &it.Size, &it.MimeType, &it.InVault, &it.Starred,
			&it.LastAccessedAt, &it.SharedCode, &it.SharedEnabled, &it.CreatedAt, &it.UpdatedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, it)
	}
	return out, rows.Err()
}

func (s *Store) ListChunks(ctx context.Context, itemID uuid.UUID) ([]Chunk, error) {
	const q = `
SELECT id, item_id, chunk_index, chunk_size, tg_chat_id, tg_message_id, tg_file_id, tg_file_unique_id, created_at
FROM telegram_chunks
WHERE item_id = $1
ORDER BY chunk_index ASC
`
	rows, err := s.db.Query(ctx, q, itemID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Chunk
	for rows.Next() {
		var c Chunk
		if err := rows.Scan(
			&c.ID, &c.ItemID, &c.ChunkIndex, &c.ChunkSize, &c.TGChatID, &c.TGMessageID, &c.TGFileID, &c.TGFileUniqueID, &c.CreatedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (s *Store) TouchItem(ctx context.Context, id uuid.UUID, now time.Time) error {
	_, err := s.db.Exec(ctx, `UPDATE items SET last_accessed_at = $2 WHERE id = $1`, id, now)
	return err
}

func (s *Store) SetShare(ctx context.Context, id uuid.UUID, code string, now time.Time) error {
	ct, err := s.db.Exec(ctx, `UPDATE items SET shared_enabled = TRUE, shared_code = $2, updated_at = $3 WHERE id = $1`, id, code, now)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) UnsetShare(ctx context.Context, id uuid.UUID, now time.Time) error {
	ct, err := s.db.Exec(ctx, `UPDATE items SET shared_enabled = FALSE, shared_code = NULL, updated_at = $2 WHERE id = $1`, id, now)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
