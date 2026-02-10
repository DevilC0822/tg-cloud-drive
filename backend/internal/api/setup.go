package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/const/tg-cloud-drive/backend/internal/store"
	"github.com/const/tg-cloud-drive/backend/internal/telegram"
	"golang.org/x/crypto/bcrypt"
)

const (
	setupAccessMethodOfficial   = "official_bot_api"
	setupAccessMethodSelfHosted = "self_hosted_bot_api"
	setupAccessMethodMTProto    = "mtproto"
	setupDefaultBotAPIBaseURL   = "http://telegram-bot-api:8081"
)

type setupConnectionStepBot struct {
	OK       bool   `json:"ok"`
	ID       int64  `json:"id,omitempty"`
	Username string `json:"username,omitempty"`
	IsBot    bool   `json:"isBot"`
	Error    string `json:"error,omitempty"`
}

type setupConnectionStepChat struct {
	OK       bool   `json:"ok"`
	ID       int64  `json:"id,omitempty"`
	Type     string `json:"type,omitempty"`
	Title    string `json:"title,omitempty"`
	Username string `json:"username,omitempty"`
	Error    string `json:"error,omitempty"`
}

type setupConnectionStepAdmin struct {
	OK         bool   `json:"ok"`
	AdminCount int    `json:"adminCount"`
	Error      string `json:"error,omitempty"`
}

type setupConnectionTestDetails struct {
	AccessMethod string                   `json:"accessMethod"`
	APIBaseURL   string                   `json:"apiBaseUrl,omitempty"`
	OverallOK    bool                     `json:"overallOk"`
	Summary      string                   `json:"summary"`
	TestedAt     string                   `json:"testedAt"`
	Bot          setupConnectionStepBot   `json:"bot"`
	Chat         setupConnectionStepChat  `json:"chat"`
	Admin        setupConnectionStepAdmin `json:"admin"`
}

func (s *Server) setupRequiredMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if s.isSystemInitialized() {
			next.ServeHTTP(w, r)
			return
		}
		writeError(w, http.StatusServiceUnavailable, "setup_required", "系统尚未初始化，请先完成初始化配置")
	})
}

func (s *Server) isSystemInitialized() bool {
	return s.setupInitialized.Load()
}

func (s *Server) startBackgroundLoopsIfNeeded() {
	if !s.loopsStarted.CompareAndSwap(false, true) {
		return
	}
	s.startUploadSessionCleanupLoop()
	s.startThumbnailCacheCleanupLoop()
}

func (s *Server) bootstrapSystemConfig(ctx context.Context) error {
	if s.db == nil {
		return nil
	}

	cfg, err := store.New(s.db).GetSystemConfig(ctx)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			return nil
		}
		return err
	}
	if cfg.AccessMethod == setupAccessMethodSelfHosted {
		if err := s.syncSelfHostedBotAPICredentialsFromConfig(cfg); err != nil {
			return err
		}
	}

	tg := buildTelegramClient(cfg.TGBotToken, cfg.AccessMethod, cfg.TGAPIBaseURL, 5*time.Minute)
	if err := tg.SelfCheck(ctx, cfg.TGStorageChatID); err != nil {
		return err
	}

	s.applySystemConfig(cfg, tg)
	return nil
}

func (s *Server) applySystemConfig(cfg store.SystemConfig, tg *telegram.Client) {
	s.cfg.TGStorageChatID = strings.TrimSpace(cfg.TGStorageChatID)
	s.adminPasswordHash = strings.TrimSpace(cfg.AdminPasswordHash)
	s.setTelegramClient(tg)
	s.setupInitialized.Store(true)
	s.startBackgroundLoopsIfNeeded()
}

func (s *Server) verifyAdminPassword(password string) bool {
	hash := strings.TrimSpace(s.adminPasswordHash)
	if hash == "" {
		return false
	}
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

func (s *Server) handleSetupStatus(w http.ResponseWriter, r *http.Request) {
	if !s.isSystemInitialized() {
		writeJSON(w, http.StatusOK, map[string]any{
			"initialized": false,
		})
		return
	}

	cfg, err := store.New(s.db).GetSystemConfig(r.Context())
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			s.setupInitialized.Store(false)
			writeJSON(w, http.StatusOK, map[string]any{
				"initialized": false,
			})
			return
		}
		s.logger.Error("get system config failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "读取初始化配置失败")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"initialized":  true,
		"accessMethod": cfg.AccessMethod,
		"tgApiId":      cfg.TGAPIID,
		"tgApiHash":    cfg.TGAPIHash,
		"tgApiBaseUrl": cfg.TGAPIBaseURL,
	})
}

