package api

import (
	"errors"
	"net/http"

	"github.com/const/tg-cloud-drive/backend/internal/store"
	"github.com/go-chi/chi/v5"
)

func (s *Server) handleGetItem(w http.ResponseWriter, r *http.Request) {
	id, err := parseUUIDParam(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "id 非法")
		return
	}

	st := store.New(s.db)
	it, err := st.GetItem(r.Context(), id)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "文件不存在")
			return
		}
		s.logger.Error("get item failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "查询失败")
		return
	}

	if it.InVault && !s.requireVaultUnlocked(w, r) {
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"item": toItemDTO(it)})
}
