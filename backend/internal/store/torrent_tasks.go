package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

func parseTorrentTaskStatus(raw string) (TorrentTaskStatus, error) {
	v := TorrentTaskStatus(strings.ToLower(strings.TrimSpace(raw)))
	switch v {
	case TorrentTaskStatusQueued,
		TorrentTaskStatusDownloading,
		TorrentTaskStatusAwaitingSelection,
		TorrentTaskStatusUploading,
		TorrentTaskStatusCompleted,
		TorrentTaskStatusError:
		return v, nil
	default:
		return "", ErrBadInput
	}
}

func parseTorrentSourceType(raw string) (TorrentSourceType, error) {
	v := TorrentSourceType(strings.ToLower(strings.TrimSpace(raw)))
	switch v {
	case TorrentSourceTypeURL, TorrentSourceTypeFile:
		return v, nil
	default:
		return "", ErrBadInput
	}
}

func encodeTrackerHosts(hosts []string) string {
	if len(hosts) == 0 {
		return "[]"
	}
	normalized := make([]string, 0, len(hosts))
	for _, h := range hosts {
		trimmed := strings.TrimSpace(strings.ToLower(h))
		if trimmed == "" {
			continue
		}
		normalized = append(normalized, trimmed)
	}
	if len(normalized) == 0 {
		return "[]"
	}
	b, err := json.Marshal(normalized)
	if err != nil {
		return "[]"
	}
	return string(b)
}

func decodeTrackerHosts(raw string) []string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil
	}
	var out []string
	if err := json.Unmarshal([]byte(trimmed), &out); err != nil {
		return nil
	}
	normalized := make([]string, 0, len(out))
	for _, v := range out {
		host := strings.TrimSpace(strings.ToLower(v))
		if host == "" {
			continue
		}
		normalized = append(normalized, host)
	}
	return normalized
}

func scanTorrentTask(
	id uuid.UUID,
	sourceTypeRaw string,
	sourceURL *string,
	torrentName string,
	infoHash string,
	torrentFilePath string,
	qbTorrentHash *string,
	targetChatID string,
	targetParentID *uuid.UUID,
	submittedBy string,
	estimatedSize int64,
	downloadedBytes int64,
	progress float64,
	isPrivate bool,
	trackerHostsJSON string,
	statusRaw string,
	errMsg *string,
	startedAt *time.Time,
	finishedAt *time.Time,
	sourceCleanupDueAt *time.Time,
	sourceCleanupDone bool,
	createdAt time.Time,
	updatedAt time.Time,
) (TorrentTask, error) {
	sourceType, err := parseTorrentSourceType(sourceTypeRaw)
	if err != nil {
		return TorrentTask{}, err
	}
	status, err := parseTorrentTaskStatus(statusRaw)
	if err != nil {
		return TorrentTask{}, err
	}
	return TorrentTask{
		ID:                 id,
		SourceType:         sourceType,
		SourceURL:          sourceURL,
		TorrentName:        strings.TrimSpace(torrentName),
		InfoHash:           strings.TrimSpace(strings.ToLower(infoHash)),
		TorrentFilePath:    strings.TrimSpace(torrentFilePath),
		QBTorrentHash:      qbTorrentHash,
		TargetChatID:       strings.TrimSpace(targetChatID),
		TargetParentID:     targetParentID,
		SubmittedBy:        strings.TrimSpace(submittedBy),
		EstimatedSize:      estimatedSize,
		DownloadedBytes:    downloadedBytes,
		Progress:           progress,
		IsPrivate:          isPrivate,
		TrackerHosts:       decodeTrackerHosts(trackerHostsJSON),
		Status:             status,
		Error:              errMsg,
		StartedAt:          startedAt,
		FinishedAt:         finishedAt,
		SourceCleanupDueAt: sourceCleanupDueAt,
		SourceCleanupDone:  sourceCleanupDone,
		CreatedAt:          createdAt,
		UpdatedAt:          updatedAt,
	}, nil
}

