package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/const/tg-cloud-drive/backend/internal/store"
	"github.com/go-chi/chi/v5"
)

type setItemStarRequest struct {
	Enabled *bool `json:"enabled"`
}

func (s *Server) handleSetItemStar(w http.ResponseWriter, r *http.Request) {
	id, err := parseUUIDParam(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "id 非法")
		return
	}

	var req setItemStarRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "请求体不是合法 JSON")
		return
	}
	if req.Enabled == nil {
		writeError(w, http.StatusBadRequest, "bad_request", "缺少 enabled 字段")
		return
	}

	st := store.New(s.db)
	item, err := st.UpdateItemStarred(r.Context(), id, *req.Enabled, time.Now())
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "文件不存在")
			return
		}
		s.logger.Error("update item starred failed", "error", err.Error(), "item_id", id.String())
		writeError(w, http.StatusInternalServerError, "internal_error", "更新收藏状态失败")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"item": toItemDTO(item)})
}
