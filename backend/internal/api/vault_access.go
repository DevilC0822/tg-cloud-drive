package api

import (
	"net/http"
	"strings"
	"time"
)

func (s *Server) requireVaultUnlocked(w http.ResponseWriter, r *http.Request) bool {
	settings, err := s.getRuntimeSettings(r.Context())
	if err != nil {
		s.logger.Error("get runtime settings failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "读取密码箱状态失败")
		return false
	}

	if strings.TrimSpace(settings.VaultPasswordHash) == "" {
		writeError(w, http.StatusBadRequest, "bad_request", "请先在设置中配置密码箱密码")
		return false
	}

	ok, _ := s.isVaultUnlocked(r, settings, time.Now())
	if !ok {
		writeError(w, http.StatusForbidden, "forbidden", "密码箱已锁定，请先解锁")
		return false
	}

	return true
}
