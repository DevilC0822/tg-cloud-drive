package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"sort"
	"strings"
	"time"

	"tg-cloud-drive-api/internal/store"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

const (
	uploadFolderWorkPageDefault = 200
	uploadFolderWorkPageMax     = 500
)

type createUploadFolderRequest struct {
	ParentID    *string                          `json:"parentId"`
	RootName    string                           `json:"rootName"`
	Directories []createUploadFolderDirectoryDTO `json:"directories"`
	Files       []createUploadFolderFileDTO      `json:"files"`
}

type createUploadFolderDirectoryDTO struct {
	RelativePath string `json:"relativePath"`
}

type createUploadFolderFileDTO struct {
	RelativePath string  `json:"relativePath"`
	Size         int64   `json:"size"`
	MimeType     *string `json:"mimeType"`
}

type uploadFolderWorkItemDTO struct {
	RelativePath string `json:"relativePath"`
	SessionID    string `json:"sessionId"`
	ParentItemID string `json:"parentItemId"`
	FileName     string `json:"fileName"`
	ChunkSize    int    `json:"chunkSize"`
	TotalChunks  int    `json:"totalChunks"`
}

type uploadFolderWorkResponse struct {
	Items      []uploadFolderWorkItemDTO `json:"items"`
	NextCursor *string                   `json:"nextCursor,omitempty"`
}

type uploadFolderManifest struct {
	RootName    string
	Directories []uploadFolderDirectory
	Files       []uploadFolderFile
	TotalSize   int64
}

type uploadFolderDirectory struct {
	RelativePath       string
	ParentRelativePath *string
	Name               string
	Depth              int
}

type uploadFolderFile struct {
	RelativePath       string
	ParentRelativePath *string
	Name               string
	Depth              int
	Size               int64
	MimeType           *string
	ItemType           store.ItemType
}

type uploadFolderCreateResult struct {
	BatchID    uuid.UUID
	RootItemID uuid.UUID
	Job        store.TransferJob
}

func (s *Server) handleCreateUploadFolder(w http.ResponseWriter, r *http.Request) {
	var req createUploadFolderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "请求体不是合法 JSON")
		return
	}

	parentID, err := parseOptionalUUID(req.ParentID, nil)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "parentId 非法")
		return
	}
	manifest, err := buildUploadFolderManifest(req)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", err.Error())
		return
	}

	result, err := s.createUploadFolderBatch(r.Context(), parentID, manifest)
	if err != nil {
		switch {
		case errors.Is(err, store.ErrNotFound):
			writeError(w, http.StatusServiceUnavailable, "setup_required", "系统尚未初始化，请先完成初始化配置")
		case errors.Is(err, store.ErrBadInput):
			writeError(w, http.StatusBadRequest, "bad_request", "参数非法（请确认父目录存在且可用）")
		case errors.Is(err, store.ErrConflict):
			writeError(w, http.StatusConflict, "conflict", s.describeUploadFolderConflict(r.Context(), parentID, manifest))
		default:
			s.logger.Error("create upload folder batch failed", "error", err.Error())
			writeError(w, http.StatusInternalServerError, "internal_error", "创建目录上传任务失败")
		}
		return
	}

	jobDTO, buildErr := s.buildTransferJobViewDTO(r.Context(), result.Job)
	if buildErr != nil {
		jobDTO = toTransferJobViewDTO(result.Job)
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"batchId":    result.BatchID.String(),
		"rootItemId": result.RootItemID.String(),
		"job":        jobDTO,
	})
}

