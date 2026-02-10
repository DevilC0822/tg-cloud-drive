package api

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"
)

const authCookieName = "tgcd_auth"

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	if !s.isSystemInitialized() {
		writeError(w, http.StatusServiceUnavailable, "setup_required", "系统尚未初始化，请先完成初始化配置")
		return
	}

	if s.cfg.AllowDevNoAuth {
		// 开发模式可跳过鉴权，但仍提供 cookie，便于前端逻辑统一
		s.setAuthCookie(w, time.Now())
		writeJSON(w, http.StatusOK, map[string]any{"ok": true})
		return
	}

	var req struct {
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "请求体不是合法 JSON")
		return
	}
	if strings.TrimSpace(req.Password) == "" {
		writeError(w, http.StatusBadRequest, "bad_request", "密码不能为空")
		return
	}

	if !s.verifyAdminPassword(req.Password) {
		writeError(w, http.StatusUnauthorized, "unauthorized", "密码错误")
		return
	}

	s.setAuthCookie(w, time.Now())
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	c := &http.Cookie{
		Name:     authCookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		MaxAge:   -1,
		SameSite: http.SameSiteLaxMode,
		Secure:   s.cfg.CookieSecure,
	}
	http.SetCookie(w, c)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	if !s.isSystemInitialized() {
		writeJSON(w, http.StatusOK, map[string]any{"authenticated": false})
		return
	}
	authenticated := s.cfg.AllowDevNoAuth || s.isAuthed(r)
	writeJSON(w, http.StatusOK, map[string]any{"authenticated": authenticated})
}

func (s *Server) authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !s.isSystemInitialized() {
			writeError(w, http.StatusServiceUnavailable, "setup_required", "系统尚未初始化，请先完成初始化配置")
			return
		}
		if s.cfg.AllowDevNoAuth {
			next.ServeHTTP(w, r)
			return
		}
		if !s.isAuthed(r) {
			writeError(w, http.StatusUnauthorized, "unauthorized", "请先登录")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) isAuthed(r *http.Request) bool {
	c, err := r.Cookie(authCookieName)
	if err != nil || c == nil {
		return false
	}
	return validateAuthCookieValue(c.Value, s.cfg.CookieSecret, time.Now(), time.Duration(s.cfg.CookieMaxAge)*time.Second)
}

func (s *Server) setAuthCookie(w http.ResponseWriter, now time.Time) {
	value := buildAuthCookieValue(now, s.cfg.CookieSecret)
	c := &http.Cookie{
		Name:     authCookieName,
		Value:    value,
		Path:     "/",
		HttpOnly: true,
		MaxAge:   s.cfg.CookieMaxAge,
		SameSite: http.SameSiteLaxMode,
		Secure:   s.cfg.CookieSecure,
	}
	http.SetCookie(w, c)
}

func buildAuthCookieValue(now time.Time, secret []byte) string {
	ts := strconv.FormatInt(now.Unix(), 10)
	mac := hmac.New(sha256.New, secret)
	_, _ = mac.Write([]byte(ts))
	sig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	return "v1." + ts + "." + sig
}

func validateAuthCookieValue(value string, secret []byte, now time.Time, maxAge time.Duration) bool {
	parts := strings.Split(value, ".")
	if len(parts) != 3 {
		return false
	}
	if parts[0] != "v1" {
		return false
	}
	ts, err := strconv.ParseInt(parts[1], 10, 64)
	if err != nil {
		return false
	}
	issuedAt := time.Unix(ts, 0)
	if issuedAt.After(now.Add(5 * time.Minute)) {
		return false
	}
	if now.Sub(issuedAt) > maxAge {
		return false
	}

	expected := buildAuthCookieValue(issuedAt, secret)
	if len(expected) != len(value) {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(expected), []byte(value)) == 1
}

func constantTimeEqual(a, b string) bool {
	// 避免长度泄露导致的 early return
	if len(a) != len(b) {
		// 依然做一次对比，降低时序信息
		_ = subtle.ConstantTimeCompare([]byte(a), []byte(b))
		return false
	}
	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}

var errBadID = errors.New("id 非法")
