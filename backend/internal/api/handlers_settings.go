package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/const/tg-cloud-drive/backend/internal/store"
	"golang.org/x/crypto/bcrypt"
)

type runtimeSettingsDTO struct {
	UploadConcurrency                int    `json:"uploadConcurrency"`
	DownloadConcurrency              int    `json:"downloadConcurrency"`
	ReservedDiskBytes                int64  `json:"reservedDiskBytes"`
	UploadSessionTTLHours            int    `json:"uploadSessionTtlHours"`
	UploadSessionCleanupIntervalMins int    `json:"uploadSessionCleanupIntervalMinutes"`
	ThumbnailCacheMaxBytes           int64  `json:"thumbnailCacheMaxBytes"`
	ThumbnailCacheTTLHours           int    `json:"thumbnailCacheTtlHours"`
	ThumbnailGenerateConcurrency     int    `json:"thumbnailGenerateConcurrency"`
	VaultSessionTTLMins              int    `json:"vaultSessionTtlMinutes"`
	VaultPasswordEnabled             bool   `json:"vaultPasswordEnabled"`
	TorrentQBTPasswordConfigured     bool   `json:"torrentQbtPasswordConfigured"`
	TorrentSourceDeleteMode          string `json:"torrentSourceDeleteMode"`
	TorrentSourceDeleteFixedMinutes  int    `json:"torrentSourceDeleteFixedMinutes"`
	TorrentSourceDeleteRandomMinMins int    `json:"torrentSourceDeleteRandomMinMinutes"`
	TorrentSourceDeleteRandomMaxMins int    `json:"torrentSourceDeleteRandomMaxMinutes"`
	ChunkSizeBytes                   int64  `json:"chunkSizeBytes"`
}

type serviceAccessDTO struct {
	AccessMethod string  `json:"accessMethod"`
	TGBotToken   string  `json:"tgBotToken"`
	TGStorageID  string  `json:"tgStorageChatId"`
	TGAPIID      *int64  `json:"tgApiId"`
	TGAPIHash    *string `json:"tgApiHash"`
	TGAPIBaseURL *string `json:"tgApiBaseUrl"`
}

type unifiedSettingsDTO struct {
	Runtime       runtimeSettingsDTO `json:"runtime"`
	ServiceAccess serviceAccessDTO   `json:"serviceAccess"`
}

type serviceSwitchResultDTO struct {
	OK         bool                        `json:"ok"`
	RolledBack bool                        `json:"rolledBack"`
	Unchanged  bool                        `json:"unchanged,omitempty"`
	Message    string                      `json:"message,omitempty"`
	Details    *setupConnectionTestDetails `json:"details,omitempty"`
}

type runtimeSettingsPatchRequest struct {
	UploadConcurrency                *int    `json:"uploadConcurrency"`
	DownloadConcurrency              *int    `json:"downloadConcurrency"`
	ReservedDiskBytes                *int64  `json:"reservedDiskBytes"`
	UploadSessionTTLHours            *int    `json:"uploadSessionTtlHours"`
	UploadSessionCleanupIntervalMins *int    `json:"uploadSessionCleanupIntervalMinutes"`
	ThumbnailCacheMaxBytes           *int64  `json:"thumbnailCacheMaxBytes"`
	ThumbnailCacheTTLHours           *int    `json:"thumbnailCacheTtlHours"`
	ThumbnailGenerateConcurrency     *int    `json:"thumbnailGenerateConcurrency"`
	VaultSessionTTLMins              *int    `json:"vaultSessionTtlMinutes"`
	VaultPassword                    *string `json:"vaultPassword"`
	AdminPassword                    *string `json:"adminPassword"`
	TorrentQBTPassword               *string `json:"torrentQbtPassword"`
	TorrentSourceDeleteMode          *string `json:"torrentSourceDeleteMode"`
	TorrentSourceDeleteFixedMinutes  *int    `json:"torrentSourceDeleteFixedMinutes"`
	TorrentSourceDeleteRandomMinMins *int    `json:"torrentSourceDeleteRandomMinMinutes"`
	TorrentSourceDeleteRandomMaxMins *int    `json:"torrentSourceDeleteRandomMaxMinutes"`
}