func (s *Server) handleGetUploadFolderWork(w http.ResponseWriter, r *http.Request) {
	batchID, err := parseUUIDParam(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "id 非法")
		return
	}

	limit := intFromQuery(r.URL.Query().Get("limit"), uploadFolderWorkPageDefault)
	if limit < 1 {
		writeError(w, http.StatusBadRequest, "bad_request", "limit 范围应为 >= 1")
		return
	}
	if limit > uploadFolderWorkPageMax {
		limit = uploadFolderWorkPageMax
	}
	cursor := strings.TrimSpace(r.URL.Query().Get("cursor"))

	st := store.New(s.db)
	if _, err := st.GetUploadFolderBatch(r.Context(), batchID); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "目录上传批次不存在")
			return
		}
		s.logger.Error("get upload folder batch failed", "error", err.Error(), "batch_id", batchID.String())
		writeError(w, http.StatusInternalServerError, "internal_error", "读取目录上传批次失败")
		return
	}

	entries, err := st.ListUploadFolderEntriesPage(r.Context(), batchID, cursor, limit)
	if err != nil {
		s.logger.Error("list upload folder work failed", "error", err.Error(), "batch_id", batchID.String())
		writeError(w, http.StatusInternalServerError, "internal_error", "读取目录上传工作项失败")
		return
	}

	items := make([]uploadFolderWorkItemDTO, 0, len(entries))
	var nextCursor *string
	for _, entry := range entries {
		if entry.ItemID == nil || entry.UploadSessionID == nil {
			continue
		}
		session, sessionErr := st.GetUploadSession(r.Context(), *entry.UploadSessionID)
		if sessionErr != nil {
			s.logger.Warn("get upload session for folder work failed", "error", sessionErr.Error(), "session_id", entry.UploadSessionID.String())
			continue
		}
		item, itemErr := st.GetItem(r.Context(), *entry.ItemID)
		if itemErr != nil || item.ParentID == nil {
			continue
		}
		items = append(items, uploadFolderWorkItemDTO{
			RelativePath: entry.RelativePath,
			SessionID:    entry.UploadSessionID.String(),
			ParentItemID: item.ParentID.String(),
			FileName:     entry.Name,
			ChunkSize:    session.ChunkSize,
			TotalChunks:  session.TotalChunks,
		})
	}
	if len(entries) == limit {
		cursorValue := entries[len(entries)-1].RelativePath
		nextCursor = &cursorValue
	}
	writeJSON(w, http.StatusOK, uploadFolderWorkResponse{Items: items, NextCursor: nextCursor})
}

func buildUploadFolderManifest(req createUploadFolderRequest) (uploadFolderManifest, error) {
	rootName := strings.TrimSpace(req.RootName)
	if rootName == "" {
		return uploadFolderManifest{}, store.ErrBadInput
	}
	if strings.Contains(rootName, "/") || strings.Contains(rootName, "\\") || rootName == "." || rootName == ".." {
		return uploadFolderManifest{}, store.ErrBadInput
	}

	seen := map[string]struct{}{}
	directories := make([]uploadFolderDirectory, 0, len(req.Directories))
	for _, item := range req.Directories {
		directory, err := parseUploadFolderDirectory(item.RelativePath)
		if err != nil {
			return uploadFolderManifest{}, err
		}
		if _, exists := seen["dir:"+directory.RelativePath]; exists {
			return uploadFolderManifest{}, store.ErrBadInput
		}
		seen["dir:"+directory.RelativePath] = struct{}{}
		directories = append(directories, directory)
	}

	files := make([]uploadFolderFile, 0, len(req.Files))
	totalSize := int64(0)
	for _, item := range req.Files {
		file, err := parseUploadFolderFile(item)
		if err != nil {
			return uploadFolderManifest{}, err
		}
		if _, exists := seen["file:"+file.RelativePath]; exists {
			return uploadFolderManifest{}, store.ErrBadInput
		}
		if _, exists := seen["dir:"+file.RelativePath]; exists {
			return uploadFolderManifest{}, store.ErrBadInput
		}
		seen["file:"+file.RelativePath] = struct{}{}
		files = append(files, file)
		totalSize += file.Size
	}

	sort.SliceStable(directories, func(i int, j int) bool {
		if directories[i].Depth == directories[j].Depth {
			return directories[i].RelativePath < directories[j].RelativePath
		}
		return directories[i].Depth < directories[j].Depth
	})
	sort.SliceStable(files, func(i int, j int) bool {
		return files[i].RelativePath < files[j].RelativePath
	})

	return uploadFolderManifest{
		RootName:    rootName,
		Directories: directories,
		Files:       files,
		TotalSize:   totalSize,
	}, nil
}

func parseUploadFolderDirectory(raw string) (uploadFolderDirectory, error) {
	relativePath, err := normalizeUploadFolderRelativePath(raw)
	if err != nil || relativePath == "" {
		return uploadFolderDirectory{}, store.ErrBadInput
	}
	return uploadFolderDirectory{
		RelativePath:       relativePath,
		ParentRelativePath: buildUploadFolderParentRelativePath(relativePath),
		Name:               uploadFolderEntryName(relativePath),
		Depth:              uploadFolderEntryDepth(relativePath),
	}, nil
}

