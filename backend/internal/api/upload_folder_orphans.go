package api

import (
	"context"
	"strings"

	"github.com/jackc/pgx/v5"
)

func collectUploadFolderConflictPathsTx(ctx context.Context, tx pgx.Tx, paths []string) ([]string, error) {
	rows, err := tx.Query(ctx, `SELECT path FROM items WHERE path = ANY($1)`, paths)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	conflicts := make([]string, 0, len(paths))
	for rows.Next() {
		var path string
		if err := rows.Scan(&path); err != nil {
			return nil, err
		}
		conflicts = append(conflicts, path)
	}
	return conflicts, rows.Err()
}

func shouldCleanupUploadFolderOrphans(rootPath string, conflicts []string) bool {
	rootKey := uploadFolderPathKey(rootPath)
	if rootKey == "" || len(conflicts) == 0 {
		return false
	}
	for _, path := range conflicts {
		conflictKey := uploadFolderPathKey(path)
		if conflictKey == rootKey {
			return false
		}
		if !strings.HasPrefix(conflictKey, rootKey+"/") {
			return false
		}
	}
	return true
}

func deleteUploadFolderOrphansTx(ctx context.Context, tx pgx.Tx, rootPath string) error {
	exact, like := buildUploadFolderOrphanFilters(rootPath)
	_, err := tx.Exec(ctx, `DELETE FROM items WHERE path = ANY($1) OR path LIKE ANY($2)`, exact, like)
	return err
}

func buildUploadFolderOrphanFilters(rootPath string) ([]string, []string) {
	variants := uploadFolderPathVariants(rootPath)
	like := make([]string, 0, len(variants))
	for _, variant := range variants {
		like = append(like, variant+"/%")
	}
	return variants, like
}

func uploadFolderPathVariants(rootPath string) []string {
	key := uploadFolderPathKey(rootPath)
	if key == "" {
		return nil
	}
	if strings.HasPrefix(strings.TrimSpace(rootPath), "/") {
		return []string{"/" + key, key}
	}
	return []string{key, "/" + key}
}

func uploadFolderPathKey(path string) string {
	trimmed := strings.TrimSpace(strings.ReplaceAll(path, "\\", "/"))
	trimmed = strings.Trim(trimmed, "/")
	return trimmed
}
