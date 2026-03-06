package store

import (
	"context"
	"fmt"
	"strings"
)

type TransferJobListParams struct {
	Direction    *TransferDirection
	Status       *TransferJobStatus
	SourceKind   *TransferSourceKind
	Query        string
	Page         int
	PageSize     int
	TerminalOnly bool
}

func (s *Store) ListTransferJobsByQuery(
	ctx context.Context,
	params TransferJobListParams,
) ([]TransferJob, int64, error) {
	page := normalizeTransferQueryPage(params.Page)
	pageSize := normalizeTransferQueryPageSize(params.PageSize)
	whereSQL, args := buildTransferJobsWhereSQL(params)

	total, err := s.countTransferJobs(ctx, whereSQL, args)
	if err != nil {
		return nil, 0, err
	}

	items, err := s.selectTransferJobs(ctx, whereSQL, args, page, pageSize)
	if err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func normalizeTransferQueryPage(page int) int {
	if page < 1 {
		return 1
	}
	return page
}

func normalizeTransferQueryPageSize(pageSize int) int {
	if pageSize < 1 {
		return 50
	}
	if pageSize > 200 {
		return 200
	}
	return pageSize
}

func buildTransferJobsWhereSQL(params TransferJobListParams) (string, []any) {
	where := []string{"1=1"}
	args := make([]any, 0, 5)
	addArg := func(value any) string {
		args = append(args, value)
		return fmt.Sprintf("$%d", len(args))
	}

	if params.TerminalOnly {
		where = append(where, "status <> "+addArg(string(TransferJobStatusRunning)))
	}
	if params.Direction != nil {
		where = append(where, "direction = "+addArg(strings.TrimSpace(string(*params.Direction))))
	}
	if params.Status != nil {
		where = append(where, "status = "+addArg(strings.TrimSpace(string(*params.Status))))
	}
	if params.SourceKind != nil {
		where = append(where, "source_kind = "+addArg(strings.TrimSpace(string(*params.SourceKind))))
	}

	query := strings.ToLower(strings.TrimSpace(params.Query))
	if query != "" {
		pattern := "%" + query + "%"
		placeholder := addArg(pattern)
		where = append(where, "(lower(name) LIKE "+placeholder+" OR lower(source_ref) LIKE "+placeholder+")")
	}
	return strings.Join(where, " AND "), args
}

func (s *Store) countTransferJobs(ctx context.Context, whereSQL string, args []any) (int64, error) {
	var total int64
	if err := s.db.QueryRow(ctx, `SELECT count(*) FROM transfer_jobs WHERE `+whereSQL, args...).Scan(&total); err != nil {
		return 0, err
	}
	return total, nil
}

func (s *Store) selectTransferJobs(
	ctx context.Context,
	whereSQL string,
	args []any,
	page int,
	pageSize int,
) ([]TransferJob, error) {
	queryArgs := append([]any{}, args...)
	queryArgs = append(queryArgs, pageSize, (page-1)*pageSize)
	limitArg := len(queryArgs) - 1
	offsetArg := len(queryArgs)
	query := fmt.Sprintf(`
SELECT
  id, direction, source_kind, source_ref, unit_kind, name, target_item_id,
  total_size, item_count, completed_count, error_count, canceled_count, status, last_error,
  started_at, finished_at, created_at, updated_at
FROM transfer_jobs
WHERE %s
ORDER BY finished_at DESC, updated_at DESC, created_at DESC
LIMIT $%d OFFSET $%d
`, whereSQL, limitArg, offsetArg)

	rows, err := s.db.Query(ctx, query, queryArgs...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]TransferJob, 0)
	for rows.Next() {
		item, scanErr := scanTransferJob(rows)
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