func parseUploadFolderFile(input createUploadFolderFileDTO) (uploadFolderFile, error) {
	if input.Size <= 0 {
		return uploadFolderFile{}, store.ErrBadInput
	}
	relativePath, err := normalizeUploadFolderRelativePath(input.RelativePath)
	if err != nil || relativePath == "" {
		return uploadFolderFile{}, store.ErrBadInput
	}
	name := uploadFolderEntryName(relativePath)
	mimeType := normalizeUploadMimeType(name, strOrEmpty(input.MimeType))
	return uploadFolderFile{
		RelativePath:       relativePath,
		ParentRelativePath: buildUploadFolderParentRelativePath(relativePath),
		Name:               name,
		Depth:              uploadFolderEntryDepth(relativePath),
		Size:               input.Size,
		MimeType:           stringPointerOrNil(mimeType),
		ItemType:           store.GuessItemType(name, mimeType),
	}, nil
}

func normalizeUploadFolderRelativePath(raw string) (string, error) {
	normalized := strings.TrimSpace(strings.ReplaceAll(raw, "\\", "/"))
	normalized = strings.Trim(normalized, "/")
	if normalized == "" {
		return "", nil
	}
	parts := strings.Split(normalized, "/")
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" || part == "." || part == ".." {
			return "", store.ErrBadInput
		}
	}
	return strings.Join(parts, "/"), nil
}

func buildUploadFolderParentRelativePath(relativePath string) *string {
	index := strings.LastIndex(relativePath, "/")
	if index <= 0 {
		return nil
	}
	parent := relativePath[:index]
	return &parent
}

func uploadFolderEntryName(relativePath string) string {
	index := strings.LastIndex(relativePath, "/")
	if index < 0 {
		return relativePath
	}
	return relativePath[index+1:]
}

func uploadFolderEntryDepth(relativePath string) int {
	if relativePath == "" {
		return 0
	}
	return strings.Count(relativePath, "/") + 1
}

func stringPointerOrNil(value string) *string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func (s *Server) createUploadFolderBatch(
	ctx context.Context,
	parentID *uuid.UUID,
	manifest uploadFolderManifest,
) (uploadFolderCreateResult, error) {
	accessMethod, err := s.resolveUploadAccessMethod(ctx)
	if err != nil {
		return uploadFolderCreateResult{}, err
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return uploadFolderCreateResult{}, err
	}
	defer tx.Rollback(ctx)

	parentPath, err := resolveUploadFolderParentPathTx(ctx, tx, parentID)
	if err != nil {
		return uploadFolderCreateResult{}, err
	}
	if err := assertUploadFolderPathsAvailableTx(ctx, tx, parentPath, manifest); err != nil {
		return uploadFolderCreateResult{}, err
	}

	now := time.Now()
	batchID := uuid.New()
	job := buildUploadFolderTransferJob(batchID, manifest, now)
	if err := insertTransferJobTx(ctx, tx, job); err != nil {
		return uploadFolderCreateResult{}, err
	}
	rootItem, err := insertUploadFolderRootTx(ctx, tx, parentID, parentPath, manifest.RootName, now)
	if err != nil {
		return uploadFolderCreateResult{}, err
	}
	if err := insertUploadFolderBatchMetaTx(ctx, tx, batchID, parentID, rootItem.ID, manifest, now); err != nil {
		return uploadFolderCreateResult{}, err
	}
	ids, err := insertUploadFolderDirectoriesTx(ctx, tx, batchID, rootItem, manifest.Directories, now)
	if err != nil {
		return uploadFolderCreateResult{}, err
	}
	if err := insertUploadFolderFilesTx(ctx, tx, batchID, rootItem, ids, manifest.Files, accessMethod, s.cfg.ChunkSizeBytes, now); err != nil {
		return uploadFolderCreateResult{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return uploadFolderCreateResult{}, err
	}
	s.syncTransferJobEvent(ctx, job)
	return uploadFolderCreateResult{BatchID: batchID, RootItemID: rootItem.ID, Job: job}, nil
}

func buildUploadFolderTransferJob(batchID uuid.UUID, manifest uploadFolderManifest, now time.Time) store.TransferJob {
	status := store.TransferJobStatusRunning
	if len(manifest.Files) == 0 {
		status = store.TransferJobStatusCompleted
	}
	return store.TransferJob{
		ID:             batchID,
		Direction:      store.TransferDirectionUpload,
		SourceKind:     store.TransferSourceKindUploadBatch,
		SourceRef:      buildUploadBatchTransferSourceRef(batchID),
		UnitKind:       store.TransferUnitKindFolder,
		Name:           manifest.RootName,
		TotalSize:      manifest.TotalSize,
		ItemCount:      len(manifest.Files),
		CompletedCount: 0,
		ErrorCount:     0,
		CanceledCount:  0,
		Status:         status,
		StartedAt:      now,
		FinishedAt:     now,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
}