type serviceAccessPatchRequest struct {
	AccessMethod *string `json:"accessMethod"`
	TGBotToken   *string `json:"tgBotToken"`
	TGStorageID  *string `json:"tgStorageChatId"`
	TGAPIID      *int64  `json:"tgApiId"`
	TGAPIHash    *string `json:"tgApiHash"`
	TGAPIBaseURL *string `json:"tgApiBaseUrl"`
}

type patchSettingsRequest struct {
	Runtime       *runtimeSettingsPatchRequest `json:"runtime"`
	ServiceAccess *serviceAccessPatchRequest   `json:"serviceAccess"`
}

func hasRuntimePatchChanges(req *runtimeSettingsPatchRequest) bool {
	if req == nil {
		return false
	}
	return req.UploadConcurrency != nil ||
		req.DownloadConcurrency != nil ||
		req.ReservedDiskBytes != nil ||
		req.UploadSessionTTLHours != nil ||
		req.UploadSessionCleanupIntervalMins != nil ||
		req.ThumbnailCacheMaxBytes != nil ||
		req.ThumbnailCacheTTLHours != nil ||
		req.ThumbnailGenerateConcurrency != nil ||
		req.VaultSessionTTLMins != nil ||
		req.VaultPassword != nil ||
		req.TorrentQBTPassword != nil ||
		req.TorrentSourceDeleteMode != nil ||
		req.TorrentSourceDeleteFixedMinutes != nil ||
		req.TorrentSourceDeleteRandomMinMins != nil ||
		req.TorrentSourceDeleteRandomMaxMins != nil
}

func hasServicePatchChanges(req *serviceAccessPatchRequest) bool {
	if req == nil {
		return false
	}
	return req.AccessMethod != nil ||
		req.TGBotToken != nil ||
		req.TGStorageID != nil ||
		req.TGAPIID != nil ||
		req.TGAPIHash != nil ||
		req.TGAPIBaseURL != nil
}

func (s *Server) loadServiceAccessConfig(ctx context.Context, st *store.Store) (store.SystemConfig, error) {
	cfg, err := st.GetSystemConfig(ctx)
	if err != nil {
		return store.SystemConfig{}, err
	}

	if cfg.TGAPIID == nil || cfg.TGAPIHash == nil || strings.TrimSpace(*cfg.TGAPIHash) == "" {
		idFromFile, hashFromFile, loadErr := s.loadSelfHostedBotAPICredentialsFromFiles()
		if loadErr == nil {
			if cfg.TGAPIID == nil {
				cfg.TGAPIID = idFromFile
			}
			if cfg.TGAPIHash == nil || strings.TrimSpace(*cfg.TGAPIHash) == "" {
				cfg.TGAPIHash = hashFromFile
			}
		} else if !errors.Is(loadErr, os.ErrNotExist) {
			s.logger.Error("load self-hosted bot api credentials from files failed", "error", loadErr.Error())
		}
	}

	return cfg, nil
}

func (s *Server) handleGetSettings(w http.ResponseWriter, r *http.Request) {
	st := store.New(s.db)
	runtimeSettings, err := s.getRuntimeSettings(r.Context())
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			s.setupInitialized.Store(false)
			writeError(w, http.StatusServiceUnavailable, "setup_required", "系统尚未初始化，请先完成初始化配置")
			return
		}
		s.logger.Error("get runtime settings failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "读取设置失败")
		return
	}

	serviceConfig, err := s.loadServiceAccessConfig(r.Context(), st)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			s.setupInitialized.Store(false)
			writeError(w, http.StatusServiceUnavailable, "setup_required", "系统尚未初始化，请先完成初始化配置")
			return
		}
		s.logger.Error("get service access config failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "读取服务接入配置失败")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"settings": unifiedSettingsDTO{
			Runtime:       toRuntimeSettingsDTO(runtimeSettings, s.cfg.ChunkSizeBytes),
			ServiceAccess: toServiceAccessDTO(serviceConfig),
		},
	})
}