func (s *Store) CreateTorrentTask(ctx context.Context, task TorrentTask) (TorrentTask, error) {
	sourceType, err := parseTorrentSourceType(string(task.SourceType))
	if err != nil {
		return TorrentTask{}, err
	}
	status, err := parseTorrentTaskStatus(string(task.Status))
	if err != nil {
		return TorrentTask{}, err
	}
	if task.ID == uuid.Nil {
		return TorrentTask{}, ErrBadInput
	}
	if strings.TrimSpace(task.TorrentName) == "" ||
		strings.TrimSpace(task.InfoHash) == "" ||
		strings.TrimSpace(task.TorrentFilePath) == "" ||
		strings.TrimSpace(task.TargetChatID) == "" ||
		strings.TrimSpace(task.SubmittedBy) == "" {
		return TorrentTask{}, ErrBadInput
	}

	const q = `
INSERT INTO torrent_tasks(
  id, source_type, source_url, torrent_name, info_hash, torrent_file_path, qb_torrent_hash,
  target_chat_id, target_parent_id, submitted_by, estimated_size, downloaded_bytes, progress,
  is_private, tracker_hosts_json, status, error, started_at, finished_at,
  source_cleanup_due_at, source_cleanup_done, created_at, updated_at
)
VALUES (
  $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23
)
RETURNING
  id, source_type, source_url, torrent_name, info_hash, torrent_file_path, qb_torrent_hash,
  target_chat_id, target_parent_id, submitted_by, estimated_size, downloaded_bytes, progress,
  is_private, tracker_hosts_json, status, error, started_at, finished_at,
  source_cleanup_due_at, source_cleanup_done, created_at, updated_at
`

	var (
		id                 uuid.UUID
		sourceTypeRaw      string
		sourceURL          *string
		torrentName        string
		infoHash           string
		torrentFilePath    string
		qbTorrentHash      *string
		targetChatID       string
		targetParentID     *uuid.UUID
		submittedBy        string
		estimatedSize      int64
		downloadedBytes    int64
		progress           float64
		isPrivate          bool
		trackerHostsJSON   string
		statusRaw          string
		errMsg             *string
		startedAt          *time.Time
		finishedAt         *time.Time
		sourceCleanupDueAt *time.Time
		sourceCleanupDone  bool
		createdAt          time.Time
		updatedAt          time.Time
	)
	if err := s.db.QueryRow(
		ctx,
		q,
		task.ID,
		string(sourceType),
		task.SourceURL,
		strings.TrimSpace(task.TorrentName),
		strings.TrimSpace(strings.ToLower(task.InfoHash)),
		strings.TrimSpace(task.TorrentFilePath),
		task.QBTorrentHash,
		strings.TrimSpace(task.TargetChatID),
		task.TargetParentID,
		strings.TrimSpace(task.SubmittedBy),
		task.EstimatedSize,
		task.DownloadedBytes,
		task.Progress,
		task.IsPrivate,
		encodeTrackerHosts(task.TrackerHosts),
		string(status),
		task.Error,
		task.StartedAt,
		task.FinishedAt,
		task.SourceCleanupDueAt,
		task.SourceCleanupDone,
		task.CreatedAt,
		task.UpdatedAt,
	).Scan(
		&id,
		&sourceTypeRaw,
		&sourceURL,
		&torrentName,
		&infoHash,
		&torrentFilePath,
		&qbTorrentHash,
		&targetChatID,
		&targetParentID,
		&submittedBy,
		&estimatedSize,
		&downloadedBytes,
		&progress,
		&isPrivate,
		&trackerHostsJSON,
		&statusRaw,
		&errMsg,
		&startedAt,
		&finishedAt,
		&sourceCleanupDueAt,
		&sourceCleanupDone,
		&createdAt,
		&updatedAt,
	); err != nil {
		return TorrentTask{}, err
	}
	return scanTorrentTask(
		id,
		sourceTypeRaw,
		sourceURL,
		torrentName,
		infoHash,
		torrentFilePath,
		qbTorrentHash,
		targetChatID,
		targetParentID,
		submittedBy,
		estimatedSize,
		downloadedBytes,
		progress,
		isPrivate,
		trackerHostsJSON,
		statusRaw,
		errMsg,
		startedAt,
		finishedAt,
		sourceCleanupDueAt,
		sourceCleanupDone,
		createdAt,
		updatedAt,
	)
}

