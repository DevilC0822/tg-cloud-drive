package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/const/tg-cloud-drive/backend/internal/store"
	itorrent "github.com/const/tg-cloud-drive/backend/internal/torrent"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type torrentTaskDTO struct {
	ID              string               `json:"id"`
	SourceType      string               `json:"sourceType"`
	SourceURL       *string              `json:"sourceUrl"`
	TorrentName     string               `json:"torrentName"`
	InfoHash        string               `json:"infoHash"`
	TargetChatID    string               `json:"targetChatId"`
	TargetParentID  *string              `json:"targetParentId"`
	SubmittedBy     string               `json:"submittedBy"`
	EstimatedSize   int64                `json:"estimatedSize"`
	DownloadedBytes int64                `json:"downloadedBytes"`
	Progress        float64              `json:"progress"`
	IsPrivate       bool                 `json:"isPrivate"`
	TrackerHosts    []string             `json:"trackerHosts"`
	Status          string               `json:"status"`
	Error           *string              `json:"error"`
	StartedAt       *time.Time           `json:"startedAt"`
	FinishedAt      *time.Time           `json:"finishedAt"`
	DueAt           *time.Time           `json:"dueAt"`
	CreatedAt       time.Time            `json:"createdAt"`
	UpdatedAt       time.Time            `json:"updatedAt"`
	Files           []torrentTaskFileDTO `json:"files,omitempty"`
}

type torrentTaskFileDTO struct {
	FileIndex      int     `json:"fileIndex"`
	FilePath       string  `json:"filePath"`
	FileName       string  `json:"fileName"`
	FileSize       int64   `json:"fileSize"`
	Selected       bool    `json:"selected"`
	Uploaded       bool    `json:"uploaded"`
	UploadedItemID *string `json:"uploadedItemId"`
	Error          *string `json:"error"`
}

type createTorrentTaskPayload struct {
	ParentID     *uuid.UUID
	TorrentURL   string
	TorrentName  string
	TorrentBytes []byte
	SourceType   store.TorrentSourceType
	SourceURL    *string
	SubmittedBy  string
}

func toTorrentTaskDTO(task store.TorrentTask, files []store.TorrentTaskFile) torrentTaskDTO {
	var parentID *string
	if task.TargetParentID != nil {
		v := task.TargetParentID.String()
		parentID = &v
	}

	dto := torrentTaskDTO{
		ID:              task.ID.String(),
		SourceType:      string(task.SourceType),
		SourceURL:       task.SourceURL,
		TorrentName:     task.TorrentName,
		InfoHash:        task.InfoHash,
		TargetChatID:    task.TargetChatID,
		TargetParentID:  parentID,
		SubmittedBy:     task.SubmittedBy,
		EstimatedSize:   task.EstimatedSize,
		DownloadedBytes: task.DownloadedBytes,
		Progress:        task.Progress,
		IsPrivate:       task.IsPrivate,
		TrackerHosts:    task.TrackerHosts,
		Status:          string(task.Status),
		Error:           task.Error,
		StartedAt:       task.StartedAt,
		FinishedAt:      task.FinishedAt,
		DueAt:           task.SourceCleanupDueAt,
		CreatedAt:       task.CreatedAt,
		UpdatedAt:       task.UpdatedAt,
	}
	if len(files) > 0 {
		dto.Files = make([]torrentTaskFileDTO, 0, len(files))
		for _, file := range files {
			var itemID *string
			if file.UploadedItemID != nil {
				v := file.UploadedItemID.String()
				itemID = &v
			}
			dto.Files = append(dto.Files, torrentTaskFileDTO{
				FileIndex:      file.FileIndex,
				FilePath:       file.FilePath,
				FileName:       file.FileName,
				FileSize:       file.FileSize,
				Selected:       file.Selected,
				Uploaded:       file.Uploaded,
				UploadedItemID: itemID,
				Error:          file.Error,
			})
		}
	}
	return dto
}