func (s *Server) handleSetupInit(w http.ResponseWriter, r *http.Request) {
	if s.db == nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "数据库未就绪")
		return
	}

	var req struct {
		AccessMethod    string `json:"accessMethod"`
		TGBotToken      string `json:"tgBotToken"`
		TGStorageChatID string `json:"tgStorageChatId"`
		TGAPIID         *int64 `json:"tgApiId"`
		TGAPIHash       string `json:"tgApiHash"`
		TGAPIBaseURL    string `json:"tgApiBaseUrl"`
		AdminPassword   string `json:"adminPassword"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "请求体不是合法 JSON")
		return
	}

	accessMethod, err := normalizeSetupAccessMethod(req.AccessMethod)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	tgBotToken := strings.TrimSpace(req.TGBotToken)
	tgStorageChatID := strings.TrimSpace(req.TGStorageChatID)
	tgAPIID, tgAPIHash, tgAPIBaseURL, err := normalizeSetupExtraConfig(accessMethod, req.TGAPIID, req.TGAPIHash, req.TGAPIBaseURL)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	adminPassword := strings.TrimSpace(req.AdminPassword)
	if tgBotToken == "" || tgStorageChatID == "" || adminPassword == "" {
		writeError(w, http.StatusBadRequest, "bad_request", "请完整填写 Bot Token、存储 Chat ID 和管理员密码")
		return
	}

	s.setupInitMu.Lock()
	defer s.setupInitMu.Unlock()

	if s.isSystemInitialized() {
		writeError(w, http.StatusConflict, "conflict", "系统已完成初始化")
		return
	}

	if accessMethod == setupAccessMethodSelfHosted {
		if err := s.syncSelfHostedBotAPICredentials(tgAPIID, tgAPIHash); err != nil {
			s.logger.Error("sync self-hosted bot api credentials failed", "error", err.Error())
			writeError(w, http.StatusInternalServerError, "internal_error", "写入自建 Bot API 凭据失败")
			return
		}
	}

	details := runSetupConnectionTestWithRetry(r.Context(), tgBotToken, tgStorageChatID, accessMethod, tgAPIBaseURL)
	if !details.OverallOK {
		writeJSON(w, http.StatusBadRequest, map[string]any{
			"error":   "bad_request",
			"message": "Telegram 配置校验失败",
			"details": details,
		})
		return
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(adminPassword), bcrypt.DefaultCost)
	if err != nil {
		s.logger.Error("hash admin password failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "管理员密码加密失败")
		return
	}

	created, err := store.New(s.db).InitializeSystemConfig(
		r.Context(),
		accessMethod,
		tgBotToken,
		tgStorageChatID,
		tgAPIID,
		tgAPIHash,
		tgAPIBaseURL,
		string(hashed),
	)
	if err != nil {
		switch {
		case errors.Is(err, store.ErrConflict):
			writeError(w, http.StatusConflict, "conflict", "系统已完成初始化")
		case errors.Is(err, store.ErrBadInput):
			writeError(w, http.StatusBadRequest, "bad_request", "初始化参数非法")
		default:
			s.logger.Error("initialize system config failed", "error", err.Error())
			writeError(w, http.StatusInternalServerError, "internal_error", "初始化失败")
		}
		return
	}

	tg := buildTelegramClient(created.TGBotToken, created.AccessMethod, created.TGAPIBaseURL, 5*time.Minute)
	s.applySystemConfig(created, tg)
	s.setAuthCookie(w, time.Now())
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handleSetupTestConnection(w http.ResponseWriter, r *http.Request) {
	var req struct {
		AccessMethod    string `json:"accessMethod"`
		TGBotToken      string `json:"tgBotToken"`
		TGStorageChatID string `json:"tgStorageChatId"`
		TGAPIID         *int64 `json:"tgApiId"`
		TGAPIHash       string `json:"tgApiHash"`
		TGAPIBaseURL    string `json:"tgApiBaseUrl"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "请求体不是合法 JSON")
		return
	}

	accessMethod, err := normalizeSetupAccessMethod(req.AccessMethod)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	tgBotToken := strings.TrimSpace(req.TGBotToken)
	tgStorageChatID := strings.TrimSpace(req.TGStorageChatID)
	if tgBotToken == "" || tgStorageChatID == "" {
		writeError(w, http.StatusBadRequest, "bad_request", "请先填写 Bot Token 与 Chat ID")
		return
	}
	tgAPIID, tgAPIHash, tgAPIBaseURL, err := normalizeSetupExtraConfig(accessMethod, req.TGAPIID, req.TGAPIHash, req.TGAPIBaseURL)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	if accessMethod == setupAccessMethodSelfHosted {
		if err := s.syncSelfHostedBotAPICredentials(tgAPIID, tgAPIHash); err != nil {
			s.logger.Error("sync self-hosted bot api credentials failed", "error", err.Error())
			writeError(w, http.StatusInternalServerError, "internal_error", "写入自建 Bot API 凭据失败")
			return
		}
	}

	details := runSetupConnectionTestWithRetry(r.Context(), tgBotToken, tgStorageChatID, accessMethod, tgAPIBaseURL)
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":      details.OverallOK,
		"details": details,
	})
}

func normalizeSetupAccessMethod(raw string) (string, error) {
	method := strings.TrimSpace(raw)
	if method == "" {
		method = setupAccessMethodOfficial
	}
	switch method {
	case setupAccessMethodOfficial, setupAccessMethodSelfHosted:
		return method, nil
	case setupAccessMethodMTProto:
		return "", errors.New("MTProto 暂未开放，请选择其他接入方式")
	default:
		return "", errors.New("接入方式非法")
	}
}