func (s *Store) GetTorrentTask(ctx context.Context, id uuid.UUID) (TorrentTask, error) {
	const q = `
SELECT
  id, source_type, source_url, torrent_name, info_hash, torrent_file_path, qb_torrent_hash,
  target_chat_id, target_parent_id, submitted_by, estimated_size, downloaded_bytes, progress,
  is_private, tracker_hosts_json, status, error, started_at, finished_at,
  source_cleanup_due_at, source_cleanup_done, created_at, updated_at
FROM torrent_tasks
WHERE id = $1
`
	var (
		sourceTypeRaw      string
		sourceURL          *string
		torrentName        string
		infoHash           string
		torrentFilePath    string
		qbTorrentHash      *string
		targetChatID       string
		targetParentID     *uuid.UUID
		submittedBy        string
		estimatedSize      int64
		downloadedBytes    int64
		progress           float64
		isPrivate          bool
		trackerHostsJSON   string
		statusRaw          string
		errMsg             *string
		startedAt          *time.Time
		finishedAt         *time.Time
		sourceCleanupDueAt *time.Time
		sourceCleanupDone  bool
		createdAt          time.Time
		updatedAt          time.Time
	)
	err := s.db.QueryRow(ctx, q, id).Scan(
		&id,
		&sourceTypeRaw,
		&sourceURL,
		&torrentName,
		&infoHash,
		&torrentFilePath,
		&qbTorrentHash,
		&targetChatID,
		&targetParentID,
		&submittedBy,
		&estimatedSize,
		&downloadedBytes,
		&progress,
		&isPrivate,
		&trackerHostsJSON,
		&statusRaw,
		&errMsg,
		&startedAt,
		&finishedAt,
		&sourceCleanupDueAt,
		&sourceCleanupDone,
		&createdAt,
		&updatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return TorrentTask{}, ErrNotFound
		}
		return TorrentTask{}, err
	}
	return scanTorrentTask(
		id,
		sourceTypeRaw,
		sourceURL,
		torrentName,
		infoHash,
		torrentFilePath,
		qbTorrentHash,
		targetChatID,
		targetParentID,
		submittedBy,
		estimatedSize,
		downloadedBytes,
		progress,
		isPrivate,
		trackerHostsJSON,
		statusRaw,
		errMsg,
		startedAt,
		finishedAt,
		sourceCleanupDueAt,
		sourceCleanupDone,
		createdAt,
		updatedAt,
	)
}

