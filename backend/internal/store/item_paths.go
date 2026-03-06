package store

import (
	"context"

	"github.com/google/uuid"
)

func (s *Store) ListItemsByExactPaths(ctx context.Context, paths []string) ([]Item, error) {
	if len(paths) == 0 {
		return []Item{}, nil
	}

	const q = `
SELECT id, type, name, parent_id, path, size, mime_type, in_vault, starred, last_accessed_at,
       shared_code, shared_enabled, created_at, updated_at
FROM items
WHERE path = ANY($1)
ORDER BY path ASC
`
	rows, err := s.db.Query(ctx, q, paths)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]Item, 0, len(paths))
	for rows.Next() {
		var item Item
		if err := rows.Scan(
			&item.ID,
			&item.Type,
			&item.Name,
			&item.ParentID,
			&item.Path,
			&item.Size,
			&item.MimeType,
			&item.InVault,
			&item.Starred,
			&item.LastAccessedAt,
			&item.SharedCode,
			&item.SharedEnabled,
			&item.CreatedAt,
			&item.UpdatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

func BuildChildPath(parentPath string, name string) string {
	parentPath = trimPath(parentPath)
	if parentPath == "" || parentPath == "/" {
		return "/" + trimPath(name)
	}
	return parentPath + "/" + trimPath(name)
}

func trimPath(value string) string {
	for len(value) > 0 && value[0] == '/' {
		value = value[1:]
	}
	for len(value) > 0 && value[len(value)-1] == '/' {
		value = value[:len(value)-1]
	}
	return value
}

func UUIDPointer(value uuid.UUID) *uuid.UUID {
	return &value
}
