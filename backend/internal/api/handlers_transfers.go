package api

import (
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"tg-cloud-drive-api/internal/store"
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