func (s *Server) validateAndPatchRuntimeSettings(
	ctx context.Context,
	req *runtimeSettingsPatchRequest,
) (store.RuntimeSettings, int, string, string, error) {
	if req.UploadConcurrency != nil && (*req.UploadConcurrency < 1 || *req.UploadConcurrency > 16) {
		return store.RuntimeSettings{}, http.StatusBadRequest, "bad_request", "并发上传范围应为 1~16", errors.New("invalid upload concurrency")
	}
	if req.DownloadConcurrency != nil && (*req.DownloadConcurrency < 1 || *req.DownloadConcurrency > 32) {
		return store.RuntimeSettings{}, http.StatusBadRequest, "bad_request", "并发下载范围应为 1~32", errors.New("invalid download concurrency")
	}
	if req.ReservedDiskBytes != nil && *req.ReservedDiskBytes < 0 {
		return store.RuntimeSettings{}, http.StatusBadRequest, "bad_request", "预留硬盘空间不能为负数", errors.New("invalid reserved disk bytes")
	}
	if req.UploadSessionTTLHours != nil && (*req.UploadSessionTTLHours < 1 || *req.UploadSessionTTLHours > 720) {
		return store.RuntimeSettings{}, http.StatusBadRequest, "bad_request", "会话 TTL 范围应为 1~720 小时", errors.New("invalid upload session ttl")
	}
	if req.UploadSessionCleanupIntervalMins != nil &&
		(*req.UploadSessionCleanupIntervalMins < 1 || *req.UploadSessionCleanupIntervalMins > 1440) {
		return store.RuntimeSettings{}, http.StatusBadRequest, "bad_request", "清理周期范围应为 1~1440 分钟", errors.New("invalid upload session cleanup interval")
	}
	if req.ThumbnailCacheMaxBytes != nil &&
		(*req.ThumbnailCacheMaxBytes < 64*1024*1024 || *req.ThumbnailCacheMaxBytes > 10*1024*1024*1024) {
		return store.RuntimeSettings{}, http.StatusBadRequest, "bad_request", "缩略图缓存上限范围应为 64MB~10GB", errors.New("invalid thumbnail cache max bytes")
	}
	if req.ThumbnailCacheTTLHours != nil && (*req.ThumbnailCacheTTLHours < 1 || *req.ThumbnailCacheTTLHours > 24*365) {
		return store.RuntimeSettings{}, http.StatusBadRequest, "bad_request", "缩略图缓存 TTL 范围应为 1~8760 小时", errors.New("invalid thumbnail cache ttl")
	}
	if req.ThumbnailGenerateConcurrency != nil &&
		(*req.ThumbnailGenerateConcurrency < 1 || *req.ThumbnailGenerateConcurrency > 4) {
		return store.RuntimeSettings{}, http.StatusBadRequest, "bad_request", "缩略图生成并发范围应为 1~4", errors.New("invalid thumbnail generation concurrency")
	}
	if req.VaultSessionTTLMins != nil &&
		(*req.VaultSessionTTLMins < 1 || *req.VaultSessionTTLMins > 1440) {
		return store.RuntimeSettings{}, http.StatusBadRequest, "bad_request", "密码箱密码有效期范围应为 1~1440 分钟", errors.New("invalid vault session ttl")
	}

	current, err := s.getRuntimeSettings(ctx)
	if err != nil {
		s.logger.Error("get runtime settings failed before patch", "error", err.Error())
		return store.RuntimeSettings{}, http.StatusInternalServerError, "internal_error", "读取当前设置失败", err
	}

	nextDeleteMode, err := normalizeTorrentSourceDeleteMode(current.TorrentSourceDeleteMode)
	if err != nil {
		nextDeleteMode = torrentSourceDeleteModeImmediate
	}
	if req.TorrentSourceDeleteMode != nil {
		nextDeleteMode, err = normalizeTorrentSourceDeleteMode(*req.TorrentSourceDeleteMode)
		if err != nil {
			return store.RuntimeSettings{}, http.StatusBadRequest, "bad_request", err.Error(), err
		}
	}

	nextFixedMins := current.TorrentSourceDeleteFixedMinutes
	if req.TorrentSourceDeleteFixedMinutes != nil {
		nextFixedMins = *req.TorrentSourceDeleteFixedMinutes
	}
	nextRandomMinMins := current.TorrentSourceDeleteRandomMinMins
	if req.TorrentSourceDeleteRandomMinMins != nil {
		nextRandomMinMins = *req.TorrentSourceDeleteRandomMinMins
	}
	nextRandomMaxMins := current.TorrentSourceDeleteRandomMaxMins
	if req.TorrentSourceDeleteRandomMaxMins != nil {
		nextRandomMaxMins = *req.TorrentSourceDeleteRandomMaxMins
	}
	if err := validateTorrentSourceDeletePolicy(nextDeleteMode, nextFixedMins, nextRandomMinMins, nextRandomMaxMins); err != nil {
		return store.RuntimeSettings{}, http.StatusBadRequest, "bad_request", err.Error(), err
	}

	var nextQBTPassword *string
	if req.TorrentQBTPassword != nil {
		trimmed := strings.TrimSpace(*req.TorrentQBTPassword)
		nextQBTPassword = &trimmed
	}

	var vaultPasswordHash *string
	if req.VaultPassword != nil {
		nextVaultPassword := strings.TrimSpace(*req.VaultPassword)
		if nextVaultPassword == "" {
			return store.RuntimeSettings{}, http.StatusBadRequest, "bad_request", "密码箱密码不能为空", errors.New("empty vault password")
		}

		adminPassword := ""
		if req.AdminPassword != nil {
			adminPassword = strings.TrimSpace(*req.AdminPassword)
		}
		requiresAdminPassword := !s.cfg.AllowDevNoAuth || strings.TrimSpace(s.adminPasswordHash) != ""
		if requiresAdminPassword {
			if adminPassword == "" || !s.verifyAdminPassword(adminPassword) {
				return store.RuntimeSettings{}, http.StatusUnauthorized, "unauthorized", "管理员访问密码校验失败", errors.New("admin password check failed")
			}
		}

		hashed, err := bcrypt.GenerateFromPassword([]byte(nextVaultPassword), bcrypt.DefaultCost)
		if err != nil {
			s.logger.Error("hash vault password failed", "error", err.Error())
			return store.RuntimeSettings{}, http.StatusInternalServerError, "internal_error", "密码箱密码加密失败", err
		}
		hashString := string(hashed)
		vaultPasswordHash = &hashString
	}

	next, err := store.New(s.db).UpdateRuntimeSettings(ctx, store.RuntimeSettingsPatch{
		UploadConcurrency:                req.UploadConcurrency,
		DownloadConcurrency:              req.DownloadConcurrency,
		ReservedDiskBytes:                req.ReservedDiskBytes,
		UploadSessionTTLHours:            req.UploadSessionTTLHours,
		UploadSessionCleanupIntervalMins: req.UploadSessionCleanupIntervalMins,
		ThumbnailCacheMaxBytes:           req.ThumbnailCacheMaxBytes,
		ThumbnailCacheTTLHours:           req.ThumbnailCacheTTLHours,
		ThumbnailGenerateConcurrency:     req.ThumbnailGenerateConcurrency,
		VaultSessionTTLMins:              req.VaultSessionTTLMins,
		VaultPasswordHash:                vaultPasswordHash,
		TorrentQBTPassword:               nextQBTPassword,
		TorrentSourceDeleteMode:          &nextDeleteMode,
		TorrentSourceDeleteFixedMinutes:  &nextFixedMins,
		TorrentSourceDeleteRandomMinMins: &nextRandomMinMins,
		TorrentSourceDeleteRandomMaxMins: &nextRandomMaxMins,
	}, s.defaultRuntimeSettings())
	if err != nil {
		s.logger.Error("update runtime settings failed", "error", err.Error())
		return store.RuntimeSettings{}, http.StatusInternalServerError, "internal_error", "保存设置失败", err
	}

	return next, 0, "", "", nil
}