func (s *Server) handleCreateTorrentTask(w http.ResponseWriter, r *http.Request) {
	if !s.cfg.TorrentEnabled {
		writeError(w, http.StatusServiceUnavailable, "service_unavailable", "当前实例未启用 Torrent 功能")
		return
	}
	if strings.TrimSpace(s.cfg.TGStorageChatID) == "" {
		writeError(w, http.StatusServiceUnavailable, "service_unavailable", "存储频道配置缺失")
		return
	}

	payload, err := s.parseCreateTorrentTaskPayload(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", err.Error())
		return
	}

	meta, err := itorrent.ParseMetaInfo(payload.TorrentBytes)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "torrent 文件解析失败："+err.Error())
		return
	}
	if s.cfg.TorrentRequirePrivate && !meta.IsPrivate {
		writeError(w, http.StatusBadRequest, "bad_request", "当前实例仅允许 private torrent")
		return
	}
	if err := itorrent.ValidateAnnounceHosts(meta.AnnounceHosts, s.cfg.TorrentAllowedAnnounceDomains); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", err.Error())
		return
	}

	if payload.ParentID != nil {
		if _, err := store.New(s.db).GetItem(r.Context(), *payload.ParentID); err != nil {
			if errors.Is(err, store.ErrNotFound) {
				writeError(w, http.StatusBadRequest, "bad_request", "目标目录不存在")
				return
			}
			s.logger.Error("get parent item failed", "error", err.Error())
			writeError(w, http.StatusInternalServerError, "internal_error", "读取目标目录失败")
			return
		}
	}

	now := time.Now()
	taskID := uuid.New()
	if err := os.MkdirAll(s.cfg.TorrentWorkDir, 0o755); err != nil {
		s.logger.Error("create torrent work dir failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "创建 Torrent 工作目录失败")
		return
	}
	torrentPath := filepath.Join(s.cfg.TorrentWorkDir, taskID.String()+".torrent")
	if err := os.WriteFile(torrentPath, payload.TorrentBytes, 0o640); err != nil {
		s.logger.Error("write torrent file failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "写入 Torrent 文件失败")
		return
	}

	created, err := store.New(s.db).CreateTorrentTask(r.Context(), store.TorrentTask{
		ID:              taskID,
		SourceType:      payload.SourceType,
		SourceURL:       payload.SourceURL,
		TorrentName:     meta.Name,
		InfoHash:        meta.InfoHash,
		TorrentFilePath: torrentPath,
		QBTorrentHash:   nil,
		TargetChatID:    strings.TrimSpace(s.cfg.TGStorageChatID),
		TargetParentID:  payload.ParentID,
		SubmittedBy:     payload.SubmittedBy,
		EstimatedSize:   meta.TotalSize,
		DownloadedBytes: 0,
		Progress:        0,
		IsPrivate:       meta.IsPrivate,
		TrackerHosts:    meta.AnnounceHosts,
		Status:          store.TorrentTaskStatusQueued,
		Error:           nil,
		StartedAt:       nil,
		FinishedAt:      nil,
		CreatedAt:       now,
		UpdatedAt:       now,
	})
	if err != nil {
		_ = os.Remove(torrentPath)
		s.logger.Error("create torrent task failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "创建 Torrent 任务失败")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"task": toTorrentTaskDTO(created, nil),
	})
}

func (s *Server) handleListTorrentTasks(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	page := intFromQuery(query.Get("page"), 1)
	pageSize := intFromQuery(query.Get("pageSize"), 20)
	if page < 1 {
		writeError(w, http.StatusBadRequest, "bad_request", "page 范围应为 >= 1")
		return
	}
	if pageSize < 1 || pageSize > 200 {
		writeError(w, http.StatusBadRequest, "bad_request", "pageSize 范围应为 1~200")
		return
	}

	var status *store.TorrentTaskStatus
	if rawStatus := strings.TrimSpace(query.Get("status")); rawStatus != "" && strings.ToLower(rawStatus) != "all" {
		parsed := store.TorrentTaskStatus(strings.ToLower(rawStatus))
		status = &parsed
	}

	items, total, err := store.New(s.db).ListTorrentTasks(r.Context(), status, page, pageSize)
	if err != nil {
		if errors.Is(err, store.ErrBadInput) {
			writeError(w, http.StatusBadRequest, "bad_request", "status 非法")
			return
		}
		s.logger.Error("list torrent tasks failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "读取 Torrent 任务失败")
		return
	}
	dtos := make([]torrentTaskDTO, 0, len(items))
	for _, item := range items {
		dtos = append(dtos, toTorrentTaskDTO(item, nil))
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

func (s *Server) handleGetTorrentTask(w http.ResponseWriter, r *http.Request) {
	taskID, err := parseUUIDParam(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "id 非法")
		return
	}

	st := store.New(s.db)
	task, err := st.GetTorrentTask(r.Context(), taskID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "Torrent 任务不存在")
			return
		}
		s.logger.Error("get torrent task failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "读取 Torrent 任务失败")
		return
	}
	files, err := st.ListTorrentTaskFiles(r.Context(), taskID)
	if err != nil {
		s.logger.Error("list torrent task files failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "读取 Torrent 文件列表失败")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"task": toTorrentTaskDTO(task, files),
	})
}

func (s *Server) handleDeleteTorrentTask(w http.ResponseWriter, r *http.Request) {
	taskID, err := parseUUIDParam(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "id 非法")
		return
	}

	st := store.New(s.db)
	task, err := st.GetTorrentTask(r.Context(), taskID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "Torrent 任务不存在")
			return
		}
		s.logger.Error("get torrent task failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "读取 Torrent 任务失败")
		return
	}
	files, err := st.ListTorrentTaskFiles(r.Context(), taskID)
	if err != nil {
		s.logger.Error("list torrent task files failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "读取任务文件列表失败")
		return
	}

	cleanupWarnings := s.cleanupTorrentTaskResources(r.Context(), task, files)

	if err := st.DeleteTorrentTask(r.Context(), taskID); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "Torrent 任务不存在")
			return
		}
		s.logger.Error("delete torrent task failed", "error", err.Error(), "task_id", taskID.String())
		writeError(w, http.StatusInternalServerError, "internal_error", "删除 Torrent 任务失败")
		return
	}

	resp := map[string]any{
		"deleted": true,
		"taskId":  taskID.String(),
	}
	if len(cleanupWarnings) > 0 {
		resp["cleanupWarnings"] = cleanupWarnings
	}
	writeJSON(w, http.StatusOK, resp)
}

