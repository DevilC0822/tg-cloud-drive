package store

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgconn"
)

func (s *Store) ListSubtreeItems(ctx context.Context, prefix string) ([]Item, error) {
	prefix = strings.TrimSpace(prefix)
	if prefix == "" || !strings.HasPrefix(prefix, "/") {
		return nil, ErrBadInput
	}

	const q = `
SELECT id, type, name, parent_id, path, size, mime_type, in_vault, last_accessed_at,
       shared_code, shared_enabled, created_at, updated_at
FROM items
WHERE path = $1 OR path LIKE $1 || '/%'
ORDER BY path ASC, id ASC
`
	rows, err := s.db.Query(ctx, q, prefix)
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
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

type ChunkDeleteRef struct {
	TGChatID    string
	TGMessageID int64
}

func (s *Store) ListChunkDeleteRefsByPathPrefix(ctx context.Context, prefix string) ([]ChunkDeleteRef, error) {
	prefix = strings.TrimSpace(prefix)
	if prefix == "" || !strings.HasPrefix(prefix, "/") {
		return nil, ErrBadInput
	}

	const q = `
SELECT tc.tg_chat_id, tc.tg_message_id
FROM telegram_chunks tc
JOIN items i ON i.id = tc.item_id
WHERE i.path = $1 OR i.path LIKE $1 || '/%'
ORDER BY tc.tg_message_id ASC
`
	rows, err := s.db.Query(ctx, q, prefix)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []ChunkDeleteRef
	for rows.Next() {
		var ref ChunkDeleteRef
		if err := rows.Scan(&ref.TGChatID, &ref.TGMessageID); err != nil {
			return nil, err
		}
		out = append(out, ref)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

type InsertItemRawInput struct {
	ID        uuid.UUID
	Type      ItemType
	Name      string
	ParentID  *uuid.UUID
	Path      string
	Size      int64
	MimeType  *string
	CreatedAt time.Time
	UpdatedAt time.Time
}

func (s *Store) InsertItemRaw(ctx context.Context, in InsertItemRawInput) error {
	if strings.TrimSpace(in.Name) == "" {
		return ErrBadInput
	}
	if strings.TrimSpace(in.Path) == "" || !strings.HasPrefix(in.Path, "/") {
		return ErrBadInput
	}
	if in.Type == "" {
		return ErrBadInput
	}
	if in.Type == ItemTypeFolder {
		in.Size = 0
		in.MimeType = nil
	}

	var parent any
	if in.ParentID != nil {
		parent = *in.ParentID
	}

	const q = `
INSERT INTO items(
  id, type, name, parent_id, path, size, mime_type, last_accessed_at,
  shared_code, shared_enabled, created_at, updated_at
) VALUES ($1,$2,$3,$4,$5,$6,$7,NULL,NULL,FALSE,$8,$9)
`
	_, err := s.db.Exec(ctx, q, in.ID, string(in.Type), strings.TrimSpace(in.Name), parent, strings.TrimSpace(in.Path), in.Size, in.MimeType, in.CreatedAt, in.UpdatedAt)
	if err != nil {
		// 尽量把“父目录缺失”转成 ErrBadInput，便于 API 返回 400
		var pgerr *pgconn.PgError
		if errors.As(err, &pgerr) && pgerr.Code == "23503" { // foreign_key_violation
			return ErrBadInput
		}
		return err
	}
	return nil
}