func (s *Store) ListTorrentTasks(
	ctx context.Context,
	status *TorrentTaskStatus,
	page int,
	pageSize int,
) ([]TorrentTask, int64, error) {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 200 {
		pageSize = 200
	}

	where := []string{"1=1"}
	args := make([]any, 0, 4)
	add := func(cond string, val any) {
		args = append(args, val)
		where = append(where, fmt.Sprintf(cond, len(args)))
	}

	if status != nil && strings.TrimSpace(string(*status)) != "" {
		parsed, err := parseTorrentTaskStatus(string(*status))
		if err != nil {
			return nil, 0, err
		}
		add("status = $%d", string(parsed))
	}

	whereSQL := strings.Join(where, " AND ")

	var total int64
	if err := s.db.QueryRow(
		ctx,
		`SELECT count(*) FROM torrent_tasks WHERE `+whereSQL,
		args...,
	).Scan(&total); err != nil {
		return nil, 0, err
	}

	limit := pageSize
	offset := (page - 1) * pageSize
	args = append(args, limit, offset)
	limitArg := len(args) - 1
	offsetArg := len(args)

	query := fmt.Sprintf(`
SELECT
  id, source_type, source_url, torrent_name, info_hash, torrent_file_path, qb_torrent_hash,
  target_chat_id, target_parent_id, submitted_by, estimated_size, downloaded_bytes, progress,
  is_private, tracker_hosts_json, status, error, started_at, finished_at,
  source_cleanup_due_at, source_cleanup_done, created_at, updated_at
FROM torrent_tasks
WHERE %s
ORDER BY created_at DESC
LIMIT $%d OFFSET $%d
`, whereSQL, limitArg, offsetArg)

	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	items := make([]TorrentTask, 0, pageSize)
	for rows.Next() {
		var (
			id                 uuid.UUID
			sourceTypeRaw      string
			sourceURL          *string
			torrentName        string
			infoHash           string
			torrentFilePath    string
			qbTorrentHash      *string
			targetChatID       string
			targetParentID     *uuid.UUID
			submittedBy        string
			estimatedSize      int64
			downloadedBytes    int64
			progress           float64
			isPrivate          bool
			trackerHostsJSON   string
			statusRaw          string
			errMsg             *string
			startedAt          *time.Time
			finishedAt         *time.Time
			sourceCleanupDueAt *time.Time
			sourceCleanupDone  bool
			createdAt          time.Time
			updatedAt          time.Time
		)
		if err := rows.Scan(
			&id,
			&sourceTypeRaw,
			&sourceURL,
			&torrentName,
			&infoHash,
			&torrentFilePath,
			&qbTorrentHash,
			&targetChatID,
			&targetParentID,
			&submittedBy,
			&estimatedSize,
			&downloadedBytes,
			&progress,
			&isPrivate,
			&trackerHostsJSON,
			&statusRaw,
			&errMsg,
			&startedAt,
			&finishedAt,
			&sourceCleanupDueAt,
			&sourceCleanupDone,
			&createdAt,
			&updatedAt,
		); err != nil {
			return nil, 0, err
		}
		item, err := scanTorrentTask(
			id,
			sourceTypeRaw,
			sourceURL,
			torrentName,
			infoHash,
			torrentFilePath,
			qbTorrentHash,
			targetChatID,
			targetParentID,
			submittedBy,
			estimatedSize,
			downloadedBytes,
			progress,
			isPrivate,
			trackerHostsJSON,
			statusRaw,
			errMsg,
			startedAt,
			finishedAt,
			sourceCleanupDueAt,
			sourceCleanupDone,
			createdAt,
			updatedAt,
		)
		if err != nil {
			return nil, 0, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (s *Store) ClaimNextTorrentTask(
	ctx context.Context,
	fromStatuses []TorrentTaskStatus,
	toStatus TorrentTaskStatus,
	now time.Time,
) (TorrentTask, error) {
	if len(fromStatuses) == 0 {
		return TorrentTask{}, ErrBadInput
	}
	parsedTo, err := parseTorrentTaskStatus(string(toStatus))
	if err != nil {
		return TorrentTask{}, err
	}
	fromRaw := make([]string, 0, len(fromStatuses))
	for _, status := range fromStatuses {
		parsed, parseErr := parseTorrentTaskStatus(string(status))
		if parseErr != nil {
			return TorrentTask{}, parseErr
		}
		fromRaw = append(fromRaw, string(parsed))
	}

	const q = `
WITH picked AS (
  SELECT id
  FROM torrent_tasks
  WHERE status = ANY($1::text[])
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED
)
UPDATE torrent_tasks t
SET status = $2,
    error = NULL,
    started_at = CASE WHEN t.started_at IS NULL THEN $3 ELSE t.started_at END,
    updated_at = $3
FROM picked
WHERE t.id = picked.id
RETURNING
  t.id, t.source_type, t.source_url, t.torrent_name, t.info_hash, t.torrent_file_path, t.qb_torrent_hash,
  t.target_chat_id, t.target_parent_id, t.submitted_by, t.estimated_size, t.downloaded_bytes, t.progress,
  t.is_private, t.tracker_hosts_json, t.status, t.error, t.started_at, t.finished_at,
  t.source_cleanup_due_at, t.source_cleanup_done, t.created_at, t.updated_at
`

	var (
		id                 uuid.UUID
		sourceTypeRaw      string
		sourceURL          *string
		torrentName        string
		infoHash           string
		torrentFilePath    string
		qbTorrentHash      *string
		targetChatID       string
		targetParentID     *uuid.UUID
		submittedBy        string
		estimatedSize      int64
		downloadedBytes    int64
		progress           float64
		isPrivate          bool
		trackerHostsJSON   string
		statusRaw          string
		errMsg             *string
		startedAt          *time.Time
		finishedAt         *time.Time
		sourceCleanupDueAt *time.Time
		sourceCleanupDone  bool
		createdAt          time.Time
		updatedAt          time.Time
	)
	if err := s.db.QueryRow(ctx, q, fromRaw, string(parsedTo), now).Scan(
		&id,
		&sourceTypeRaw,
		&sourceURL,
		&torrentName,
		&infoHash,
		&torrentFilePath,
		&qbTorrentHash,
		&targetChatID,
		&targetParentID,
		&submittedBy,
		&estimatedSize,
		&downloadedBytes,
		&progress,
		&isPrivate,
		&trackerHostsJSON,
		&statusRaw,
		&errMsg,
		&startedAt,
		&finishedAt,
		&sourceCleanupDueAt,
		&sourceCleanupDone,
		&createdAt,
		&updatedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return TorrentTask{}, ErrNotFound
		}
		return TorrentTask{}, err
	}
	return scanTorrentTask(
		id,
		sourceTypeRaw,
		sourceURL,
		torrentName,
		infoHash,
		torrentFilePath,
		qbTorrentHash,
		targetChatID,
		targetParentID,
		submittedBy,
		estimatedSize,
		downloadedBytes,
		progress,
		isPrivate,
		trackerHostsJSON,
		statusRaw,
		errMsg,
		startedAt,
		finishedAt,
		sourceCleanupDueAt,
		sourceCleanupDone,
		createdAt,
		updatedAt,
	)
}

func (s *Store) UpdateTorrentTaskProgress(
	ctx context.Context,
	id uuid.UUID,
	downloadedBytes int64,
	estimatedSize int64,
	progress float64,
	now time.Time,
) error {
	if downloadedBytes < 0 {
		downloadedBytes = 0
	}
	if estimatedSize < 0 {
		estimatedSize = 0
	}
	if progress < 0 {
		progress = 0
	}
	if progress > 1 {
		progress = 1
	}

	ct, err := s.db.Exec(
		ctx,
		`UPDATE torrent_tasks
SET downloaded_bytes = $2,
    estimated_size = $3,
    progress = $4,
    updated_at = $5
WHERE id = $1`,
		id,
		downloadedBytes,
		estimatedSize,
		progress,
		now,
	)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) SetTorrentTaskQBTorrentHash(ctx context.Context, id uuid.UUID, qbHash string, now time.Time) error {
	hash := strings.TrimSpace(strings.ToLower(qbHash))
	if hash == "" {
		return ErrBadInput
	}
	ct, err := s.db.Exec(
		ctx,
		`UPDATE torrent_tasks SET qb_torrent_hash = $2, updated_at = $3 WHERE id = $1`,
		id,
		hash,
		now,
	)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) SetTorrentTaskStatus(
	ctx context.Context,
	id uuid.UUID,
	status TorrentTaskStatus,
	errMsg *string,
	now time.Time,
) error {
	parsed, err := parseTorrentTaskStatus(string(status))
	if err != nil {
		return err
	}
	ct, err := s.db.Exec(
		ctx,
		`UPDATE torrent_tasks SET status = $2, error = $3, updated_at = $4 WHERE id = $1`,
		id,
		string(parsed),
		errMsg,
		now,
	)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) ResetTorrentTaskForRetry(ctx context.Context, id uuid.UUID, now time.Time) error {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	ct, err := tx.Exec(
		ctx,
		`UPDATE torrent_tasks
SET status = $2,
    error = NULL,
    downloaded_bytes = 0,
    progress = 0,
    qb_torrent_hash = NULL,
    started_at = NULL,
    finished_at = NULL,
    source_cleanup_due_at = NULL,
    source_cleanup_done = FALSE,
    updated_at = $3
WHERE id = $1`,
		id,
		string(TorrentTaskStatusQueued),
		now,
	)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrNotFound
	}

	if _, err := tx.Exec(ctx, `DELETE FROM torrent_task_files WHERE task_id = $1`, id); err != nil {
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return err
	}
	return nil
}

func (s *Store) FinishTorrentTask(
	ctx context.Context,
	id uuid.UUID,
	status TorrentTaskStatus,
	errMsg *string,
	now time.Time,
) error {
	parsed, err := parseTorrentTaskStatus(string(status))
	if err != nil {
		return err
	}
	ct, err := s.db.Exec(
		ctx,
		`UPDATE torrent_tasks
SET status = $2,
    error = $3,
    finished_at = $4,
    updated_at = $4
WHERE id = $1`,
		id,
		string(parsed),
		errMsg,
		now,
	)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) SetTorrentTaskSourceCleanupSchedule(
	ctx context.Context,
	id uuid.UUID,
	dueAt time.Time,
	now time.Time,
) error {
	if dueAt.IsZero() {
		return ErrBadInput
	}
	ct, err := s.db.Exec(
		ctx,
		`UPDATE torrent_tasks
SET source_cleanup_due_at = $2,
    source_cleanup_done = FALSE,
    updated_at = $3
WHERE id = $1`,
		id,
		dueAt,
		now,
	)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) MarkTorrentTaskSourceCleanupDone(
	ctx context.Context,
	id uuid.UUID,
	now time.Time,
) error {
	ct, err := s.db.Exec(
		ctx,
		`UPDATE torrent_tasks
SET source_cleanup_done = TRUE,
    source_cleanup_due_at = NULL,
    updated_at = $2
WHERE id = $1`,
		id,
		now,
	)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) ClaimNextDueTorrentCleanupTask(ctx context.Context, now time.Time) (TorrentTask, error) {
	const q = `
WITH picked AS (
  SELECT id
  FROM torrent_tasks
  WHERE status = 'completed'
    AND source_cleanup_done = FALSE
    AND source_cleanup_due_at IS NOT NULL
    AND source_cleanup_due_at <= $1
  ORDER BY source_cleanup_due_at ASC, created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED
)
UPDATE torrent_tasks t
SET updated_at = $1
FROM picked
WHERE t.id = picked.id
RETURNING
  t.id, t.source_type, t.source_url, t.torrent_name, t.info_hash, t.torrent_file_path, t.qb_torrent_hash,
  t.target_chat_id, t.target_parent_id, t.submitted_by, t.estimated_size, t.downloaded_bytes, t.progress,
  t.is_private, t.tracker_hosts_json, t.status, t.error, t.started_at, t.finished_at,
  t.source_cleanup_due_at, t.source_cleanup_done, t.created_at, t.updated_at
`

	var (
		id                 uuid.UUID
		sourceTypeRaw      string
		sourceURL          *string
		torrentName        string
		infoHash           string
		torrentFilePath    string
		qbTorrentHash      *string
		targetChatID       string
		targetParentID     *uuid.UUID
		submittedBy        string
		estimatedSize      int64
		downloadedBytes    int64
		progress           float64
		isPrivate          bool
		trackerHostsJSON   string
		statusRaw          string
		errMsg             *string
		startedAt          *time.Time
		finishedAt         *time.Time
		sourceCleanupDueAt *time.Time
		sourceCleanupDone  bool
		createdAt          time.Time
		updatedAt          time.Time
	)
	if err := s.db.QueryRow(ctx, q, now).Scan(
		&id,
		&sourceTypeRaw,
		&sourceURL,
		&torrentName,
		&infoHash,
		&torrentFilePath,
		&qbTorrentHash,
		&targetChatID,
		&targetParentID,
		&submittedBy,
		&estimatedSize,
		&downloadedBytes,
		&progress,
		&isPrivate,
		&trackerHostsJSON,
		&statusRaw,
		&errMsg,
		&startedAt,
		&finishedAt,
		&sourceCleanupDueAt,
		&sourceCleanupDone,
		&createdAt,
		&updatedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return TorrentTask{}, ErrNotFound
		}
		return TorrentTask{}, err
	}
	return scanTorrentTask(
		id,
		sourceTypeRaw,
		sourceURL,
		torrentName,
		infoHash,
		torrentFilePath,
		qbTorrentHash,
		targetChatID,
		targetParentID,
		submittedBy,
		estimatedSize,
		downloadedBytes,
		progress,
		isPrivate,
		trackerHostsJSON,
		statusRaw,
		errMsg,
		startedAt,
		finishedAt,
		sourceCleanupDueAt,
		sourceCleanupDone,
		createdAt,
		updatedAt,
	)
}

