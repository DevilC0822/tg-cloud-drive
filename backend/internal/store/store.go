package store

import (
	"context"
	"errors"
	"fmt"
	"strings"
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
SELECT id, type, name, parent_id, path, size, mime_type, in_vault, last_accessed_at,
       shared_code, shared_enabled, created_at, updated_at
FROM items
WHERE id = $1
`
	var it Item
	err := s.db.QueryRow(ctx, q, id).Scan(
		&it.ID, &it.Type, &it.Name, &it.ParentID, &it.Path, &it.Size, &it.MimeType, &it.InVault,
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
SELECT id, type, name, parent_id, path, size, mime_type, in_vault, last_accessed_at,
       shared_code, shared_enabled, created_at, updated_at
FROM items
WHERE shared_enabled = TRUE AND shared_code = $1
`
	var it Item
	err := s.db.QueryRow(ctx, q, code).Scan(
		&it.ID, &it.Type, &it.Name, &it.ParentID, &it.Path, &it.Size, &it.MimeType, &it.InVault,
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

func (s *Store) ListFolders(ctx context.Context) ([]Item, error) {
	const q = `
SELECT id, type, name, parent_id, path, size, mime_type, in_vault, last_accessed_at,
       shared_code, shared_enabled, created_at, updated_at
FROM items
WHERE type = 'folder' AND in_vault = FALSE
ORDER BY path ASC
`
	rows, err := s.db.Query(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Item
	for rows.Next() {
		var it Item
		if err := rows.Scan(
			&it.ID, &it.Type, &it.Name, &it.ParentID, &it.Path, &it.Size, &it.MimeType, &it.InVault,
			&it.LastAccessedAt, &it.SharedCode, &it.SharedEnabled, &it.CreatedAt, &it.UpdatedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, it)
	}
	return out, rows.Err()
}

func (s *Store) ListItems(ctx context.Context, p ListParams) ([]Item, int64, error) {
	view := p.View
	if view == "" {
		view = ViewFiles
	}
	if p.Page <= 0 {
		p.Page = 1
	}
	if p.PageSize <= 0 || p.PageSize > 200 {
		p.PageSize = 50
	}

	sortBy := p.SortBy
	if sortBy == "" {
		sortBy = SortByName
	}
	order := strings.ToLower(string(p.SortOrder))
	if order != string(SortOrderAsc) && order != string(SortOrderDesc) {
		order = string(SortOrderAsc)
	}

	where := []string{"1=1"}
	args := []any{}
	add := func(cond string, val any) {
		args = append(args, val)
		where = append(where, fmt.Sprintf(cond, len(args)))
	}

	// 仅 vault 视图展示密码箱文件；普通视图隐藏密码箱文件。
	if view == ViewVault {
		where = append(where, "in_vault = TRUE")
	} else {
		where = append(where, "in_vault = FALSE")
	}

	switch view {
	case ViewFiles:
		if p.ParentID == nil {
			where = append(where, "parent_id IS NULL")
		} else {
			add("parent_id = $%d", *p.ParentID)
		}
	case ViewVault:
		// 已在上方处理 in_vault 过滤
	default:
		return nil, 0, ErrBadInput
	}

	if q := strings.TrimSpace(p.Search); q != "" {
		add("name ILIKE $%d", "%"+q+"%")
	}

	whereSQL := strings.Join(where, " AND ")

	var total int64
	if err := s.db.QueryRow(ctx, `SELECT count(*) FROM items WHERE `+whereSQL, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	sortExpr := "name"
	switch sortBy {
	case SortByName:
		sortExpr = "name"
	case SortBySize:
		sortExpr = "size"
	case SortByType:
		sortExpr = "type"
	case SortByDate:
		sortExpr = "updated_at"
	default:
		sortExpr = "name"
	}

	limit := p.PageSize
	offset := (p.Page - 1) * p.PageSize
	args = append(args, limit, offset)
	limitArg := len(args) - 1
	offsetArg := len(args)

	query := fmt.Sprintf(`
SELECT id, type, name, parent_id, path, size, mime_type, in_vault, last_accessed_at,
       shared_code, shared_enabled, created_at, updated_at
FROM items
WHERE %s
ORDER BY
  CASE WHEN type = 'folder' THEN 0 ELSE 1 END,
  %s %s,
  name ASC,
  id ASC
LIMIT $%d OFFSET $%d
`, whereSQL, sortExpr, order, limitArg, offsetArg)

	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var items []Item
	for rows.Next() {
		var it Item
		if err := rows.Scan(
			&it.ID, &it.Type, &it.Name, &it.ParentID, &it.Path, &it.Size, &it.MimeType, &it.InVault,
			&it.LastAccessedAt, &it.SharedCode, &it.SharedEnabled, &it.CreatedAt, &it.UpdatedAt,
		); err != nil {
			return nil, 0, err
		}
		items = append(items, it)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	return items, total, nil
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
