package api

import (
	"net/http"
	"strings"
	"time"

	"tg-cloud-drive-api/internal/store"
)

func (s *Server) requireVaultUnlocked(w http.ResponseWriter, r *http.Request) bool {
	status, err := s.getVaultStatusResponse(r)
	if err != nil {
		s.logger.Error("get runtime settings failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "读取密码箱状态失败")
		return false
	}

	if !status.Enabled {
		writeError(w, http.StatusBadRequest, "bad_request", "请先在设置中配置密码箱密码")
		return false
	}

	if !status.Unlocked {
		writeError(w, http.StatusForbidden, "forbidden", "密码箱已锁定，请先解锁")
		return false
	}

	return true
}

func (s *Server) getVaultStatusResponse(r *http.Request) (vaultStatusResponse, error) {
	settings, err := s.getRuntimeSettings(r.Context())
	if err != nil {
		return vaultStatusResponse{}, err
	}
	return s.buildVaultStatusResponse(r, settings, time.Now()), nil
}

func (s *Server) buildVaultStatusResponse(
	r *http.Request,
	settings store.RuntimeSettings,
	now time.Time,
) vaultStatusResponse {
	hash := strings.TrimSpace(settings.VaultPasswordHash)
	if hash == "" {
		return vaultStatusResponse{}
	}

	status := vaultStatusResponse{Enabled: true}
	ok, exp := s.isVaultUnlocked(r, settings, now)
	status.Unlocked = ok
	if ok {
		status.ExpiresAt = exp.Format(time.RFC3339)
	}
	return status
}