func (s *Server) applyServiceAccessPatch(
	ctx context.Context,
	st *store.Store,
	req *serviceAccessPatchRequest,
) (store.SystemConfig, *serviceSwitchResultDTO, int, map[string]any, error) {
	s.setupInitMu.Lock()
	defer s.setupInitMu.Unlock()

	current, err := st.GetSystemConfig(ctx)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			s.setupInitialized.Store(false)
			return store.SystemConfig{}, nil, http.StatusServiceUnavailable, map[string]any{
				"error":   "setup_required",
				"message": "系统尚未初始化，请先完成初始化配置",
			}, err
		}
		s.logger.Error("load current system config failed", "error", err.Error())
		return store.SystemConfig{}, nil, http.StatusInternalServerError, map[string]any{
			"error":   "internal_error",
			"message": "读取当前配置失败",
		}, err
	}

	targetAccessMethod := current.AccessMethod
	if req.AccessMethod != nil {
		targetAccessMethod = strings.TrimSpace(*req.AccessMethod)
	}
	targetAccessMethod, err = normalizeSetupAccessMethod(targetAccessMethod)
	if err != nil {
		return store.SystemConfig{}, nil, http.StatusBadRequest, map[string]any{
			"error":   "bad_request",
			"message": err.Error(),
		}, err
	}

	targetTGBotToken := strings.TrimSpace(current.TGBotToken)
	if req.TGBotToken != nil {
		next := strings.TrimSpace(*req.TGBotToken)
		if next != "" {
			targetTGBotToken = next
		}
	}
	targetTGStorageChatID := strings.TrimSpace(current.TGStorageChatID)
	if req.TGStorageID != nil {
		next := strings.TrimSpace(*req.TGStorageID)
		if next != "" {
			targetTGStorageChatID = next
		}
	}
	if targetTGBotToken == "" || targetTGStorageChatID == "" {
		return store.SystemConfig{}, nil, http.StatusBadRequest, map[string]any{
			"error":   "bad_request",
			"message": "Bot Token 与 Chat ID 不能为空",
		}, errors.New("empty bot token or chat id")
	}

	targetTGAPIID := current.TGAPIID
	targetTGAPIHash := current.TGAPIHash
	targetTGAPIBaseURL := current.TGAPIBaseURL
	if targetAccessMethod == setupAccessMethodSelfHosted {
		apiIDInput := current.TGAPIID
		if req.TGAPIID != nil {
			apiIDInput = req.TGAPIID
		}

		apiHashInput := ""
		if current.TGAPIHash != nil {
			apiHashInput = strings.TrimSpace(*current.TGAPIHash)
		}
		if req.TGAPIHash != nil {
			apiHashInput = strings.TrimSpace(*req.TGAPIHash)
		}

		apiBaseURLInput := ""
		if current.TGAPIBaseURL != nil {
			apiBaseURLInput = strings.TrimSpace(*current.TGAPIBaseURL)
		}
		if req.TGAPIBaseURL != nil {
			apiBaseURLInput = strings.TrimSpace(*req.TGAPIBaseURL)
		}

		if apiIDInput == nil || apiHashInput == "" {
			idFromFile, hashFromFile, loadErr := s.loadSelfHostedBotAPICredentialsFromFiles()
			if loadErr == nil {
				if apiIDInput == nil {
					apiIDInput = idFromFile
				}
				if apiHashInput == "" && hashFromFile != nil {
					apiHashInput = strings.TrimSpace(*hashFromFile)
				}
			} else if !errors.Is(loadErr, os.ErrNotExist) {
				s.logger.Error("load self-hosted bot api credentials from files failed", "error", loadErr.Error())
			}
		}

		targetTGAPIID, targetTGAPIHash, targetTGAPIBaseURL, err = normalizeSetupExtraConfig(
			targetAccessMethod,
			apiIDInput,
			apiHashInput,
			apiBaseURLInput,
		)
		if err != nil {
			return store.SystemConfig{}, nil, http.StatusBadRequest, map[string]any{
				"error":   "bad_request",
				"message": err.Error(),
			}, err
		}
	}

	if current.AccessMethod == targetAccessMethod &&
		strings.TrimSpace(current.TGBotToken) == targetTGBotToken &&
		strings.TrimSpace(current.TGStorageChatID) == targetTGStorageChatID &&
		eqOptionalInt64(current.TGAPIID, targetTGAPIID) &&
		eqOptionalString(current.TGAPIHash, targetTGAPIHash) &&
		eqOptionalString(current.TGAPIBaseURL, targetTGAPIBaseURL) {
		return current, &serviceSwitchResultDTO{
			OK:         true,
			RolledBack: false,
			Unchanged:  true,
			Message:    "目标服务类型与当前配置一致，无需切换",
		}, 0, nil, nil
	}

	if targetAccessMethod == setupAccessMethodSelfHosted {
		if err := s.syncSelfHostedBotAPICredentials(targetTGAPIID, targetTGAPIHash); err != nil {
			s.logger.Error("sync self-hosted bot api credentials failed", "error", err.Error())
			return store.SystemConfig{}, nil, http.StatusInternalServerError, map[string]any{
				"error":   "internal_error",
				"message": "写入自建 Bot API 凭据失败",
			}, err
		}
	}

	details := runSetupConnectionTestWithRetry(
		ctx,
		targetTGBotToken,
		targetTGStorageChatID,
		targetAccessMethod,
		targetTGAPIBaseURL,
	)
	if !details.OverallOK {
		if current.AccessMethod == setupAccessMethodSelfHosted {
			if restoreErr := s.syncSelfHostedBotAPICredentialsFromConfig(current); restoreErr != nil {
				s.logger.Error("restore self-hosted bot api credentials failed", "error", restoreErr.Error())
			}
		}
		return store.SystemConfig{}, nil, http.StatusBadRequest, map[string]any{
			"error":      "bad_request",
			"message":    "目标服务配置校验失败，未执行切换",
			"details":    details,
			"rolledBack": false,
		}, errors.New("service access validation failed")
	}

	updated, err := st.UpdateSystemConfigAccess(
		ctx,
		targetAccessMethod,
		targetTGBotToken,
		targetTGStorageChatID,
		targetTGAPIID,
		targetTGAPIHash,
		targetTGAPIBaseURL,
	)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			return store.SystemConfig{}, nil, http.StatusServiceUnavailable, map[string]any{
				"error":   "setup_required",
				"message": "系统尚未初始化，请先完成初始化配置",
			}, err
		}
		s.logger.Error("persist service access config failed", "error", err.Error())
		return store.SystemConfig{}, nil, http.StatusInternalServerError, map[string]any{
			"error":   "internal_error",
			"message": "持久化服务接入配置失败",
		}, err
	}

	nextClient := buildTelegramClient(
		updated.TGBotToken,
		updated.AccessMethod,
		updated.TGAPIBaseURL,
		5*time.Minute,
	)
	if err := nextClient.SelfCheck(ctx, updated.TGStorageChatID); err != nil {
		s.logger.Error("verify switched service access failed", "error", err.Error())

		rollbackCfg, rollbackErr := st.UpdateSystemConfigAccess(
			ctx,
			current.AccessMethod,
			current.TGBotToken,
			current.TGStorageChatID,
			current.TGAPIID,
			current.TGAPIHash,
			current.TGAPIBaseURL,
		)
		if rollbackErr != nil {
			s.logger.Error("rollback service access config failed", "error", rollbackErr.Error())
			return store.SystemConfig{}, nil, http.StatusInternalServerError, map[string]any{
				"error":      "internal_error",
				"message":    "切换失败且回滚失败，请立即检查数据库中的 system_config 配置",
				"rolledBack": false,
			}, rollbackErr
		}
		if rollbackCfg.AccessMethod == setupAccessMethodSelfHosted {
			if restoreErr := s.syncSelfHostedBotAPICredentialsFromConfig(rollbackCfg); restoreErr != nil {
				s.logger.Error("restore self-hosted bot api credentials failed", "error", restoreErr.Error())
				return store.SystemConfig{}, nil, http.StatusInternalServerError, map[string]any{
					"error":      "internal_error",
					"message":    "切换失败且恢复自建 Bot API 凭据失败，请立即检查 system_config 配置与凭据文件",
					"rolledBack": false,
				}, restoreErr
			}
		}

		rollbackClient := buildTelegramClient(
			rollbackCfg.TGBotToken,
			rollbackCfg.AccessMethod,
			rollbackCfg.TGAPIBaseURL,
			5*time.Minute,
		)
		s.applySystemConfig(rollbackCfg, rollbackClient)

		return store.SystemConfig{}, nil, http.StatusInternalServerError, map[string]any{
			"error":      "internal_error",
			"message":    "切换失败，已自动回滚到原配置",
			"rolledBack": true,
		}, err
	}

	s.applySystemConfig(updated, nextClient)
	return updated, &serviceSwitchResultDTO{
		OK:         true,
		RolledBack: false,
		Message:    "服务接入方式切换成功",
		Details:    &details,
	}, 0, nil, nil
}