func (s *Store) ReplaceTorrentTaskFiles(
	ctx context.Context,
	taskID uuid.UUID,
	files []TorrentTaskFile,
	now time.Time,
) error {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `DELETE FROM torrent_task_files WHERE task_id = $1`, taskID); err != nil {
		return err
	}

	for _, file := range files {
		if file.FileIndex < 0 || strings.TrimSpace(file.FileName) == "" || strings.TrimSpace(file.FilePath) == "" {
			return ErrBadInput
		}
		if _, err := tx.Exec(
			ctx,
			`INSERT INTO torrent_task_files(
  task_id, file_index, file_path, file_name, file_size,
  selected, uploaded, uploaded_item_id, error, created_at, updated_at
) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
			taskID,
			file.FileIndex,
			strings.TrimSpace(file.FilePath),
			strings.TrimSpace(file.FileName),
			file.FileSize,
			file.Selected,
			file.Uploaded,
			file.UploadedItemID,
			file.Error,
			now,
			now,
		); err != nil {
			return err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return err
	}
	return nil
}

func (s *Store) ListTorrentTaskFiles(ctx context.Context, taskID uuid.UUID) ([]TorrentTaskFile, error) {
	rows, err := s.db.Query(
		ctx,
		`SELECT
  task_id, file_index, file_path, file_name, file_size,
  selected, uploaded, uploaded_item_id, error, created_at, updated_at
FROM torrent_task_files
WHERE task_id = $1
ORDER BY file_index ASC`,
		taskID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]TorrentTaskFile, 0)
	for rows.Next() {
		var file TorrentTaskFile
		if err := rows.Scan(
			&file.TaskID,
			&file.FileIndex,
			&file.FilePath,
			&file.FileName,
			&file.FileSize,
			&file.Selected,
			&file.Uploaded,
			&file.UploadedItemID,
			&file.Error,
			&file.CreatedAt,
			&file.UpdatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, file)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

func (s *Store) SetTorrentTaskFileSelection(
	ctx context.Context,
	taskID uuid.UUID,
	fileIndexes []int,
	now time.Time,
) error {
	if len(fileIndexes) == 0 {
		return ErrBadInput
	}
	seen := make(map[int]struct{}, len(fileIndexes))
	normalized := make([]int, 0, len(fileIndexes))
	for _, idx := range fileIndexes {
		if idx < 0 {
			return ErrBadInput
		}
		if _, ok := seen[idx]; ok {
			continue
		}
		seen[idx] = struct{}{}
		normalized = append(normalized, idx)
	}
	if len(normalized) == 0 {
		return ErrBadInput
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var total int64
	if err := tx.QueryRow(
		ctx,
		`SELECT count(*) FROM torrent_task_files WHERE task_id = $1`,
		taskID,
	).Scan(&total); err != nil {
		return err
	}
	if total == 0 {
		return ErrNotFound
	}

	if _, err := tx.Exec(
		ctx,
		`UPDATE torrent_task_files SET selected = FALSE, updated_at = $2 WHERE task_id = $1`,
		taskID,
		now,
	); err != nil {
		return err
	}

	ct, err := tx.Exec(
		ctx,
		`UPDATE torrent_task_files
SET selected = TRUE,
    updated_at = $3
WHERE task_id = $1
  AND file_index = ANY($2::int[])`,
		taskID,
		normalized,
		now,
	)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrBadInput
	}

	if err := tx.Commit(ctx); err != nil {
		return err
	}
	return nil
}

func (s *Store) ListTorrentTaskPendingUploadFiles(ctx context.Context, taskID uuid.UUID) ([]TorrentTaskFile, error) {
	rows, err := s.db.Query(
		ctx,
		`SELECT
  task_id, file_index, file_path, file_name, file_size,
  selected, uploaded, uploaded_item_id, error, created_at, updated_at
FROM torrent_task_files
WHERE task_id = $1
  AND selected = TRUE
  AND uploaded = FALSE
ORDER BY file_index ASC`,
		taskID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]TorrentTaskFile, 0)
	for rows.Next() {
		var file TorrentTaskFile
		if err := rows.Scan(
			&file.TaskID,
			&file.FileIndex,
			&file.FilePath,
			&file.FileName,
			&file.FileSize,
			&file.Selected,
			&file.Uploaded,
			&file.UploadedItemID,
			&file.Error,
			&file.CreatedAt,
			&file.UpdatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, file)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

func (s *Store) MarkTorrentTaskFileUploaded(
	ctx context.Context,
	taskID uuid.UUID,
	fileIndex int,
	itemID uuid.UUID,
	now time.Time,
) error {
	ct, err := s.db.Exec(
		ctx,
		`UPDATE torrent_task_files
SET uploaded = TRUE,
    uploaded_item_id = $3,
    error = NULL,
    updated_at = $4
WHERE task_id = $1
  AND file_index = $2`,
		taskID,
		fileIndex,
		itemID,
		now,
	)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) MarkTorrentTaskFileError(
	ctx context.Context,
	taskID uuid.UUID,
	fileIndex int,
	errMsg string,
	now time.Time,
) error {
	trimmed := strings.TrimSpace(errMsg)
	if trimmed == "" {
		return ErrBadInput
	}
	ct, err := s.db.Exec(
		ctx,
		`UPDATE torrent_task_files
SET uploaded = FALSE,
    error = $3,
    updated_at = $4
WHERE task_id = $1
  AND file_index = $2`,
		taskID,
		fileIndex,
		trimmed,
		now,
	)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) DeleteTorrentTask(ctx context.Context, id uuid.UUID) error {
	ct, err := s.db.Exec(
		ctx,
		`DELETE FROM torrent_tasks WHERE id = $1`,
		id,
	)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