func (s *Server) cleanupTorrentTaskResources(
	ctx context.Context,
	task store.TorrentTask,
	files []store.TorrentTaskFile,
) []string {
	warnings := make([]string, 0, 4)

	hash := ""
	if task.QBTorrentHash != nil {
		hash = strings.TrimSpace(*task.QBTorrentHash)
	}
	if hash == "" {
		hash = strings.TrimSpace(task.InfoHash)
	}
	if hash != "" {
		qbt, err := s.newQBittorrentClient(ctx)
		if err != nil {
			warnings = append(warnings, "创建 qBittorrent 客户端失败："+err.Error())
		} else if err := qbt.Authenticate(ctx); err != nil {
			warnings = append(warnings, "qBittorrent 认证失败："+err.Error())
		} else if err := qbt.DeleteTorrent(ctx, hash, true); err != nil {
			warnings = append(warnings, "删除 qBittorrent 任务失败："+err.Error())
		}
	}

	warnings = append(warnings, s.cleanupTorrentTaskDownloadedFiles(files)...)

	if torrentPath := strings.TrimSpace(task.TorrentFilePath); torrentPath != "" {
		if err := os.Remove(torrentPath); err != nil && !errors.Is(err, os.ErrNotExist) {
			warnings = append(warnings, "删除 torrent 元文件失败："+err.Error())
		}
	}
	return warnings
}

func (s *Server) cleanupTorrentTaskDownloadedFiles(files []store.TorrentTaskFile) []string {
	if len(files) == 0 {
		return nil
	}

	downloadRoot := strings.TrimSpace(s.cfg.TorrentDownloadDir)
	seen := make(map[string]struct{}, len(files))
	warnings := make([]string, 0)

	for _, file := range files {
		filePath := filepath.Clean(strings.TrimSpace(file.FilePath))
		if filePath == "" || filePath == "." {
			continue
		}
		if _, ok := seen[filePath]; ok {
			continue
		}
		seen[filePath] = struct{}{}

		if downloadRoot != "" && !pathInsideBaseDir(filePath, downloadRoot) {
			warnings = append(warnings, "任务文件不在下载目录内，已跳过："+filePath)
			continue
		}

		info, err := os.Stat(filePath)
		if err != nil {
			if !errors.Is(err, os.ErrNotExist) {
				warnings = append(warnings, fmt.Sprintf("读取任务文件失败：%s（%v）", filePath, err))
			}
			continue
		}

		if info.IsDir() {
			if err := os.RemoveAll(filePath); err != nil {
				warnings = append(warnings, fmt.Sprintf("删除任务目录失败：%s（%v）", filePath, err))
			}
			continue
		}

		if err := os.Remove(filePath); err != nil && !errors.Is(err, os.ErrNotExist) {
			warnings = append(warnings, fmt.Sprintf("删除任务文件失败：%s（%v）", filePath, err))
		}
	}

	return warnings
}

