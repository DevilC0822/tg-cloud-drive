package api

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/const/tg-cloud-drive/backend/internal/share"
	"github.com/const/tg-cloud-drive/backend/internal/store"
	"github.com/const/tg-cloud-drive/backend/internal/telegram"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgconn"
)

func (s *Server) handleListItems(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()

	view := store.View(q.Get("view"))
	if view == "" {
		view = store.ViewFiles
	}

	if view == store.ViewVault {
		if !s.requireVaultUnlocked(w, r) {
			return
		}
	}

	var parentID *uuid.UUID
	if raw := strings.TrimSpace(q.Get("parentId")); raw != "" {
		parsed, err := uuid.Parse(raw)
		if err != nil {
			writeError(w, http.StatusBadRequest, "bad_request", "parentId 非法")
			return
		}
		parentID = &parsed
	}

	sortBy := store.SortBy(q.Get("sortBy"))
	if sortBy == "" {
		sortBy = store.SortByName
	}
	sortOrder := store.SortOrder(q.Get("sortOrder"))
	if sortOrder == "" {
		sortOrder = store.SortOrderAsc
	}

	page := intFromQuery(q.Get("page"), 1)
	pageSize := intFromQuery(q.Get("pageSize"), 50)

	st := store.New(s.db)
	items, total, err := st.ListItems(r.Context(), store.ListParams{
		View:      view,
		ParentID:  parentID,
		Search:    strings.TrimSpace(q.Get("search")),
		SortBy:    sortBy,
		SortOrder: sortOrder,
		Page:      page,
		PageSize:  pageSize,
	})
	if err != nil {
		if errors.Is(err, store.ErrBadInput) {
			writeError(w, http.StatusBadRequest, "bad_request", "参数非法")
			return
		}
		s.logger.Error("list items failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "查询失败")
		return
	}

	dtos := make([]ItemDTO, 0, len(items))
	for _, it := range items {
		dtos = append(dtos, toItemDTO(it))
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

func (s *Server) handleListFolders(w http.ResponseWriter, r *http.Request) {
	st := store.New(s.db)
	folders, err := st.ListFolders(r.Context())
	if err != nil {
		s.logger.Error("list folders failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "查询失败")
		return
	}

	dtos := make([]ItemDTO, 0, len(folders))
	for _, it := range folders {
		dtos = append(dtos, toItemDTO(it))
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": dtos})
}

func (s *Server) handleCreateFolder(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ParentID *string `json:"parentId"`
		Name     string  `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "请求体不是合法 JSON")
		return
	}
	var parentUUID *uuid.UUID
	if req.ParentID != nil && strings.TrimSpace(*req.ParentID) != "" {
		parsed, err := uuid.Parse(strings.TrimSpace(*req.ParentID))
		if err != nil {
			writeError(w, http.StatusBadRequest, "bad_request", "parentId 非法")
			return
		}
		parentUUID = &parsed
	}

	now := time.Now()
	st := store.New(s.db)
	folder, err := st.CreateFolder(r.Context(), parentUUID, req.Name, now)
	if err != nil {
		if errors.Is(err, store.ErrBadInput) {
			writeError(w, http.StatusBadRequest, "bad_request", "参数非法（请确认父目录存在且名称非空）")
			return
		}
		if errors.Is(err, store.ErrConflict) {
			writeError(w, http.StatusConflict, "conflict", "同一目录下已存在同名文件或文件夹")
			return
		}
		s.logger.Error("create folder failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "创建失败")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"item": toItemDTO(folder)})
}

func (s *Server) handlePatchItem(w http.ResponseWriter, r *http.Request) {
	id, err := parseUUIDParam(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "id 非法")
		return
	}

	var req struct {
		Name      *string          `json:"name"`
		ParentRaw *json.RawMessage `json:"parentId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "请求体不是合法 JSON")
		return
	}

	now := time.Now()
	st := store.New(s.db)
	var updated store.Item

	// 先处理移动/重命名（涉及路径与后代更新）
	needMoveRename := req.Name != nil || req.ParentRaw != nil
	if needMoveRename {
		input := store.PatchItemInput{Name: req.Name}
		if req.ParentRaw != nil {
			raw := bytes.TrimSpace(*req.ParentRaw)
			if bytes.Equal(raw, []byte("null")) {
				var root *uuid.UUID = nil
				input.ParentID = &root
			} else {
				var sID string
				if err := json.Unmarshal(raw, &sID); err != nil {
					writeError(w, http.StatusBadRequest, "bad_request", "parentId 非法")
					return
				}
				parsed, err := uuid.Parse(strings.TrimSpace(sID))
				if err != nil {
					writeError(w, http.StatusBadRequest, "bad_request", "parentId 非法")
					return
				}
				p := &parsed
				input.ParentID = &p
			}
		}

		updated, err = st.PatchItemMoveRename(r.Context(), id, input, now)
		if err != nil {
			switch {
			case errors.Is(err, store.ErrNotFound):
				writeError(w, http.StatusNotFound, "not_found", "文件不存在")
				return
			case errors.Is(err, store.ErrBadInput):
				writeError(w, http.StatusBadRequest, "bad_request", "参数非法（请确认目标目录存在且可用）")
				return
			case errors.Is(err, store.ErrForbidden):
				writeError(w, http.StatusBadRequest, "bad_request", "不能移动到自身或子目录中")
				return
			case errors.Is(err, store.ErrConflict):
				writeError(w, http.StatusConflict, "conflict", "同一目录下已存在同名文件或文件夹")
				return
			default:
				s.logger.Error("patch item(move/rename) failed", "error", err.Error())
				writeError(w, http.StatusInternalServerError, "internal_error", "更新失败")
				return
			}
		}
	} else {
		updated, err = st.GetItem(r.Context(), id)
		if err != nil {
			if errors.Is(err, store.ErrNotFound) {
				writeError(w, http.StatusNotFound, "not_found", "文件不存在")
				return
			}
			s.logger.Error("get item failed", "error", err.Error())
			writeError(w, http.StatusInternalServerError, "internal_error", "查询失败")
			return
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{"item": toItemDTO(updated)})
}

func (s *Server) handleShareItem(w http.ResponseWriter, r *http.Request) {
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
		writeError(w, http.StatusInternalServerError, "internal_error", "查询失败")
		return
	}
	if it.Type == store.ItemTypeFolder {
		writeError(w, http.StatusBadRequest, "bad_request", "文件夹暂不支持分享")
		return
	}
	if it.InVault {
		writeError(w, http.StatusBadRequest, "bad_request", "密码箱文件不支持分享")
		return
	}

	now := time.Now()
	code, err := share.GenerateCode(8)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "生成分享码失败")
		return
	}

	// 唯一约束冲突重试
	for i := 0; i < 5; i++ {
		if err := st.SetShare(r.Context(), id, code, now); err != nil {
			// 23505 unique_violation
			var pgerr *pgconn.PgError
			if errors.As(err, &pgerr) && pgerr.Code == "23505" {
				code, _ = share.GenerateCode(8)
				continue
			}
			if errors.Is(err, store.ErrNotFound) {
				writeError(w, http.StatusNotFound, "not_found", "文件不存在")
				return
			}
			s.logger.Error("set share failed", "error", err.Error())
			writeError(w, http.StatusInternalServerError, "internal_error", "分享失败")
			return
		}
		break
	}

	base := publicBaseURL(r, s.cfg.BaseURL, s.cfg.PublicURLHeader)
	shareURL := strings.TrimRight(base, "/") + "/d/" + code
	writeJSON(w, http.StatusOK, map[string]any{
		"shareCode": code,
		"shareUrl":  shareURL,
	})
}

func (s *Server) handleUnshareItem(w http.ResponseWriter, r *http.Request) {
	id, err := parseUUIDParam(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "id 非法")
		return
	}
	now := time.Now()
	st := store.New(s.db)
	if err := st.UnsetShare(r.Context(), id, now); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "文件不存在")
			return
		}
		s.logger.Error("unset share failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "取消分享失败")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handleSetItemVault(w http.ResponseWriter, r *http.Request) {
	if !s.requireVaultUnlocked(w, r) {
		return
	}

	id, err := parseUUIDParam(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "id 非法")
		return
	}

	var req struct {
		Enabled *bool `json:"enabled"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "请求体不是合法 JSON")
		return
	}
	if req.Enabled == nil {
		writeError(w, http.StatusBadRequest, "bad_request", "缺少 enabled 字段")
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
	if it.Type == store.ItemTypeFolder {
		writeError(w, http.StatusBadRequest, "bad_request", "目录暂不支持移入密码箱")
		return
	}

	targetEnabled := *req.Enabled
	if it.InVault == targetEnabled {
		writeJSON(w, http.StatusOK, map[string]any{
			"item":            toItemDTO(it),
			"spoilerApplied":  false,
			"spoilerEligible": isVaultSpoilerTypeSupported(it),
		})
		return
	}

	spoilerApplied, spoilerEligible, spoilerErr := s.syncVaultSpoilerForItem(r.Context(), st, it, targetEnabled)
	if spoilerErr != nil {
		s.logger.Error("sync vault spoiler failed", "error", spoilerErr.Error(), "item_id", it.ID.String())
		writeError(w, http.StatusBadGateway, "bad_gateway", spoilerErr.Error())
		return
	}

	updated, err := st.UpdateItemVault(r.Context(), it.ID, targetEnabled, time.Now())
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "文件不存在")
			return
		}
		s.logger.Error("update item vault failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "更新失败")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"item":            toItemDTO(updated),
		"spoilerApplied":  spoilerApplied,
		"spoilerEligible": spoilerEligible,
	})
}

type vaultSpoilerMode string

const (
	vaultSpoilerModeNone      vaultSpoilerMode = "none"
	vaultSpoilerModePhoto     vaultSpoilerMode = "photo"
	vaultSpoilerModeVideo     vaultSpoilerMode = "video"
	vaultSpoilerModeAnimation vaultSpoilerMode = "animation"
)

func detectVaultSpoilerMode(it store.Item) vaultSpoilerMode {
	mime := ""
	if it.MimeType != nil {
		mime = strings.ToLower(strings.TrimSpace(*it.MimeType))
	}
	ext := strings.ToLower(strings.TrimSpace(filepath.Ext(it.Name)))

	if it.Type == store.ItemTypeVideo {
		return vaultSpoilerModeVideo
	}
	if it.Type != store.ItemTypeImage {
		return vaultSpoilerModeNone
	}

	if mime == "image/gif" || mime == "image/webp" || ext == ".gif" || ext == ".webp" {
		return vaultSpoilerModeAnimation
	}
	if mime == "image/svg+xml" || ext == ".svg" {
		return vaultSpoilerModeNone
	}

	// 常规图片继续走 sendPhoto 的原生 spoiler。
	if mime != "" {
		if strings.HasPrefix(mime, "image/") {
			return vaultSpoilerModePhoto
		}
		return vaultSpoilerModeNone
	}
	if ext == ".jpg" || ext == ".jpeg" || ext == ".png" || ext == ".bmp" {
		return vaultSpoilerModePhoto
	}
	return vaultSpoilerModeNone
}

func isVaultSpoilerTypeSupported(it store.Item) bool {
	return detectVaultSpoilerMode(it) != vaultSpoilerModeNone
}

func (s *Server) syncVaultSpoilerForItem(ctx context.Context, st *store.Store, it store.Item, enabled bool) (bool, bool, error) {
	mode := detectVaultSpoilerMode(it)
	if mode == vaultSpoilerModeNone {
		return false, false, nil
	}

	chunks, err := st.ListChunks(ctx, it.ID)
	if err != nil {
		return false, true, fmt.Errorf("查询文件分片失败")
	}
	if len(chunks) != 1 {
		return false, true, nil
	}

	chunk := chunks[0]
	chatID := strings.TrimSpace(chunk.TGChatID)
	if chatID == "" {
		chatID = strings.TrimSpace(s.cfg.TGStorageChatID)
	}
	if chatID == "" {
		return false, true, fmt.Errorf("频道配置缺失")
	}

	caption := fmt.Sprintf("tgcd:%s", it.ID.String())
	fileID := strings.TrimSpace(chunk.TGFileID)
	if fileID == "" {
		var idErr error
		fileID, idErr = s.ensureChunkFileID(ctx, chunk)
		if idErr != nil {
			return false, true, fmt.Errorf("获取文件标识失败")
		}
	}

	var msg telegram.Message
	switch mode {
	case vaultSpoilerModeVideo:
		msg, err = s.sendVideoByFileIDWithRetry(ctx, chatID, fileID, caption, enabled)
	case vaultSpoilerModeAnimation:
		msg, err = s.sendAnimationByFileIDWithRetry(ctx, chatID, fileID, caption, enabled)
	default:
		msg, err = s.sendPhotoByFileIDWithRetry(ctx, chatID, fileID, caption, enabled)
	}
	if err != nil {
		return false, true, fmt.Errorf("更新 Telegram 模糊状态失败")
	}

	doc, docErr := s.resolveMessageDocument(ctx, msg)
	if docErr != nil {
		if msg.MessageID > 0 {
			_ = s.deleteMessageWithRetry(ctx, chatID, msg.MessageID)
		}
		return false, true, fmt.Errorf("更新 Telegram 模糊状态失败（缺少文件标识）")
	}

	newChunkSize := chunk.ChunkSize
	if doc.FileSize > 0 && doc.FileSize < int64(^uint(0)>>1) {
		newChunkSize = int(doc.FileSize)
	}

	if err := st.UpdateChunkTelegramRef(ctx, chunk.ID, msg.MessageID, doc.FileID, doc.FileUniqueID, newChunkSize); err != nil {
		if msg.MessageID > 0 {
			_ = s.deleteMessageWithRetry(ctx, chatID, msg.MessageID)
		}
		return false, true, fmt.Errorf("写入分片元数据失败")
	}

	if err := s.deleteMessageWithRetry(ctx, chatID, chunk.TGMessageID); err != nil {
		_ = st.UpdateChunkTelegramRef(ctx, chunk.ID, chunk.TGMessageID, chunk.TGFileID, chunk.TGFileUniqueID, chunk.ChunkSize)
		if msg.MessageID > 0 {
			_ = s.deleteMessageWithRetry(ctx, chatID, msg.MessageID)
		}
		return false, true, fmt.Errorf("清理原始 Telegram 消息失败")
	}

	return true, true, nil
}

func intFromQuery(raw string, def int) int {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return def
	}
	v, err := strconv.Atoi(raw)
	if err != nil {
		return def
	}
	return v
}

func parseUUIDParam(raw string) (uuid.UUID, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return uuid.UUID{}, errBadID
	}
	return uuid.Parse(raw)
}

func publicBaseURL(r *http.Request, configured string, header string) string {
	if strings.TrimSpace(configured) != "" {
		return strings.TrimSpace(configured)
	}
	if header != "" {
		if v := strings.TrimSpace(r.Header.Get(header)); v != "" {
			return v
		}
	}

	proto := firstForwardedHeaderValue(r.Header.Get("X-Forwarded-Proto"))
	if proto == "" {
		if r.TLS != nil {
			proto = "https"
		} else {
			proto = "http"
		}
	}
	host := firstForwardedHeaderValue(r.Header.Get("X-Forwarded-Host"))
	if host == "" {
		host = strings.TrimSpace(r.Host)
	}
	port := firstForwardedHeaderValue(r.Header.Get("X-Forwarded-Port"))
	if port != "" && !hostHasPort(host) {
		if !(proto == "http" && port == "80") && !(proto == "https" && port == "443") {
			host = host + ":" + port
		}
	}
	if host == "" {
		host = "localhost"
	}
	return proto + "://" + host
}

func firstForwardedHeaderValue(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	if strings.Contains(raw, ",") {
		raw = strings.TrimSpace(strings.Split(raw, ",")[0])
	}
	return raw
}

func hostHasPort(host string) bool {
	host = strings.TrimSpace(host)
	if host == "" {
		return false
	}
	if strings.HasPrefix(host, "[") {
		return strings.Contains(host, "]:")
	}
	if strings.Count(host, ":") == 1 {
		return true
	}
	return false
}