func (s *Server) handlePatchSettings(w http.ResponseWriter, r *http.Request) {
	var req patchSettingsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "请求体不是合法 JSON")
		return
	}

	hasRuntimeChanges := hasRuntimePatchChanges(req.Runtime)
	hasServiceChanges := hasServicePatchChanges(req.ServiceAccess)
	if !hasRuntimeChanges && !hasServiceChanges {
		writeError(w, http.StatusBadRequest, "bad_request", "至少需要提供一个可更新字段")
		return
	}

	if hasRuntimeChanges {
		if _, status, code, message, err := s.validateAndPatchRuntimeSettings(r.Context(), req.Runtime); err != nil {
			writeError(w, status, code, message)
			return
		}
	}

	st := store.New(s.db)
	var switchResult *serviceSwitchResultDTO
	if hasServiceChanges {
		_, switchResultValue, status, payload, err := s.applyServiceAccessPatch(r.Context(), st, req.ServiceAccess)
		if err != nil {
			writeJSON(w, status, payload)
			return
		}
		switchResult = switchResultValue
	}

	runtimeSettings, err := s.getRuntimeSettings(r.Context())
	if err != nil {
		s.logger.Error("reload runtime settings failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "读取设置失败")
		return
	}
	serviceConfig, err := s.loadServiceAccessConfig(r.Context(), st)
	if err != nil {
		s.logger.Error("reload service access failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "读取服务接入配置失败")
		return
	}

	response := map[string]any{
		"settings": unifiedSettingsDTO{
			Runtime:       toRuntimeSettingsDTO(runtimeSettings, s.cfg.ChunkSizeBytes),
			ServiceAccess: toServiceAccessDTO(serviceConfig),
		},
	}
	if switchResult != nil {
		response["switchResult"] = switchResult
	}
	writeJSON(w, http.StatusOK, response)
}

func toRuntimeSettingsDTO(s store.RuntimeSettings, chunkSizeBytes int64) runtimeSettingsDTO {
	deleteMode := strings.TrimSpace(s.TorrentSourceDeleteMode)
	if _, err := normalizeTorrentSourceDeleteMode(deleteMode); err != nil {
		deleteMode = torrentSourceDeleteModeImmediate
	}

	return runtimeSettingsDTO{
		UploadConcurrency:                s.UploadConcurrency,
		DownloadConcurrency:              s.DownloadConcurrency,
		ReservedDiskBytes:                s.ReservedDiskBytes,
		UploadSessionTTLHours:            s.UploadSessionTTLHours,
		UploadSessionCleanupIntervalMins: s.UploadSessionCleanupIntervalMins,
		ThumbnailCacheMaxBytes:           s.ThumbnailCacheMaxBytes,
		ThumbnailCacheTTLHours:           s.ThumbnailCacheTTLHours,
		ThumbnailGenerateConcurrency:     s.ThumbnailGenerateConcurrency,
		VaultSessionTTLMins:              s.VaultSessionTTLMins,
		VaultPasswordEnabled:             strings.TrimSpace(s.VaultPasswordHash) != "",
		TorrentQBTPasswordConfigured:     strings.TrimSpace(s.TorrentQBTPassword) != "",
		TorrentSourceDeleteMode:          deleteMode,
		TorrentSourceDeleteFixedMinutes:  s.TorrentSourceDeleteFixedMinutes,
		TorrentSourceDeleteRandomMinMins: s.TorrentSourceDeleteRandomMinMins,
		TorrentSourceDeleteRandomMaxMins: s.TorrentSourceDeleteRandomMaxMins,
		ChunkSizeBytes:                   chunkSizeBytes,
	}
}

func toServiceAccessDTO(cfg store.SystemConfig) serviceAccessDTO {
	return serviceAccessDTO{
		AccessMethod: strings.TrimSpace(cfg.AccessMethod),
		TGBotToken:   strings.TrimSpace(cfg.TGBotToken),
		TGStorageID:  strings.TrimSpace(cfg.TGStorageChatID),
		TGAPIID:      cfg.TGAPIID,
		TGAPIHash:    cfg.TGAPIHash,
		TGAPIBaseURL: cfg.TGAPIBaseURL,
	}
}

func eqOptionalInt64(a *int64, b *int64) bool {
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}
	return *a == *b
}

func eqOptionalString(a *string, b *string) bool {
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}
	return strings.TrimSpace(*a) == strings.TrimSpace(*b)
}
