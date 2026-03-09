package store

import (
	"context"
	"strings"

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
	childName := trimPath(name)
	parentPrefix := normalizePathPrefix(parentPath)
	if childName == "" {
		return parentPrefix
	}
	if parentPrefix == "" || parentPrefix == "/" {
		return "/" + childName
	}
	return parentPrefix + "/" + childName
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

type pathPrefixFilter struct {
	exact []string
	like  []string
}

func newPathPrefixFilter(prefix string) (pathPrefixFilter, error) {
	exact, err := pathPrefixVariants(prefix)
	if err != nil {
		return pathPrefixFilter{}, err
	}
	return pathPrefixFilter{
		exact: exact,
		like:  buildPathLikePatterns(exact),
	}, nil
}

func pathPrefixVariants(prefix string) ([]string, error) {
	normalized := normalizePathPrefix(prefix)
	if normalized == "" {
		return nil, ErrBadInput
	}
	if normalized == "/" {
		return []string{"/"}, nil
	}
	variants := []string{normalized, trimPath(normalized)}
	return uniqueStrings(variants), nil
}

func normalizePathPrefix(prefix string) string {
	trimmed := strings.TrimSpace(prefix)
	if trimmed == "" {
		return ""
	}
	cleaned := trimPath(trimmed)
	if cleaned == "" {
		return "/"
	}
	return "/" + cleaned
}

func buildPathLikePatterns(prefixes []string) []string {
	patterns := make([]string, 0, len(prefixes))
	for _, prefix := range prefixes {
		if prefix == "/" {
			patterns = append(patterns, "/%")
			continue
		}
		patterns = append(patterns, prefix+"/%")
	}
	return uniqueStrings(patterns)
}

func uniqueStrings(values []string) []string {
	if len(values) == 0 {
		return nil
	}
	seen := make(map[string]struct{}, len(values))
	out := make([]string, 0, len(values))
	for _, value := range values {
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		out = append(out, value)
	}
	return out
}

func UUIDPointer(value uuid.UUID) *uuid.UUID {
	return &value
}
