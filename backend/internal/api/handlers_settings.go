package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/const/tg-cloud-drive/backend/internal/store"
	"golang.org/x/crypto/bcrypt"
)

type settingsDTO struct {
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

func (s *Server) handleGetSettings(w http.ResponseWriter, r *http.Request) {
	settings, err := s.getRuntimeSettings(r.Context())
	if err != nil {
		s.logger.Error("get runtime settings failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "读取设置失败")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"settings": toSettingsDTO(settings, s.cfg.ChunkSizeBytes),
	})
}

func (s *Server) handleGetServiceAccess(w http.ResponseWriter, r *http.Request) {
	cfg, err := store.New(s.db).GetSystemConfig(r.Context())
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusServiceUnavailable, "setup_required", "系统尚未初始化，请先完成初始化配置")
			return
		}
		s.logger.Error("get service access config failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "读取服务接入配置失败")
		return
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

	writeJSON(w, http.StatusOK, map[string]any{
		"serviceAccess": toServiceAccessDTO(cfg),
	})
}

func (s *Server) handlePatchServiceAccess(w http.ResponseWriter, r *http.Request) {
	var req struct {
		AccessMethod string `json:"accessMethod"`
		TGBotToken   string `json:"tgBotToken"`
		TGStorageID  string `json:"tgStorageChatId"`
		TGAPIID      *int64 `json:"tgApiId"`
		TGAPIHash    string `json:"tgApiHash"`
		TGAPIBaseURL string `json:"tgApiBaseUrl"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "请求体不是合法 JSON")
		return
	}

	targetAccessMethod, err := normalizeSetupAccessMethod(req.AccessMethod)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", err.Error())
		return
	}

	s.setupInitMu.Lock()
	defer s.setupInitMu.Unlock()

	st := store.New(s.db)
	current, err := st.GetSystemConfig(r.Context())
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			s.setupInitialized.Store(false)
			writeError(w, http.StatusServiceUnavailable, "setup_required", "系统尚未初始化，请先完成初始化配置")
			return
		}
		s.logger.Error("load current system config failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "读取当前配置失败")
		return
	}

	targetTGBotToken := strings.TrimSpace(req.TGBotToken)
	if targetTGBotToken == "" {
		targetTGBotToken = current.TGBotToken
	}
	targetTGStorageChatID := strings.TrimSpace(req.TGStorageID)
	if targetTGStorageChatID == "" {
		targetTGStorageChatID = current.TGStorageChatID
	}
	if targetTGBotToken == "" || targetTGStorageChatID == "" {
		writeError(w, http.StatusBadRequest, "bad_request", "Bot Token 与 Chat ID 不能为空")
		return
	}

	// 官方模式下保留历史自建参数，便于后续切回时自动反显并复用。
	targetTGAPIID := current.TGAPIID
	targetTGAPIHash := current.TGAPIHash
	targetTGAPIBaseURL := current.TGAPIBaseURL
	if targetAccessMethod == setupAccessMethodSelfHosted {
		apiIDInput := req.TGAPIID
		if apiIDInput == nil {
			apiIDInput = current.TGAPIID
		}
		apiHashInput := strings.TrimSpace(req.TGAPIHash)
		if apiHashInput == "" && current.TGAPIHash != nil {
			apiHashInput = strings.TrimSpace(*current.TGAPIHash)
		}
		apiBaseURLInput := strings.TrimSpace(req.TGAPIBaseURL)
		if apiBaseURLInput == "" && current.TGAPIBaseURL != nil {
			apiBaseURLInput = strings.TrimSpace(*current.TGAPIBaseURL)
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
			writeError(w, http.StatusBadRequest, "bad_request", err.Error())
			return
		}
	}

	if current.AccessMethod == targetAccessMethod &&
		strings.TrimSpace(current.TGBotToken) == targetTGBotToken &&
		strings.TrimSpace(current.TGStorageChatID) == targetTGStorageChatID &&
		eqOptionalInt64(current.TGAPIID, targetTGAPIID) &&
		eqOptionalString(current.TGAPIHash, targetTGAPIHash) &&
		eqOptionalString(current.TGAPIBaseURL, targetTGAPIBaseURL) {
		writeJSON(w, http.StatusOK, map[string]any{
			"ok":            true,
			"rolledBack":    false,
			"unchanged":     true,
			"message":       "目标服务类型与当前配置一致，无需切换",
			"serviceAccess": toServiceAccessDTO(current),
		})
		return
	}

	if targetAccessMethod == setupAccessMethodSelfHosted {
		if err := s.syncSelfHostedBotAPICredentials(targetTGAPIID, targetTGAPIHash); err != nil {
			s.logger.Error("sync self-hosted bot api credentials failed", "error", err.Error())
			writeError(w, http.StatusInternalServerError, "internal_error", "写入自建 Bot API 凭据失败")
			return
		}
	}

	details := runSetupConnectionTestWithRetry(
		r.Context(),
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
		writeJSON(w, http.StatusBadRequest, map[string]any{
			"error":      "bad_request",
			"message":    "目标服务配置校验失败，未执行切换",
			"details":    details,
			"rolledBack": false,
		})
		return
	}

	updated, err := st.UpdateSystemConfigAccess(
		r.Context(),
		targetAccessMethod,
		targetTGBotToken,
		targetTGStorageChatID,
		targetTGAPIID,
		targetTGAPIHash,
		targetTGAPIBaseURL,
	)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusServiceUnavailable, "setup_required", "系统尚未初始化，请先完成初始化配置")
			return
		}
		s.logger.Error("persist service access config failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "持久化服务接入配置失败")
		return
	}

	nextClient := buildTelegramClient(
		updated.TGBotToken,
		updated.AccessMethod,
		updated.TGAPIBaseURL,
		5*time.Minute,
	)
	if err := nextClient.SelfCheck(r.Context(), updated.TGStorageChatID); err != nil {
		s.logger.Error("verify switched service access failed", "error", err.Error())

		rollbackCfg, rollbackErr := st.UpdateSystemConfigAccess(
			r.Context(),
			current.AccessMethod,
			current.TGBotToken,
			current.TGStorageChatID,
			current.TGAPIID,
			current.TGAPIHash,
			current.TGAPIBaseURL,
		)
		if rollbackErr != nil {
			s.logger.Error("rollback service access config failed", "error", rollbackErr.Error())
			writeJSON(w, http.StatusInternalServerError, map[string]any{
				"error":      "internal_error",
				"message":    "切换失败且回滚失败，请立即检查数据库中的 system_config 配置",
				"rolledBack": false,
			})
			return
		}
		if rollbackCfg.AccessMethod == setupAccessMethodSelfHosted {
			if restoreErr := s.syncSelfHostedBotAPICredentialsFromConfig(rollbackCfg); restoreErr != nil {
				s.logger.Error("restore self-hosted bot api credentials failed", "error", restoreErr.Error())
				writeJSON(w, http.StatusInternalServerError, map[string]any{
					"error":      "internal_error",
					"message":    "切换失败且恢复自建 Bot API 凭据失败，请立即检查 system_config 配置与凭据文件",
					"rolledBack": false,
				})
				return
			}
		}

		rollbackClient := buildTelegramClient(
			rollbackCfg.TGBotToken,
			rollbackCfg.AccessMethod,
			rollbackCfg.TGAPIBaseURL,
			5*time.Minute,
		)
		s.applySystemConfig(rollbackCfg, rollbackClient)

		writeJSON(w, http.StatusInternalServerError, map[string]any{
			"error":      "internal_error",
			"message":    "切换失败，已自动回滚到原配置",
			"rolledBack": true,
		})
		return
	}

	s.applySystemConfig(updated, nextClient)
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":            true,
		"rolledBack":    false,
		"message":       "服务接入方式切换成功",
		"details":       details,
		"serviceAccess": toServiceAccessDTO(updated),
	})
}

func (s *Server) handlePatchSettings(w http.ResponseWriter, r *http.Request) {
	var req struct {
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
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "请求体不是合法 JSON")
		return
	}

	if req.UploadConcurrency == nil &&
		req.DownloadConcurrency == nil &&
		req.ReservedDiskBytes == nil &&
		req.UploadSessionTTLHours == nil &&
		req.UploadSessionCleanupIntervalMins == nil &&
		req.ThumbnailCacheMaxBytes == nil &&
		req.ThumbnailCacheTTLHours == nil &&
		req.ThumbnailGenerateConcurrency == nil &&
		req.VaultSessionTTLMins == nil &&
		req.VaultPassword == nil &&
		req.TorrentQBTPassword == nil &&
		req.TorrentSourceDeleteMode == nil &&
		req.TorrentSourceDeleteFixedMinutes == nil &&
		req.TorrentSourceDeleteRandomMinMins == nil &&
		req.TorrentSourceDeleteRandomMaxMins == nil {
		writeError(w, http.StatusBadRequest, "bad_request", "至少需要提供一个可更新字段")
		return
	}
	if req.UploadConcurrency != nil && (*req.UploadConcurrency < 1 || *req.UploadConcurrency > 16) {
		writeError(w, http.StatusBadRequest, "bad_request", "并发上传范围应为 1~16")
		return
	}
	if req.DownloadConcurrency != nil && (*req.DownloadConcurrency < 1 || *req.DownloadConcurrency > 32) {
		writeError(w, http.StatusBadRequest, "bad_request", "并发下载范围应为 1~32")
		return
	}
	if req.ReservedDiskBytes != nil && *req.ReservedDiskBytes < 0 {
		writeError(w, http.StatusBadRequest, "bad_request", "预留硬盘空间不能为负数")
		return
	}
	if req.UploadSessionTTLHours != nil && (*req.UploadSessionTTLHours < 1 || *req.UploadSessionTTLHours > 720) {
		writeError(w, http.StatusBadRequest, "bad_request", "会话 TTL 范围应为 1~720 小时")
		return
	}
	if req.UploadSessionCleanupIntervalMins != nil &&
		(*req.UploadSessionCleanupIntervalMins < 1 || *req.UploadSessionCleanupIntervalMins > 1440) {
		writeError(w, http.StatusBadRequest, "bad_request", "清理周期范围应为 1~1440 分钟")
		return
	}
	if req.ThumbnailCacheMaxBytes != nil &&
		(*req.ThumbnailCacheMaxBytes < 64*1024*1024 || *req.ThumbnailCacheMaxBytes > 10*1024*1024*1024) {
		writeError(w, http.StatusBadRequest, "bad_request", "缩略图缓存上限范围应为 64MB~10GB")
		return
	}
	if req.ThumbnailCacheTTLHours != nil && (*req.ThumbnailCacheTTLHours < 1 || *req.ThumbnailCacheTTLHours > 24*365) {
		writeError(w, http.StatusBadRequest, "bad_request", "缩略图缓存 TTL 范围应为 1~8760 小时")
		return
	}
	if req.ThumbnailGenerateConcurrency != nil &&
		(*req.ThumbnailGenerateConcurrency < 1 || *req.ThumbnailGenerateConcurrency > 4) {
		writeError(w, http.StatusBadRequest, "bad_request", "缩略图生成并发范围应为 1~4")
		return
	}
	if req.VaultSessionTTLMins != nil &&
		(*req.VaultSessionTTLMins < 1 || *req.VaultSessionTTLMins > 1440) {
		writeError(w, http.StatusBadRequest, "bad_request", "密码箱密码有效期范围应为 1~1440 分钟")
		return
	}

	current, err := s.getRuntimeSettings(r.Context())
	if err != nil {
		s.logger.Error("get runtime settings failed before patch", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "读取当前设置失败")
		return
	}

	nextDeleteMode, err := normalizeTorrentSourceDeleteMode(current.TorrentSourceDeleteMode)
	if err != nil {
		nextDeleteMode = torrentSourceDeleteModeImmediate
	}
	if req.TorrentSourceDeleteMode != nil {
		nextDeleteMode, err = normalizeTorrentSourceDeleteMode(*req.TorrentSourceDeleteMode)
		if err != nil {
			writeError(w, http.StatusBadRequest, "bad_request", err.Error())
			return
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
		writeError(w, http.StatusBadRequest, "bad_request", err.Error())
		return
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
			writeError(w, http.StatusBadRequest, "bad_request", "密码箱密码不能为空")
			return
		}

		adminPassword := ""
		if req.AdminPassword != nil {
			adminPassword = strings.TrimSpace(*req.AdminPassword)
		}
		requiresAdminPassword := !s.cfg.AllowDevNoAuth || strings.TrimSpace(s.adminPasswordHash) != ""
		if requiresAdminPassword {
			if adminPassword == "" || !s.verifyAdminPassword(adminPassword) {
				writeError(w, http.StatusUnauthorized, "unauthorized", "管理员访问密码校验失败")
				return
			}
		}

		hashed, err := bcrypt.GenerateFromPassword([]byte(nextVaultPassword), bcrypt.DefaultCost)
		if err != nil {
			s.logger.Error("hash vault password failed", "error", err.Error())
			writeError(w, http.StatusInternalServerError, "internal_error", "密码箱密码加密失败")
			return
		}
		hashString := string(hashed)
		vaultPasswordHash = &hashString
	}

	next, err := store.New(s.db).UpdateRuntimeSettings(r.Context(), store.RuntimeSettingsPatch{
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
		writeError(w, http.StatusInternalServerError, "internal_error", "保存设置失败")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"settings": toSettingsDTO(next, s.cfg.ChunkSizeBytes),
	})
}

func toSettingsDTO(s store.RuntimeSettings, chunkSizeBytes int64) settingsDTO {
	deleteMode := strings.TrimSpace(s.TorrentSourceDeleteMode)
	if _, err := normalizeTorrentSourceDeleteMode(deleteMode); err != nil {
		deleteMode = torrentSourceDeleteModeImmediate
	}

	return settingsDTO{
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