func pathInsideBaseDir(path string, baseDir string) bool {
	cleanPath := filepath.Clean(strings.TrimSpace(path))
	cleanBase := filepath.Clean(strings.TrimSpace(baseDir))
	if cleanPath == "" || cleanPath == "." || cleanBase == "" || cleanBase == "." {
		return false
	}
	if cleanPath == cleanBase {
		return true
	}
	rel, err := filepath.Rel(cleanBase, cleanPath)
	if err != nil {
		return false
	}
	if rel == "." {
		return true
	}
	return rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator))
}

func (s *Server) handleDispatchTorrentTask(w http.ResponseWriter, r *http.Request) {
	taskID, err := parseUUIDParam(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "id 非法")
		return
	}

	var req struct {
		FileIndexes []int `json:"fileIndexes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "请求体不是合法 JSON")
		return
	}
	if len(req.FileIndexes) == 0 {
		writeError(w, http.StatusBadRequest, "bad_request", "fileIndexes 不能为空")
		return
	}

	st := store.New(s.db)
	task, err := st.GetTorrentTask(r.Context(), taskID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "Torrent 任务不存在")
			return
		}
		s.logger.Error("get torrent task failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "读取 Torrent 任务失败")
		return
	}
	if task.Status != store.TorrentTaskStatusAwaitingSelection {
		writeError(w, http.StatusConflict, "conflict", "当前任务状态不允许重新选择文件")
		return
	}

	now := time.Now()
	if err := st.SetTorrentTaskFileSelection(r.Context(), taskID, req.FileIndexes, now); err != nil {
		switch {
		case errors.Is(err, store.ErrNotFound):
			writeError(w, http.StatusNotFound, "not_found", "任务文件不存在")
		case errors.Is(err, store.ErrBadInput):
			writeError(w, http.StatusBadRequest, "bad_request", "fileIndexes 非法")
		default:
			s.logger.Error("set torrent task file selection failed", "error", err.Error())
			writeError(w, http.StatusInternalServerError, "internal_error", "保存文件选择失败")
		}
		return
	}
	if err := st.SetTorrentTaskStatus(r.Context(), taskID, store.TorrentTaskStatusUploading, nil, now); err != nil {
		s.logger.Error("set torrent task status failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "更新任务状态失败")
		return
	}

	updated, err := st.GetTorrentTask(r.Context(), taskID)
	if err != nil {
		s.logger.Error("get updated torrent task failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "读取任务失败")
		return
	}
	files, err := st.ListTorrentTaskFiles(r.Context(), taskID)
	if err != nil {
		s.logger.Error("list torrent task files failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "读取文件列表失败")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"task": toTorrentTaskDTO(updated, files),
	})
}

func (s *Server) handleRetryTorrentTask(w http.ResponseWriter, r *http.Request) {
	taskID, err := parseUUIDParam(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "id 非法")
		return
	}

	st := store.New(s.db)
	task, err := st.GetTorrentTask(r.Context(), taskID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "Torrent 任务不存在")
			return
		}
		s.logger.Error("get torrent task failed", "error", err.Error(), "task_id", taskID.String())
		writeError(w, http.StatusInternalServerError, "internal_error", "读取 Torrent 任务失败")
		return
	}
	if task.Status != store.TorrentTaskStatusError {
		writeError(w, http.StatusConflict, "conflict", "仅失败状态的任务允许重新下载")
		return
	}

	torrentPath := strings.TrimSpace(task.TorrentFilePath)
	if torrentPath == "" {
		writeError(w, http.StatusBadRequest, "bad_request", "任务缺少 torrent 元文件路径，无法重试")
		return
	}
	if stat, statErr := os.Stat(torrentPath); statErr != nil || stat.IsDir() {
		writeError(w, http.StatusBadRequest, "bad_request", "任务的 torrent 元文件缺失或不可用，无法重试")
		return
	}

	cleanupWarnings := s.cleanupTorrentTaskRetryResources(r.Context(), st, task)
	if err := st.ResetTorrentTaskForRetry(r.Context(), taskID, time.Now()); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "Torrent 任务不存在")
			return
		}
		s.logger.Error("reset torrent task for retry failed", "error", err.Error(), "task_id", taskID.String())
		writeError(w, http.StatusInternalServerError, "internal_error", "重置 Torrent 任务失败")
		return
	}

	updated, err := st.GetTorrentTask(r.Context(), taskID)
	if err != nil {
		s.logger.Error("load retried torrent task failed", "error", err.Error(), "task_id", taskID.String())
		writeError(w, http.StatusInternalServerError, "internal_error", "读取重试任务失败")
		return
	}

	resp := map[string]any{
		"task": toTorrentTaskDTO(updated, nil),
	}
	if len(cleanupWarnings) > 0 {
		resp["cleanupWarnings"] = cleanupWarnings
	}
	writeJSON(w, http.StatusOK, resp)
}

func (s *Server) parseCreateTorrentTaskPayload(r *http.Request) (createTorrentTaskPayload, error) {
	contentType := strings.ToLower(strings.TrimSpace(r.Header.Get("Content-Type")))
	if strings.HasPrefix(contentType, "multipart/form-data") {
		return s.parseCreateTorrentTaskPayloadMultipart(r)
	}
	return s.parseCreateTorrentTaskPayloadJSON(r)
}

func (s *Server) cleanupTorrentTaskRetryResources(
	ctx context.Context,
	st *store.Store,
	task store.TorrentTask,
) []string {
	warnings := make([]string, 0, 4)

	hash := ""
	if task.QBTorrentHash != nil {
		hash = strings.TrimSpace(*task.QBTorrentHash)
	}
	if hash == "" {
		hash = strings.TrimSpace(task.InfoHash)
	}
	if hash != "" {
		qbt, err := s.newQBittorrentClient(ctx)
		if err != nil {
			warnings = append(warnings, "创建 qBittorrent 客户端失败："+err.Error())
		} else if err := qbt.Authenticate(ctx); err != nil {
			warnings = append(warnings, "qBittorrent 认证失败："+err.Error())
		} else if err := qbt.DeleteTorrent(ctx, hash, true); err != nil {
			warnings = append(warnings, "删除 qBittorrent 旧任务失败："+err.Error())
		}
	}

	files, err := st.ListTorrentTaskFiles(ctx, task.ID)
	if err != nil {
		warnings = append(warnings, "读取任务文件列表失败："+err.Error())
		return warnings
	}
	warnings = append(warnings, s.cleanupTorrentTaskDownloadedFiles(files)...)
	return warnings
}

func (s *Server) parseCreateTorrentTaskPayloadJSON(r *http.Request) (createTorrentTaskPayload, error) {
	var req struct {
		ParentID    *string `json:"parentId"`
		TorrentURL  string  `json:"torrentUrl"`
		SubmittedBy string  `json:"submittedBy"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return createTorrentTaskPayload{}, errors.New("请求体不是合法 JSON")
	}
	parentID, err := parseOptionalParentID(req.ParentID)
	if err != nil {
		return createTorrentTaskPayload{}, err
	}
	rawURL := strings.TrimSpace(req.TorrentURL)
	if rawURL == "" {
		return createTorrentTaskPayload{}, errors.New("torrentUrl 不能为空")
	}
	torrentBytes, err := downloadTorrentFileByURL(r.Context(), rawURL, s.cfg.TorrentMaxMetadataBytes)
	if err != nil {
		return createTorrentTaskPayload{}, err
	}
	sourceURL := rawURL
	submittedBy := strings.TrimSpace(req.SubmittedBy)
	if submittedBy == "" {
		submittedBy = "admin"
	}
	return createTorrentTaskPayload{
		ParentID:     parentID,
		TorrentURL:   rawURL,
		TorrentBytes: torrentBytes,
		SourceType:   store.TorrentSourceTypeURL,
		SourceURL:    &sourceURL,
		SubmittedBy:  submittedBy,
	}, nil
}

