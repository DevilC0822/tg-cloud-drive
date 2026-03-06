package store

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

const (
	listDefaultPage     = 1
	listDefaultPageSize = 50
	listMaxPageSize     = 200
	listFolderRank      = 0
	listFileRank        = 1
	listZero            = 0
)

const (
	listItemsCountSQL = `SELECT count(*) FROM items i WHERE %s`
	listItemsSelectSQL = `
SELECT id, type, name, parent_id, path, size, mime_type, in_vault, starred, last_accessed_at,
       shared_code, shared_enabled, created_at, updated_at
FROM items i
WHERE %s
ORDER BY %s
LIMIT $%d OFFSET $%d
`
	listFolderRankSQL = "CASE WHEN i.type = 'folder' THEN %d ELSE %d END"
)

type normalizedListParams struct {
	view      View
	parentID  *uuid.UUID
	search    string
	sortBy    SortBy
	sortOrder SortOrder
	page      int
	pageSize  int
}

type listItemsSpec struct {
	whereSQL   string
	args       []any
	orderBySQL string
	limit      int
	offset     int
}

func (s *Store) ListItems(ctx context.Context, params ListParams) ([]Item, int64, error) {
	normalized, err := normalizeListParams(params)
	if err != nil {
		return nil, 0, err
	}
	spec, err := buildListItemsSpec(normalized)
	if err != nil {
		return nil, 0, err
	}
	total, err := s.countItems(ctx, spec.whereSQL, spec.args)
	if err != nil {
		return nil, 0, err
	}
	items, err := s.queryItems(ctx, spec)
	if err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func normalizeListParams(in ListParams) (normalizedListParams, error) {
	view, err := normalizeView(in.View)
	if err != nil {
		return normalizedListParams{}, err
	}
	sortBy, err := normalizeSortBy(in.SortBy)
	if err != nil {
		return normalizedListParams{}, err
	}
	sortOrder, err := normalizeSortOrder(in.SortOrder)
	if err != nil {
		return normalizedListParams{}, err
	}
	return normalizedListParams{
		view:      view,
		parentID:  in.ParentID,
		search:    strings.TrimSpace(in.Search),
		sortBy:    sortBy,
		sortOrder: sortOrder,
		page:      normalizePage(in.Page),
		pageSize:  normalizePageSize(in.PageSize),
	}, nil
}

func normalizeView(view View) (View, error) {
	if strings.TrimSpace(string(view)) == "" {
		return ViewFiles, nil
	}
	switch view {
	case ViewFiles, ViewVault:
		return view, nil
	default:
		return "", ErrBadInput
	}
}

func normalizeSortBy(sortBy SortBy) (SortBy, error) {
	if strings.TrimSpace(string(sortBy)) == "" {
		return SortByName, nil
	}
	switch sortBy {
	case SortByName, SortByDate, SortBySize, SortByType:
		return sortBy, nil
	default:
		return "", ErrBadInput
	}
}

func normalizeSortOrder(order SortOrder) (SortOrder, error) {
	if strings.TrimSpace(string(order)) == "" {
		return SortOrderAsc, nil
	}
	switch order {
	case SortOrderAsc, SortOrderDesc:
		return order, nil
	default:
		return "", ErrBadInput
	}
}

func normalizePage(page int) int {
	if page < listDefaultPage {
		return listDefaultPage
	}
	return page
}

func normalizePageSize(pageSize int) int {
	if pageSize <= listZero {
		return listDefaultPageSize
	}
	if pageSize > listMaxPageSize {
		return listMaxPageSize
	}
	return pageSize
}

func buildListItemsSpec(params normalizedListParams) (listItemsSpec, error) {
	whereSQL, args, err := buildListItemsWhere(params)
	if err != nil {
		return listItemsSpec{}, err
	}
	orderBySQL, err := buildOrderBySQL(params.sortBy, params.sortOrder)
	if err != nil {
		return listItemsSpec{}, err
	}
	offset := (params.page - listDefaultPage) * params.pageSize
	return listItemsSpec{
		whereSQL:   whereSQL,
		args:       args,
		orderBySQL: orderBySQL,
		limit:      params.pageSize,
		offset:     offset,
	}, nil
}

func buildListItemsWhere(params normalizedListParams) (string, []any, error) {
	viewClause, err := viewClauseFor(params.view)
	if err != nil {
		return "", nil, err
	}
	clauses := []string{viewClause}
	var args []any

	if params.parentID == nil {
		clauses = append(clauses, "i.parent_id IS NULL")
	} else {
		args = append(args, *params.parentID)
		clauses = append(clauses, fmt.Sprintf("i.parent_id = $%d", len(args)))
	}

	if params.search != "" {
		args = append(args, wrapSearch(params.search))
		clauses = append(clauses, fmt.Sprintf("i.name ILIKE $%d", len(args)))
	}

	return strings.Join(clauses, " AND "), args, nil
}

func viewClauseFor(view View) (string, error) {
	switch view {
	case ViewFiles:
		return "i.in_vault = FALSE", nil
	case ViewVault:
		return vaultItemVisibleSQL, nil
	default:
		return "", ErrBadInput
	}
}

func buildOrderBySQL(sortBy SortBy, order SortOrder) (string, error) {
	column, err := sortColumnFor(sortBy)
	if err != nil {
		return "", err
	}
	orderSQL, err := sortOrderSQL(order)
	if err != nil {
		return "", err
	}
	folderRank := fmt.Sprintf(listFolderRankSQL, listFolderRank, listFileRank)
	return fmt.Sprintf("%s ASC, %s %s, i.name ASC, i.id ASC", folderRank, column, orderSQL), nil
}

func sortColumnFor(sortBy SortBy) (string, error) {
	switch sortBy {
	case SortByName:
		return "i.name", nil
	case SortByDate:
		return "i.updated_at", nil
	case SortBySize:
		return "i.size", nil
	case SortByType:
		return "i.type", nil
	default:
		return "", ErrBadInput
	}
}

func sortOrderSQL(order SortOrder) (string, error) {
	switch order {
	case SortOrderAsc:
		return "ASC", nil
	case SortOrderDesc:
		return "DESC", nil
	default:
		return "", ErrBadInput
	}
}

func wrapSearch(search string) string {
	trimmed := strings.TrimSpace(search)
	return "%" + trimmed + "%"
}

func (s *Store) countItems(ctx context.Context, whereSQL string, args []any) (int64, error) {
	q := fmt.Sprintf(listItemsCountSQL, whereSQL)
	var total int64
	if err := s.db.QueryRow(ctx, q, args...).Scan(&total); err != nil {
		return 0, err
	}
	return total, nil
}

func (s *Store) queryItems(ctx context.Context, spec listItemsSpec) ([]Item, error) {
	args := append([]any{}, spec.args...)
	args = append(args, spec.limit)
	limitArg := len(args)
	args = append(args, spec.offset)
	offsetArg := len(args)

	q := fmt.Sprintf(listItemsSelectSQL, spec.whereSQL, spec.orderBySQL, limitArg, offsetArg)
	rows, err := s.db.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanItems(rows)
}

func scanItems(rows pgx.Rows) ([]Item, error) {
	items := make([]Item, 0)
	for rows.Next() {
		var it Item
		if err := rows.Scan(
			&it.ID, &it.Type, &it.Name, &it.ParentID, &it.Path, &it.Size, &it.MimeType, &it.InVault,
			&it.Starred, &it.LastAccessedAt, &it.SharedCode, &it.SharedEnabled, &it.CreatedAt, &it.UpdatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, it)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}