func normalizeSetupExtraConfig(accessMethod string, tgAPIID *int64, tgAPIHashRaw string, tgAPIBaseURLRaw string) (*int64, *string, *string, error) {
	if accessMethod != setupAccessMethodSelfHosted {
		return nil, nil, nil, nil
	}
	if tgAPIID == nil || *tgAPIID <= 0 {
		return nil, nil, nil, errors.New("自建 Bot API 模式下 API ID 必须是正整数")
	}
	hash := strings.TrimSpace(tgAPIHashRaw)
	if hash == "" {
		return nil, nil, nil, errors.New("自建 Bot API 模式下 API Hash 不能为空")
	}
	baseURL, err := normalizeSetupBotAPIBaseURL(tgAPIBaseURLRaw)
	if err != nil {
		return nil, nil, nil, err
	}
	id := *tgAPIID
	return &id, &hash, baseURL, nil
}

func normalizeSetupBotAPIBaseURL(raw string) (*string, error) {
	value := strings.TrimSpace(raw)
	if value == "" {
		value = setupDefaultBotAPIBaseURL
	}
	parsed, err := url.Parse(value)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return nil, errors.New("Bot API Base URL 格式非法，请填写如 http://telegram-bot-api:8081")
	}
	scheme := strings.ToLower(strings.TrimSpace(parsed.Scheme))
	if scheme != "http" && scheme != "https" {
		return nil, errors.New("Bot API Base URL 仅支持 http 或 https")
	}
	parsed.Scheme = scheme
	parsed.RawQuery = ""
	parsed.Fragment = ""
	normalized := strings.TrimRight(parsed.String(), "/")
	if normalized == "" {
		return nil, errors.New("Bot API Base URL 不能为空")
	}
	return &normalized, nil
}

func resolveSelfHostedBotAPIBaseURL(raw *string) string {
	if raw != nil {
		trimmed := strings.TrimSpace(*raw)
		if trimmed != "" {
			return trimmed
		}
	}
	return setupDefaultBotAPIBaseURL
}

func buildTelegramClient(token string, accessMethod string, tgAPIBaseURL *string, timeout time.Duration) *telegram.Client {
	options := make([]telegram.ClientOption, 0, 1)
	if accessMethod == setupAccessMethodSelfHosted {
		options = append(options, telegram.WithBaseURL(resolveSelfHostedBotAPIBaseURL(tgAPIBaseURL)))
	}
	return telegram.NewClient(strings.TrimSpace(token), &http.Client{Timeout: timeout}, options...)
}

func runSetupConnectionTest(
	ctx context.Context,
	tgBotToken string,
	tgStorageChatID string,
	accessMethod string,
	tgAPIBaseURL *string,
) setupConnectionTestDetails {
	details := setupConnectionTestDetails{
		AccessMethod: accessMethod,
		TestedAt:     time.Now().Format(time.RFC3339),
		Summary:      "连接测试未完成",
	}
	if accessMethod == setupAccessMethodSelfHosted {
		details.APIBaseURL = resolveSelfHostedBotAPIBaseURL(tgAPIBaseURL)
	}
	client := buildTelegramClient(tgBotToken, accessMethod, tgAPIBaseURL, 45*time.Second)

	me, err := client.GetMe(ctx)
	if err != nil {
		details.Bot.Error = err.Error()
		details.Summary = "Bot Token 校验失败"
		return details
	}
	details.Bot.OK = true
	details.Bot.ID = me.ID
	details.Bot.Username = strings.TrimSpace(me.Username)
	details.Bot.IsBot = me.IsBot
	if !me.IsBot {
		details.Bot.OK = false
		details.Bot.Error = "token 对应账号不是 bot"
		details.Summary = "Bot Token 校验失败"
		return details
	}

	chat, err := client.GetChat(ctx, tgStorageChatID)
	if err != nil {
		details.Chat.Error = err.Error()
		details.Summary = "Chat ID 校验失败"
		return details
	}
	details.Chat.OK = true
	details.Chat.ID = chat.ID
	details.Chat.Type = strings.TrimSpace(chat.Type)
	details.Chat.Title = strings.TrimSpace(chat.Title)
	details.Chat.Username = strings.TrimSpace(chat.Username)

	admins, err := client.GetChatAdministrators(ctx, tgStorageChatID)
	if err != nil {
		details.Admin.Error = err.Error()
		details.Summary = "管理员权限校验失败"
		return details
	}
	details.Admin.AdminCount = len(admins)
	for _, m := range admins {
		if m.User.ID == me.ID {
			details.Admin.OK = true
			break
		}
	}
	if !details.Admin.OK {
		details.Admin.Error = "bot 不在管理员列表中"
		details.Summary = "管理员权限校验失败"
		return details
	}

	details.OverallOK = true
	details.Summary = "连接测试通过：Bot Token、Chat ID 与管理员权限校验成功"
	if accessMethod == setupAccessMethodSelfHosted {
		details.Summary = fmt.Sprintf("%s（已切换到自建 Bot API）", details.Summary)
	}
	return details
}