func (s *Server) parseCreateTorrentTaskPayloadMultipart(r *http.Request) (createTorrentTaskPayload, error) {
	mr, err := r.MultipartReader()
	if err != nil {
		return createTorrentTaskPayload{}, errors.New("请求必须为 multipart/form-data")
	}

	var (
		parentRaw   *string
		torrentURL  string
		submittedBy string
		fileBytes   []byte
		fileName    string
	)

	for {
		part, nextErr := mr.NextPart()
		if nextErr == io.EOF {
			break
		}
		if nextErr != nil {
			return createTorrentTaskPayload{}, errors.New("解析 multipart 失败")
		}

		formName := strings.TrimSpace(part.FormName())
		switch formName {
		case "parentId":
			value, readErr := readSmallPartValue(part, 8<<10)
			_ = part.Close()
			if readErr != nil {
				return createTorrentTaskPayload{}, errors.New("读取 parentId 失败")
			}
			if strings.TrimSpace(value) != "" {
				parentRaw = &value
			}
		case "torrentUrl":
			value, readErr := readSmallPartValue(part, 16<<10)
			_ = part.Close()
			if readErr != nil {
				return createTorrentTaskPayload{}, errors.New("读取 torrentUrl 失败")
			}
			torrentURL = strings.TrimSpace(value)
		case "submittedBy":
			value, readErr := readSmallPartValue(part, 256)
			_ = part.Close()
			if readErr != nil {
				return createTorrentTaskPayload{}, errors.New("读取 submittedBy 失败")
			}
			submittedBy = strings.TrimSpace(value)
		case "torrentFile":
			name := strings.TrimSpace(part.FileName())
			data, readErr := readLimitedPartBytes(part, s.cfg.TorrentMaxMetadataBytes)
			_ = part.Close()
			if readErr != nil {
				return createTorrentTaskPayload{}, readErr
			}
			if len(data) > 0 {
				fileBytes = data
				fileName = name
			}
		default:
			_, _ = io.Copy(io.Discard, part)
			_ = part.Close()
		}
	}

	parentID, err := parseOptionalParentID(parentRaw)
	if err != nil {
		return createTorrentTaskPayload{}, err
	}
	if submittedBy == "" {
		submittedBy = "admin"
	}

	if len(fileBytes) > 0 {
		return createTorrentTaskPayload{
			ParentID:     parentID,
			TorrentName:  fileName,
			TorrentBytes: fileBytes,
			SourceType:   store.TorrentSourceTypeFile,
			SourceURL:    nil,
			SubmittedBy:  submittedBy,
		}, nil
	}
	if torrentURL == "" {
		return createTorrentTaskPayload{}, errors.New("请提供 torrentUrl 或 torrentFile")
	}
	torrentBytes, err := downloadTorrentFileByURL(r.Context(), torrentURL, s.cfg.TorrentMaxMetadataBytes)
	if err != nil {
		return createTorrentTaskPayload{}, err
	}
	sourceURL := torrentURL
	return createTorrentTaskPayload{
		ParentID:     parentID,
		TorrentURL:   torrentURL,
		TorrentBytes: torrentBytes,
		SourceType:   store.TorrentSourceTypeURL,
		SourceURL:    &sourceURL,
		SubmittedBy:  submittedBy,
	}, nil
}

