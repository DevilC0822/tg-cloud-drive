package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"tg-cloud-drive-api/internal/store"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type transferHistoryDTO = transferJobViewDTO

func (s *Server) handleGetTransferHistory(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	page := intFromQuery(query.Get("page"), 1)
	pageSize := intFromQuery(query.Get("pageSize"), 50)
	if page < 1 {
		writeError(w, http.StatusBadRequest, "bad_request", "page 范围应为 >= 1")
		return
	}
	if pageSize < 1 || pageSize > 200 {
		writeError(w, http.StatusBadRequest, "bad_request", "pageSize 范围应为 1~200")
		return
	}

	var direction *store.TransferDirection
	rawDirection := strings.TrimSpace(query.Get("direction"))
	if rawDirection != "" && strings.ToLower(rawDirection) != "all" {
		dir := store.TransferDirection(strings.ToLower(rawDirection))
		switch dir {
		case store.TransferDirectionUpload, store.TransferDirectionDownload:
			direction = &dir
		default:
			writeError(w, http.StatusBadRequest, "bad_request", "direction 仅支持 upload/download/all")
			return
		}
	}

	status := parseOptionalTransferJobStatus(query.Get("status"))
	sourceKind := parseOptionalTransferSourceKind(query.Get("sourceKind"))
	searchQuery := strings.TrimSpace(query.Get("q"))

	items, total, err := store.New(s.db).ListTransferJobsByQuery(r.Context(), store.TransferJobListParams{
		Direction:    direction,
		Status:       status,
		SourceKind:   sourceKind,
		Query:        searchQuery,
		Page:         page,
		PageSize:     pageSize,
		TerminalOnly: true,
	})
	if err != nil {
		s.logger.Error("list transfer jobs failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "查询传输历史失败")
		return
	}

	dtos := make([]transferHistoryDTO, 0, len(items))
	for _, item := range items {
		dto, buildErr := s.buildTransferJobViewDTO(r.Context(), item)
		if buildErr != nil {
			s.logger.Warn("build transfer history dto failed", "error", buildErr.Error(), "id", item.ID.String())
			dtos = append(dtos, toTransferHistoryDTO(item))
			continue
		}
		dtos = append(dtos, dto)
	}
	totalPages := int64(1)
	if pageSize > 0 {
		totalPages = (total + int64(pageSize) - 1) / int64(pageSize)
		if totalPages <= 0 {
			totalPages = 1
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"items": dtos,
		"pagination": map[string]any{
			"page":       page,
			"pageSize":   pageSize,
			"totalCount": total,
			"totalPages": totalPages,
		},
	})
}

func (s *Server) handleUpsertTransferHistory(w http.ResponseWriter, r *http.Request) {
	var req struct {
		SourceKind string `json:"sourceKind"`
		SourceRef  string `json:"sourceRef"`
		UnitKind   string `json:"unitKind"`
		Name       string `json:"name"`
		TotalSize  int64  `json:"totalSize"`
		ItemCount  int    `json:"itemCount"`

		CompletedCount int `json:"completedCount"`
		ErrorCount     int `json:"errorCount"`
		CanceledCount  int `json:"canceledCount"`

		Status       string  `json:"status"`
		LastError    *string `json:"lastError"`
		StartedAt    string  `json:"startedAt"`
		FinishedAt   string  `json:"finishedAt"`
		Direction    string  `json:"direction"`
		TargetItemID *string `json:"targetItemId"`

		// legacy fields
		SourceTaskID string  `json:"sourceTaskId"`
		FileID       *string `json:"fileId"`
		FileName     string  `json:"fileName"`
		Size         int64   `json:"size"`
		Error        *string `json:"error"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "请求体不是合法 JSON")
		return
	}

	direction := store.TransferDirection(strings.ToLower(strings.TrimSpace(req.Direction)))
	if direction != store.TransferDirectionUpload && direction != store.TransferDirectionDownload {
		writeError(w, http.StatusBadRequest, "bad_request", "direction 仅支持 upload/download")
		return
	}

	sourceRef := strings.TrimSpace(req.SourceRef)
	if sourceRef == "" {
		sourceRef = strings.TrimSpace(req.SourceTaskID)
	}
	if sourceRef == "" {
		writeError(w, http.StatusBadRequest, "bad_request", "sourceRef 不能为空")
		return
	}

	sourceKind := parseTransferSourceKind(strings.TrimSpace(req.SourceKind))
	if sourceKind == "" {
		sourceKind = inferLegacyTransferSourceKind(sourceRef)
	}
	if sourceKind == "" {
		writeError(w, http.StatusBadRequest, "bad_request", "sourceKind 非法")
		return
	}

	unitKind := parseTransferUnitKind(strings.TrimSpace(req.UnitKind))
	if unitKind == "" {
		unitKind = store.TransferUnitKindFile
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		name = strings.TrimSpace(req.FileName)
	}
	if name == "" {
		writeError(w, http.StatusBadRequest, "bad_request", "name 不能为空")
		return
	}

	totalSize := req.TotalSize
	if totalSize <= 0 {
		totalSize = req.Size
	}
	if totalSize < 0 {
		writeError(w, http.StatusBadRequest, "bad_request", "totalSize 不能为负数")
		return
	}

	itemCount := req.ItemCount
	if itemCount <= 0 {
		itemCount = 1
	}
	if itemCount < 1 {
		itemCount = 1
	}

	startedAt, err := time.Parse(time.RFC3339Nano, strings.TrimSpace(req.StartedAt))
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "startedAt 时间格式非法")
		return
	}
	finishedAt, err := time.Parse(time.RFC3339Nano, strings.TrimSpace(req.FinishedAt))
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "finishedAt 时间格式非法")
		return
	}
	if finishedAt.Before(startedAt) {
		writeError(w, http.StatusBadRequest, "bad_request", "finishedAt 不能早于 startedAt")
		return
	}

	status := parseTransferJobStatus(strings.TrimSpace(req.Status))
	if status == "" {
		writeError(w, http.StatusBadRequest, "bad_request", "status 非法")
		return
	}

	completedCount, errorCount, canceledCount := normalizeTransferJobCounts(
		req.CompletedCount,
		req.ErrorCount,
		req.CanceledCount,
		itemCount,
		status,
	)
	lastError := normalizeTransferError(req.LastError, req.Error)
	targetItemID, parseErr := parseOptionalUUID(req.TargetItemID, req.FileID)
	if parseErr != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "targetItemId 非法")
		return
	}

	now := time.Now()
	job := store.TransferJob{
		ID:             uuid.New(),
		Direction:      direction,
		SourceKind:     sourceKind,
		SourceRef:      sourceRef,
		UnitKind:       unitKind,
		Name:           name,
		TargetItemID:   targetItemID,
		TotalSize:      totalSize,
		ItemCount:      itemCount,
		CompletedCount: completedCount,
		ErrorCount:     errorCount,
		CanceledCount:  canceledCount,
		Status:         status,
		LastError:      lastError,
		StartedAt:      startedAt,
		FinishedAt:     finishedAt,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	saved, err := store.New(s.db).UpsertTransferJob(r.Context(), job)
	if err != nil {
		s.logger.Error("upsert transfer job failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "保存传输历史失败")
		return
	}
	s.syncTransferJobEvent(r.Context(), saved)
	writeJSON(w, http.StatusOK, map[string]any{
		"item": toTransferHistoryDTO(saved),
	})
}

func (s *Server) handleDeleteTransferHistoryItem(w http.ResponseWriter, r *http.Request) {
	id, err := parseUUIDParam(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "id 非法")
		return
	}

	err = store.New(s.db).DeleteTransferJobByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "历史记录不存在")
			return
		}
		s.logger.Error("delete transfer job failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "删除历史记录失败")
		return
	}
	s.publishTransferDeletion(id)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func parseTransferSourceKind(raw string) store.TransferSourceKind {
	switch store.TransferSourceKind(strings.ToLower(strings.TrimSpace(raw))) {
	case store.TransferSourceKindUploadSession,
		store.TransferSourceKindUploadBatch,
		store.TransferSourceKindTorrentTask,
		store.TransferSourceKindDownloadTask:
		return store.TransferSourceKind(strings.ToLower(strings.TrimSpace(raw)))
	default:
		return ""
	}
}

func inferLegacyTransferSourceKind(sourceRef string) store.TransferSourceKind {
	ref := strings.ToLower(strings.TrimSpace(sourceRef))
	switch {
	case strings.HasPrefix(ref, "download:"):
		return store.TransferSourceKindDownloadTask
	case strings.HasPrefix(ref, "upload-session:"):
		return store.TransferSourceKindUploadSession
	case strings.HasPrefix(ref, "torrent:"):
		return store.TransferSourceKindTorrentTask
	default:
		return store.TransferSourceKindDownloadTask
	}
}

func parseTransferUnitKind(raw string) store.TransferUnitKind {
	switch store.TransferUnitKind(strings.ToLower(strings.TrimSpace(raw))) {
	case store.TransferUnitKindFile, store.TransferUnitKindFolder:
		return store.TransferUnitKind(strings.ToLower(strings.TrimSpace(raw)))
	default:
		return ""
	}
}

func parseTransferJobStatus(raw string) store.TransferJobStatus {
	switch store.TransferJobStatus(strings.ToLower(strings.TrimSpace(raw))) {
	case store.TransferJobStatusRunning,
		store.TransferJobStatusCompleted,
		store.TransferJobStatusError,
		store.TransferJobStatusCanceled:
		return store.TransferJobStatus(strings.ToLower(strings.TrimSpace(raw)))
	default:
		return ""
	}
}

func parseOptionalTransferJobStatus(raw string) *store.TransferJobStatus {
	value := strings.TrimSpace(strings.ToLower(raw))
	if value == "" || value == "all" {
		return nil
	}
	status := parseTransferJobStatus(value)
	if status == "" {
		return nil
	}
	return &status
}

func parseOptionalTransferSourceKind(raw string) *store.TransferSourceKind {
	value := strings.TrimSpace(strings.ToLower(raw))
	if value == "" || value == "all" {
		return nil
	}
	sourceKind := parseTransferSourceKind(value)
	if sourceKind == "" {
		return nil
	}
	return &sourceKind
}

func normalizeTransferJobCounts(
	completedCount int,
	errorCount int,
	canceledCount int,
	itemCount int,
	status store.TransferJobStatus,
) (int, int, int) {
	if completedCount < 0 {
		completedCount = 0
	}
	if errorCount < 0 {
		errorCount = 0
	}
	if canceledCount < 0 {
		canceledCount = 0
	}
	if completedCount == 0 && errorCount == 0 && canceledCount == 0 {
		switch status {
		case store.TransferJobStatusCompleted:
			completedCount = itemCount
		case store.TransferJobStatusError:
			errorCount = max(1, min(itemCount, 1))
		case store.TransferJobStatusCanceled:
			canceledCount = max(1, min(itemCount, 1))
		}
	}
	if completedCount > itemCount {
		completedCount = itemCount
	}
	if errorCount > itemCount {
		errorCount = itemCount
	}
	if canceledCount > itemCount {
		canceledCount = itemCount
	}
	return completedCount, errorCount, canceledCount
}

func normalizeTransferError(primary *string, legacy *string) *string {
	if primary != nil {
		trimmed := strings.TrimSpace(*primary)
		if trimmed != "" {
			return &trimmed
		}
	}
	if legacy != nil {
		trimmed := strings.TrimSpace(*legacy)
		if trimmed != "" {
			return &trimmed
		}
	}
	return nil
}

func parseOptionalUUID(primary *string, legacy *string) (*uuid.UUID, error) {
	raw := ""
	if primary != nil {
		raw = strings.TrimSpace(*primary)
	}
	if raw == "" && legacy != nil {
		raw = strings.TrimSpace(*legacy)
	}
	if raw == "" {
		return nil, nil
	}
	parsed, err := uuid.Parse(raw)
	if err != nil {
		return nil, err
	}
	return &parsed, nil
}

func min(a int, b int) int {
	if a < b {
		return a
	}
	return b
}

func max(a int, b int) int {
	if a > b {
		return a
	}
	return b
}
