package api

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/const/tg-cloud-drive/backend/internal/store"
	"golang.org/x/crypto/bcrypt"
)

const vaultCookieName = "tgcd_vault"

func (s *Server) handleVaultStatus(w http.ResponseWriter, r *http.Request) {
	settings, err := s.getRuntimeSettings(r.Context())
	if err != nil {
		s.logger.Error("get runtime settings failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "读取密码箱状态失败")
		return
	}

	enabled := strings.TrimSpace(settings.VaultPasswordHash) != ""
	unlocked := false
	expiresAt := ""

	if enabled {
		ok, exp := s.isVaultUnlocked(r, settings, time.Now())
		unlocked = ok
		if ok {
			expiresAt = exp.Format(time.RFC3339)
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"enabled":   enabled,
		"unlocked":  unlocked,
		"expiresAt": expiresAt,
	})
}

func (s *Server) handleVaultUnlock(w http.ResponseWriter, r *http.Request) {
	settings, err := s.getRuntimeSettings(r.Context())
	if err != nil {
		s.logger.Error("get runtime settings failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "读取密码箱设置失败")
		return
	}
	if strings.TrimSpace(settings.VaultPasswordHash) == "" {
		writeError(w, http.StatusBadRequest, "bad_request", "请先在设置中配置密码箱密码")
		return
	}

	var req struct {
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "请求体不是合法 JSON")
		return
	}
	password := strings.TrimSpace(req.Password)
	if password == "" {
		writeError(w, http.StatusBadRequest, "bad_request", "密码不能为空")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(settings.VaultPasswordHash), []byte(password)); err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "密码箱密码错误")
		return
	}

	now := time.Now()
	expireAt := now.Add(vaultSessionTTL(settings))
	s.setVaultCookie(w, now, settings)
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":        true,
		"expiresAt": expireAt.Format(time.RFC3339),
	})
}

func (s *Server) handleVaultLock(w http.ResponseWriter, r *http.Request) {
	s.clearVaultCookie(w)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) isVaultUnlocked(r *http.Request, settings store.RuntimeSettings, now time.Time) (bool, time.Time) {
	hash := strings.TrimSpace(settings.VaultPasswordHash)
	if hash == "" {
		return false, time.Time{}
	}

	c, err := r.Cookie(vaultCookieName)
	if err != nil || c == nil {
		return false, time.Time{}
	}

	ttl := time.Duration(settings.VaultSessionTTLMins) * time.Minute
	if ttl <= 0 {
		ttl = 60 * time.Minute
	}
	return validateVaultCookieValue(c.Value, s.cfg.CookieSecret, now, ttl, hash)
}

func (s *Server) setVaultCookie(w http.ResponseWriter, now time.Time, settings store.RuntimeSettings) {
	hash := strings.TrimSpace(settings.VaultPasswordHash)
	if hash == "" {
		s.clearVaultCookie(w)
		return
	}

	ttl := time.Duration(settings.VaultSessionTTLMins) * time.Minute
	if ttl <= 0 {
		ttl = 60 * time.Minute
	}
	maxAge := int(ttl / time.Second)
	if maxAge <= 0 {
		maxAge = 3600
	}

	value := buildVaultCookieValue(now, s.cfg.CookieSecret, hash)
	c := &http.Cookie{
		Name:     vaultCookieName,
		Value:    value,
		Path:     "/",
		HttpOnly: true,
		MaxAge:   maxAge,
		SameSite: http.SameSiteLaxMode,
		Secure:   s.cfg.CookieSecure,
	}
	http.SetCookie(w, c)
}

func (s *Server) clearVaultCookie(w http.ResponseWriter) {
	c := &http.Cookie{
		Name:     vaultCookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		MaxAge:   -1,
		SameSite: http.SameSiteLaxMode,
		Secure:   s.cfg.CookieSecure,
	}
	http.SetCookie(w, c)
}

func vaultSessionTTL(settings store.RuntimeSettings) time.Duration {
	ttl := time.Duration(settings.VaultSessionTTLMins) * time.Minute
	if ttl <= 0 {
		return 60 * time.Minute
	}
	return ttl
}

func buildVaultCookieValue(now time.Time, secret []byte, vaultHash string) string {
	ts := strconv.FormatInt(now.Unix(), 10)
	payload := "v1." + ts
	mac := hmac.New(sha256.New, secret)
	_, _ = mac.Write([]byte(payload))
	_, _ = mac.Write([]byte("."))
	_, _ = mac.Write([]byte(vaultHash))
	sig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	return payload + "." + sig
}

func validateVaultCookieValue(value string, secret []byte, now time.Time, ttl time.Duration, vaultHash string) (bool, time.Time) {
	parts := strings.Split(value, ".")
	if len(parts) != 3 {
		return false, time.Time{}
	}
	if parts[0] != "v1" {
		return false, time.Time{}
	}
	ts, err := strconv.ParseInt(parts[1], 10, 64)
	if err != nil {
		return false, time.Time{}
	}
	issuedAt := time.Unix(ts, 0)
	expireAt := issuedAt.Add(ttl)
	if issuedAt.After(now.Add(5 * time.Minute)) {
		return false, time.Time{}
	}
	if now.After(expireAt) {
		return false, time.Time{}
	}

	expected := buildVaultCookieValue(issuedAt, secret, vaultHash)
	if len(expected) != len(value) {
		return false, time.Time{}
	}
	if subtle.ConstantTimeCompare([]byte(expected), []byte(value)) != 1 {
		return false, time.Time{}
	}
	return true, expireAt
}