func parseOptionalParentID(raw *string) (*uuid.UUID, error) {
	if raw == nil {
		return nil, nil
	}
	trimmed := strings.TrimSpace(*raw)
	if trimmed == "" || strings.EqualFold(trimmed, "null") {
		return nil, nil
	}
	parsed, err := uuid.Parse(trimmed)
	if err != nil {
		return nil, errors.New("parentId 非法")
	}
	return &parsed, nil
}

func readLimitedPartBytes(part *multipart.Part, maxBytes int64) ([]byte, error) {
	if maxBytes <= 0 {
		maxBytes = 1 << 20
	}
	limited := io.LimitReader(part, maxBytes+1)
	data, err := io.ReadAll(limited)
	if err != nil {
		return nil, errors.New("读取 torrent 文件失败")
	}
	if int64(len(data)) > maxBytes {
		return nil, fmt.Errorf("torrent 文件不能超过 %d 字节", maxBytes)
	}
	return data, nil
}

func downloadTorrentFileByURL(ctx context.Context, rawURL string, maxBytes int64) ([]byte, error) {
	parsed, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil {
		return nil, errors.New("torrentUrl 非法")
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return nil, errors.New("torrentUrl 仅支持 http/https")
	}
	if maxBytes <= 0 {
		maxBytes = 1 << 20
	}

	client := &http.Client{Timeout: 20 * time.Second}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, parsed.String(), nil)
	if err != nil {
		return nil, errors.New("创建 torrentUrl 请求失败")
	}
	req.Header.Set("User-Agent", "tg-cloud-drive/torrent-fetcher")

	resp, err := client.Do(req)
	if err != nil {
		return nil, errors.New("拉取 torrentUrl 失败")
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("拉取 torrentUrl 失败（HTTP %d）", resp.StatusCode)
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, maxBytes+1))
	if err != nil {
		return nil, errors.New("读取 torrentUrl 响应失败")
	}
	if int64(len(data)) > maxBytes {
		return nil, fmt.Errorf("torrent 文件不能超过 %d 字节", maxBytes)
	}
	if len(data) == 0 {
		return nil, errors.New("torrent 文件为空")
	}
	return data, nil
}
