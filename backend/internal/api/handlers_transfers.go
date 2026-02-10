package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/const/tg-cloud-drive/backend/internal/store"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type transferHistoryDTO struct {
	ID                           string    `json:"id"`
	SourceTaskID                 string    `json:"sourceTaskId"`
	Direction                    string    `json:"direction"`
	FileID                       *string   `json:"fileId"`
	FileName                     string    `json:"fileName"`
	Size                         int64     `json:"size"`
	Status                       string    `json:"status"`
	Error                        *string   `json:"error"`
	UploadVideoFaststartApplied  *bool     `json:"uploadVideoFaststartApplied"`
	UploadVideoFaststartFallback *bool     `json:"uploadVideoFaststartFallback"`
	UploadVideoPreviewAttached   *bool     `json:"uploadVideoPreviewAttached"`
	UploadVideoPreviewFallback   *bool     `json:"uploadVideoPreviewFallback"`
	StartedAt                    time.Time `json:"startedAt"`
	FinishedAt                   time.Time `json:"finishedAt"`
	CreatedAt                    time.Time `json:"createdAt"`
	UpdatedAt                    time.Time `json:"updatedAt"`
}

func toTransferHistoryDTO(item store.TransferHistory) transferHistoryDTO {
	var fileID *string
	if item.FileID != nil {
		v := item.FileID.String()
		fileID = &v
	}

	return transferHistoryDTO{
		ID:                           item.ID.String(),
		SourceTaskID:                 item.SourceTaskID,
		Direction:                    string(item.Direction),
		FileID:                       fileID,
		FileName:                     item.FileName,
		Size:                         item.Size,
		Status:                       string(item.Status),
		Error:                        item.Error,
		UploadVideoFaststartApplied:  item.UploadVideoFaststartApplied,
		UploadVideoFaststartFallback: item.UploadVideoFaststartFallback,
		UploadVideoPreviewAttached:   item.UploadVideoPreviewAttached,
		UploadVideoPreviewFallback:   item.UploadVideoPreviewFallback,
		StartedAt:                    item.StartedAt,
		FinishedAt:                   item.FinishedAt,
		CreatedAt:                    item.CreatedAt,
		UpdatedAt:                    item.UpdatedAt,
	}
}

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

	items, total, err := store.New(s.db).ListTransferHistory(r.Context(), direction, page, pageSize)
	if err != nil {
		s.logger.Error("list transfer history failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "查询传输历史失败")
		return
	}

	dtos := make([]transferHistoryDTO, 0, len(items))
	for _, item := range items {
		dtos = append(dtos, toTransferHistoryDTO(item))
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
		SourceTaskID                 string  `json:"sourceTaskId"`
		Direction                    string  `json:"direction"`
		FileID                       *string `json:"fileId"`
		FileName                     string  `json:"fileName"`
		Size                         int64   `json:"size"`
		Status                       string  `json:"status"`
		Error                        *string `json:"error"`
		UploadVideoFaststartApplied  *bool   `json:"uploadVideoFaststartApplied"`
		UploadVideoFaststartFallback *bool   `json:"uploadVideoFaststartFallback"`
		UploadVideoPreviewAttached   *bool   `json:"uploadVideoPreviewAttached"`
		UploadVideoPreviewFallback   *bool   `json:"uploadVideoPreviewFallback"`
		StartedAt                    string  `json:"startedAt"`
		FinishedAt                   string  `json:"finishedAt"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "请求体不是合法 JSON")
		return
	}

	sourceTaskID := strings.TrimSpace(req.SourceTaskID)
	if sourceTaskID == "" {
		writeError(w, http.StatusBadRequest, "bad_request", "sourceTaskId 不能为空")
		return
	}

	direction := store.TransferDirection(strings.ToLower(strings.TrimSpace(req.Direction)))
	switch direction {
	case store.TransferDirectionUpload, store.TransferDirectionDownload:
	default:
		writeError(w, http.StatusBadRequest, "bad_request", "direction 仅支持 upload/download")
		return
	}

	status := store.TransferStatus(strings.ToLower(strings.TrimSpace(req.Status)))
	switch status {
	case store.TransferStatusCompleted, store.TransferStatusError, store.TransferStatusCanceled:
	default:
		writeError(w, http.StatusBadRequest, "bad_request", "status 仅支持 completed/error/canceled")
		return
	}

	fileName := strings.TrimSpace(req.FileName)
	if fileName == "" {
		writeError(w, http.StatusBadRequest, "bad_request", "fileName 不能为空")
		return
	}
	if req.Size < 0 {
		writeError(w, http.StatusBadRequest, "bad_request", "size 不能为负数")
		return
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

	var fileID *uuid.UUID
	if req.FileID != nil {
		raw := strings.TrimSpace(*req.FileID)
		if raw != "" {
			parsed, parseErr := uuid.Parse(raw)
			if parseErr != nil {
				writeError(w, http.StatusBadRequest, "bad_request", "fileId 非法")
				return
			}
			fileID = &parsed
		}
	}

	var errPtr *string
	if req.Error != nil {
		trimmed := strings.TrimSpace(*req.Error)
		if trimmed != "" {
			errPtr = &trimmed
		}
	}

	now := time.Now()
	entry := store.TransferHistory{
		ID:                           uuid.New(),
		SourceTaskID:                 sourceTaskID,
		Direction:                    direction,
		FileID:                       fileID,
		FileName:                     fileName,
		Size:                         req.Size,
		Status:                       status,
		Error:                        errPtr,
		UploadVideoFaststartApplied:  req.UploadVideoFaststartApplied,
		UploadVideoFaststartFallback: req.UploadVideoFaststartFallback,
		UploadVideoPreviewAttached:   req.UploadVideoPreviewAttached,
		UploadVideoPreviewFallback:   req.UploadVideoPreviewFallback,
		StartedAt:                    startedAt,
		FinishedAt:                   finishedAt,
		CreatedAt:                    now,
		UpdatedAt:                    now,
	}

	saved, err := store.New(s.db).UpsertTransferHistory(r.Context(), entry)
	if err != nil {
		s.logger.Error("upsert transfer history failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "保存传输历史失败")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"item": toTransferHistoryDTO(saved),
	})
}

func (s *Server) handleDeleteTransferHistory(w http.ResponseWriter, r *http.Request) {
	olderThanRaw := strings.TrimSpace(r.URL.Query().Get("olderThanDays"))
	st := store.New(s.db)

	var (
		deleted int64
		err     error
	)
	if olderThanRaw == "" {
		deleted, err = st.DeleteAllTransferHistory(r.Context())
	} else {
		days := intFromQuery(olderThanRaw, -1)
		if days < 1 || days > 3650 {
			writeError(w, http.StatusBadRequest, "bad_request", "olderThanDays 范围应为 1~3650")
			return
		}
		cutoff := time.Now().Add(-time.Duration(days) * 24 * time.Hour)
		deleted, err = st.DeleteTransferHistoryOlderThan(r.Context(), cutoff)
	}
	if err != nil {
		s.logger.Error("delete transfer history failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "删除传输历史失败")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"deleted": deleted,
	})
}

func (s *Server) handleDeleteTransferHistoryItem(w http.ResponseWriter, r *http.Request) {
	id, err := parseUUIDParam(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "id 非法")
		return
	}

	err = store.New(s.db).DeleteTransferHistoryByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "历史记录不存在")
			return
		}
		s.logger.Error("delete transfer history item failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "删除历史记录失败")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}
