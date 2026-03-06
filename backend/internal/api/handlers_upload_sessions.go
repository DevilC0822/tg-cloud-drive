package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"tg-cloud-drive-api/internal/store"
	"tg-cloud-drive-api/internal/telegram"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type uploadSessionDTO struct {
	ID             string `json:"id"`
	ItemID         string `json:"itemId"`
	FileName       string `json:"fileName"`
	FileSize       int64  `json:"fileSize"`
	ChunkSize      int    `json:"chunkSize"`
	TotalChunks    int    `json:"totalChunks"`
	Status         string `json:"status"`
	UploadedChunks []int  `json:"uploadedChunks"`
	UploadedCount  int    `json:"uploadedCount"`
}

type uploadSessionChunkProgressDTO struct {
	SessionID     string `json:"sessionId"`
	TotalChunks   int    `json:"totalChunks"`
	UploadedCount int    `json:"uploadedCount"`
	Status        string `json:"status"`
}

func (s *Server) handleCreateUploadBatch(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name      string  `json:"name"`
		ItemCount int     `json:"itemCount"`
		TotalSize int64   `json:"totalSize"`
		StartedAt *string `json:"startedAt"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "请求体不是合法 JSON")
		return
	}
	if req.ItemCount < 1 {
		writeError(w, http.StatusBadRequest, "bad_request", "itemCount 必须大于 0")
		return
	}
	if req.TotalSize < 0 {
		writeError(w, http.StatusBadRequest, "bad_request", "totalSize 不能为负数")
		return
	}

	startedAt := time.Now()
	if req.StartedAt != nil {
		raw := strings.TrimSpace(*req.StartedAt)
		if raw != "" {
			parsed, err := time.Parse(time.RFC3339Nano, raw)
			if err != nil {
				writeError(w, http.StatusBadRequest, "bad_request", "startedAt 时间格式非法")
				return
			}
			startedAt = parsed
		}
	}

	job, err := s.createUploadBatchTransferJob(r.Context(), req.Name, req.ItemCount, req.TotalSize, startedAt)
	if err != nil {
		s.logger.Error("create upload batch transfer job failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "创建上传批次失败")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"batchId": job.ID.String(),
		"job":     toTransferHistoryDTO(job),
	})
}

func (s *Server) handleCreateUploadSession(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ParentID        *string `json:"parentId"`
		TransferBatchID *string `json:"transferBatchId"`
		Name            string  `json:"name"`
		MimeType        *string `json:"mimeType"`
		Size            int64   `json:"size"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "请求体不是合法 JSON")
		return
	}

	fileName := strings.TrimSpace(req.Name)
	if fileName == "" {
		writeError(w, http.StatusBadRequest, "bad_request", "文件名不能为空")
		return
	}
	if req.Size <= 0 {
		writeError(w, http.StatusBadRequest, "bad_request", "文件大小必须大于 0")
		return
	}

	var parentID *uuid.UUID
	if req.ParentID != nil {
		raw := strings.TrimSpace(*req.ParentID)
		if raw != "" && strings.ToLower(raw) != "null" {
			parsed, err := uuid.Parse(raw)
			if err != nil {
				writeError(w, http.StatusBadRequest, "bad_request", "parentId 非法")
				return
			}
			parentID = &parsed
		}
	}
	var transferBatchID *uuid.UUID
	if req.TransferBatchID != nil {
		rawBatchID := strings.TrimSpace(*req.TransferBatchID)
		if rawBatchID != "" {
			parsedBatchID, parseErr := uuid.Parse(rawBatchID)
			if parseErr != nil {
				writeError(w, http.StatusBadRequest, "bad_request", "transferBatchId 非法")
				return
			}
			transferBatchID = &parsedBatchID
		}
	}

	chunkSizeLimit := s.cfg.ChunkSizeBytes
	if chunkSizeLimit <= 0 {
		chunkSizeLimit = 20 * 1024 * 1024
	}

	st := store.New(s.db)
	now := time.Now()
	if transferBatchID != nil {
		batchJob, batchErr := st.GetTransferJobByID(r.Context(), *transferBatchID)
		if batchErr != nil {
			if errors.Is(batchErr, store.ErrNotFound) {
				writeError(w, http.StatusBadRequest, "bad_request", "transferBatchId 不存在")
				return
			}
			s.logger.Error("get transfer batch failed", "error", batchErr.Error(), "batch_id", transferBatchID.String())
			writeError(w, http.StatusInternalServerError, "internal_error", "读取上传批次失败")
			return
		}
		if batchJob.Direction != store.TransferDirectionUpload || batchJob.SourceKind != store.TransferSourceKindUploadBatch {
			writeError(w, http.StatusBadRequest, "bad_request", "transferBatchId 不属于上传批次")
			return
		}
		if strings.TrimSpace(batchJob.SourceRef) != buildUploadBatchTransferSourceRef(*transferBatchID) {
			writeError(w, http.StatusBadRequest, "bad_request", "transferBatchId 记录异常")
			return
		}
		if batchJob.Status != store.TransferJobStatusRunning {
			writeError(w, http.StatusBadRequest, "bad_request", "transferBatchId 已结束，不可继续追加会话")
			return
		}
	}
	accessMethod, err := s.resolveUploadAccessMethod(r.Context())
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusServiceUnavailable, "setup_required", "系统尚未初始化，请先完成初始化配置")
			return
		}
		s.logger.Error("resolve upload access method failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "读取接入方式失败")
		return
	}

	mimeType := normalizeUploadMimeType(fileName, strOrEmpty(req.MimeType))
	uploadMode := resolveUploadSessionModeForCreate(accessMethod, fileName, mimeType, req.Size)
	var mimePtr *string
	if mimeType != "" {
		mimePtr = &mimeType
	}
	if normalizeUploadAccessMethod(accessMethod) == setupAccessMethodOfficial {
		singleLimit := officialBotAPISingleUploadLimitBytes(fileName, mimeType)
		if chunkSizeLimit > singleLimit {
			chunkSizeLimit = singleLimit
		}
	}
	totalChunks := int((req.Size + chunkSizeLimit - 1) / chunkSizeLimit)
	if totalChunks <= 0 {
		writeError(w, http.StatusBadRequest, "bad_request", "文件大小异常")
		return
	}
	itemType := store.GuessItemType(fileName, mimeType)

	it, err := st.CreateFileItem(r.Context(), parentID, itemType, fileName, 0, mimePtr, now)
	if err != nil {
		if errors.Is(err, store.ErrBadInput) {
			writeError(w, http.StatusBadRequest, "bad_request", "参数非法（请确认父目录存在且可用）")
			return
		}
		if errors.Is(err, store.ErrConflict) {
			writeError(w, http.StatusConflict, "conflict", "同一目录下已存在同名文件或文件夹")
			return
		}
		s.logger.Error("create file item failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "创建上传会话失败")
		return
	}

	session := store.UploadSession{
		ID:              uuid.New(),
		ItemID:          it.ID,
		TransferBatchID: transferBatchID,
		FileName:        fileName,
		MimeType:        mimePtr,
		FileSize:        req.Size,
		ChunkSize:       int(chunkSizeLimit),
		TotalChunks:     totalChunks,
		AccessMethod:    accessMethod,
		UploadMode:      uploadMode,
		Status:          store.UploadSessionStatusUploading,
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	if err := st.CreateUploadSession(r.Context(), session); err != nil {
		_ = st.DeleteItemsByPathPrefix(r.Context(), it.Path)
		s.logger.Error("create upload session failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "创建上传会话失败")
		return
	}

	var transferJobID *string
	var transferJobDTO *transferJobViewDTO
	if job, err := s.upsertUploadSessionRunningTransferJob(r.Context(), session); err != nil {
		s.logger.Warn("create upload session transfer job failed", "error", err.Error(), "session_id", session.ID.String())
	} else if job != nil {
		value := job.ID.String()
		transferJobID = &value
		if dto, buildErr := s.buildTransferJobViewDTO(r.Context(), *job); buildErr == nil {
			transferJobDTO = &dto
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"session":       toUploadSessionDTO(session, nil),
		"transferJobId": transferJobID,
		"transferJob":   transferJobDTO,
	})
}

func (s *Server) handleGetUploadSession(w http.ResponseWriter, r *http.Request) {
	id, err := parseUUIDParam(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "id 非法")
		return
	}

	st := store.New(s.db)
	session, err := st.GetUploadSession(r.Context(), id)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "上传会话不存在")
			return
		}
		s.logger.Error("get upload session failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "查询上传会话失败")
		return
	}

	uploaded, err := s.listUploadedChunkIndicesBySession(r.Context(), session)
	if err != nil {
		s.logger.Error("list uploaded chunks failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "查询上传进度失败")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"session": toUploadSessionDTO(session, uploaded),
	})
}

func (s *Server) handleUploadSessionChunk(w http.ResponseWriter, r *http.Request) {
	settings, err := s.getRuntimeSettings(r.Context())
	if err != nil {
		s.logger.Error("get runtime settings failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "读取运行配置失败")
		return
	}
	if err := s.acquireUploadSlot(r.Context(), settings.UploadConcurrency); err != nil {
		if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
			return
		}
		writeError(w, http.StatusServiceUnavailable, "service_unavailable", "上传队列繁忙，请稍后重试")
		return
	}
	defer s.releaseUpload()

	sessionID, err := parseUUIDParam(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "id 非法")
		return
	}
	chunkIndex, err := strconv.Atoi(strings.TrimSpace(chi.URLParam(r, "index")))
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "chunk index 非法")
		return
	}

	st := store.New(s.db)
	session, err := st.GetUploadSession(r.Context(), sessionID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "上传会话不存在")
			return
		}
		s.logger.Error("get upload session failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "查询上传会话失败")
		return
	}
	if session.Status == store.UploadSessionStatusCompleted {
		writeError(w, http.StatusConflict, "conflict", "上传会话已完成")
		return
	}
	recordChunkFailure := func(errMsg string, process *videoUploadProcessMeta) {
		s.recordUploadSessionTransferHistory(
			context.Background(),
			session,
			nil,
			store.TransferStatusError,
			errMsg,
			process,
			time.Now(),
		)
	}
	if chunkIndex < 0 || chunkIndex >= session.TotalChunks {
		writeError(w, http.StatusBadRequest, "bad_request", "chunk index 超出范围")
		return
	}
	if err := s.acquireUploadSessionChunkLock(r.Context(), session.ID, chunkIndex); err != nil {
		if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
			return
		}
		writeError(w, http.StatusServiceUnavailable, "service_unavailable", "分片处理中，请稍后重试")
		return
	}
	defer s.releaseUploadSessionChunkLock(session.ID, chunkIndex)

	exists, err := s.hasUploadedChunkBySession(r.Context(), session, chunkIndex)
	if err != nil {
		s.logger.Error("check chunk exists failed", "error", err.Error())
		recordChunkFailure("检查分片状态失败", nil)
		writeError(w, http.StatusInternalServerError, "internal_error", "检查分片状态失败")
		return
	}
	if exists {
		uploadedCount, countErr := s.countUploadedChunksBySession(r.Context(), session)
		if countErr != nil {
			s.logger.Error("count uploaded chunks failed", "error", countErr.Error())
			recordChunkFailure("查询上传进度失败", nil)
			writeError(w, http.StatusInternalServerError, "internal_error", "查询上传进度失败")
			return
		}
		s.syncUploadSessionProgressEvent(r.Context(), session)
		writeJSON(w, http.StatusOK, map[string]any{
			"alreadyUploaded": true,
			"progress":        toUploadSessionChunkProgressDTO(session, uploadedCount),
		})
		return
	}

	chunkPart, err := findMultipartChunkPart(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	defer chunkPart.Close()

	expectedChunkSize := chunkSizeForIndex(session, chunkIndex)
	if expectedChunkSize <= 0 {
		writeError(w, http.StatusInternalServerError, "internal_error", "分片大小计算失败")
		return
	}
	if err := ensureTempSpaceAvailable(settings.ReservedDiskBytes, int64(expectedChunkSize)); err != nil {
		writeError(w, http.StatusInsufficientStorage, "insufficient_storage", "服务器可用磁盘不足，请稍后重试或调低预留空间")
		return
	}

	tmpFile, err := createChunkTempFile(chunkPart, int64(expectedChunkSize))
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	defer os.Remove(tmpFile.path)

	if tmpFile.size != int64(expectedChunkSize) {
		writeError(w, http.StatusBadRequest, "bad_request", fmt.Sprintf("分片大小不匹配，期望 %d 字节", expectedChunkSize))
		return
	}

	uploadMode, err := s.resolveUploadSessionMode(r.Context(), session)
	if err != nil {
		s.logger.Error("resolve upload session mode failed", "error", err.Error(), "session_id", session.ID.String())
		recordChunkFailure("计算上传策略失败", nil)
		writeError(w, http.StatusInternalServerError, "internal_error", "计算上传策略失败")
		return
	}
	useLocalChunkStaging := uploadMode == store.UploadSessionModeLocalStaged

	if useLocalChunkStaging {
		if err := s.saveLocalSessionChunk(session, chunkIndex, tmpFile.path); err != nil {
			if errors.Is(err, store.ErrConflict) {
				uploadedCount, countErr := s.countUploadedChunksBySession(r.Context(), session)
				if countErr != nil {
					s.logger.Error("count uploaded chunks failed", "error", countErr.Error())
					writeError(w, http.StatusInternalServerError, "internal_error", "查询上传进度失败")
					return
				}
				writeJSON(w, http.StatusOK, map[string]any{
					"alreadyUploaded": true,
					"progress":        toUploadSessionChunkProgressDTO(session, uploadedCount),
				})
				return
			}
			s.logger.Error("save local upload chunk failed", "error", err.Error())
			recordChunkFailure("保存分片失败", nil)
			writeError(w, http.StatusInternalServerError, "internal_error", "保存分片失败")
			return
		}

		_ = st.SetUploadSessionStatus(r.Context(), session.ID, store.UploadSessionStatusUploading, time.Now())
		uploadedCount, err := s.countUploadedChunksBySession(r.Context(), session)
		if err != nil {
			s.logger.Error("count uploaded chunks failed", "error", err.Error())
			recordChunkFailure("查询上传进度失败", nil)
			writeError(w, http.StatusInternalServerError, "internal_error", "查询上传进度失败")
			return
		}
		s.syncUploadSessionProgressEvent(r.Context(), session)

		writeJSON(w, http.StatusOK, map[string]any{
			"alreadyUploaded": false,
			"progress":        toUploadSessionChunkProgressDTO(session, uploadedCount),
		})
		return
	}

	caption := fmt.Sprintf("tgcd:%s:%d", session.ItemID.String(), chunkIndex)
	chunkFileName := buildChunkFileName(session.FileName, session.ItemID, chunkIndex)
	var (
		msg           telegram.Message
		sendErr       error
		uploadProcess *videoUploadProcessMeta
	)
	if session.TotalChunks == 1 {
		msg, uploadProcess, sendErr = s.sendMediaFromPathWithRetry(
			r.Context(),
			s.cfg.TGStorageChatID,
			session.FileName,
			tmpFile.path,
			strOrEmpty(session.MimeType),
			caption,
		)
	} else {
		msg, sendErr = s.sendDocumentFromPathWithRetry(r.Context(), s.cfg.TGStorageChatID, chunkFileName, tmpFile.path, caption)
	}
	if sendErr != nil {
		s.logger.Error("sendDocument failed", "error", sendErr.Error())
		recordChunkFailure("上传到 Telegram 失败", uploadProcess)
		writeError(w, http.StatusBadGateway, "bad_gateway", "上传到 Telegram 失败")
		return
	}
	resolvedDoc, docErr := s.resolveMessageDocument(r.Context(), msg)
	if docErr != nil {
		s.logger.Error(
			"sendDocument missing file_id",
			"session_id", session.ID.String(),
			"chunk_index", chunkIndex,
			"message_id", msg.MessageID,
			"error", docErr.Error(),
		)
		if msg.MessageID > 0 {
			_ = s.deleteMessageWithRetry(r.Context(), s.cfg.TGStorageChatID, msg.MessageID)
		}
		recordChunkFailure("上传结果异常（缺少文件标识）", uploadProcess)
		writeError(w, http.StatusBadGateway, "bad_gateway", "上传结果异常（缺少文件标识）")
		return
	}

	chunk := store.Chunk{
		ID:             uuid.New(),
		ItemID:         session.ItemID,
		ChunkIndex:     chunkIndex,
		ChunkSize:      resolveStoredChunkSize(resolvedDoc.FileSize, tmpFile.size),
		TGChatID:       s.cfg.TGStorageChatID,
		TGMessageID:    msg.MessageID,
		TGFileID:       resolvedDoc.FileID,
		TGFileUniqueID: resolvedDoc.FileUniqueID,
		CreatedAt:      time.Now(),
	}
	if err := st.InsertChunk(r.Context(), chunk); err != nil {
		if errors.Is(err, store.ErrConflict) {
			_ = s.deleteMessageWithRetry(r.Context(), s.cfg.TGStorageChatID, msg.MessageID)
		} else {
			s.logger.Error("insert chunk failed", "error", err.Error())
			_ = s.deleteMessageWithRetry(r.Context(), s.cfg.TGStorageChatID, msg.MessageID)
			recordChunkFailure("写入分块元数据失败", uploadProcess)
			writeError(w, http.StatusInternalServerError, "internal_error", "写入分块元数据失败")
			return
		}
	}

	_ = st.SetUploadSessionStatus(r.Context(), session.ID, store.UploadSessionStatusUploading, time.Now())
	uploadedCount, err := s.countUploadedChunksBySession(r.Context(), session)
	if err != nil {
		s.logger.Error("count uploaded chunks failed", "error", err.Error())
		recordChunkFailure("查询上传进度失败", uploadProcess)
		writeError(w, http.StatusInternalServerError, "internal_error", "查询上传进度失败")
		return
	}
	s.syncUploadSessionProgressEvent(r.Context(), session)

	writeJSON(w, http.StatusOK, map[string]any{
		"alreadyUploaded": false,
		"progress":        toUploadSessionChunkProgressDTO(session, uploadedCount),
		"uploadProcess":   toUploadProcessDTO(uploadProcess),
	})
}

func (s *Server) handleCompleteUploadSession(w http.ResponseWriter, r *http.Request) {
	sessionID, err := parseUUIDParam(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "id 非法")
		return
	}

	st := store.New(s.db)
	session, err := st.GetUploadSession(r.Context(), sessionID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "上传会话不存在")
			return
		}
		s.logger.Error("get upload session failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "查询上传会话失败")
		return
	}
	if session.Status == store.UploadSessionStatusCompleted {
		item, itemErr := st.GetItem(r.Context(), session.ItemID)
		if itemErr != nil {
			s.logger.Error("get completed upload session item failed", "error", itemErr.Error())
			writeError(w, http.StatusInternalServerError, "internal_error", "查询失败")
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"item":          toItemDTO(item),
			"uploadProcess": nil,
		})
		return
	}

	uploaded, err := s.listUploadedChunkIndicesBySession(r.Context(), session)
	if err != nil {
		s.logger.Error("list uploaded chunks failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "查询上传进度失败")
		return
	}

	missing := missingChunkIndices(session.TotalChunks, uploaded)
	if len(missing) > 0 {
		_ = st.SetUploadSessionStatus(r.Context(), session.ID, store.UploadSessionStatusFailed, time.Now())
		s.recordUploadSessionTransferHistory(
			context.Background(),
			session,
			nil,
			store.TransferStatusError,
			fmt.Sprintf("仍有 %d 个分片未上传", len(missing)),
			nil,
			time.Now(),
		)
		writeError(w, http.StatusConflict, "conflict", fmt.Sprintf("仍有 %d 个分片未上传，请重试后续传", len(missing)))
		return
	}

	method := normalizeUploadAccessMethod(session.AccessMethod)
	uploadMode, err := s.resolveUploadSessionMode(r.Context(), session)
	if err != nil {
		s.logger.Error("resolve upload session mode failed", "error", err.Error(), "session_id", session.ID.String())
		s.recordUploadSessionTransferHistory(
			context.Background(),
			session,
			nil,
			store.TransferStatusError,
			"计算上传策略失败",
			nil,
			time.Now(),
		)
		writeError(w, http.StatusInternalServerError, "internal_error", "计算上传策略失败")
		return
	}
	useLocalMergedUpload := uploadMode == store.UploadSessionModeLocalStaged
	var (
		uploadProcess   *videoUploadProcessMeta
		mergedChunk     *store.Chunk
		mergedMessageID int64
	)

	if useLocalMergedUpload {
		mergedPath, mergeErr := s.mergeLocalSessionChunks(session)
		if mergeErr != nil {
			s.logger.Error("merge local staged upload chunks failed", "error", mergeErr.Error(), "session_id", session.ID.String())
			_ = st.SetUploadSessionStatus(r.Context(), session.ID, store.UploadSessionStatusFailed, time.Now())
			s.recordUploadSessionTransferHistory(
				context.Background(),
				session,
				nil,
				store.TransferStatusError,
				"分片合并失败",
				nil,
				time.Now(),
			)
			writeError(w, http.StatusInternalServerError, "internal_error", "分片合并失败")
			return
		}
		defer os.Remove(mergedPath)

		caption := fmt.Sprintf("tgcd:%s", session.ItemID.String())
		var (
			msg     telegram.Message
			sendErr error
		)
		if method == setupAccessMethodSelfHosted {
			msg, uploadProcess, sendErr = s.sendMediaFromLocalPathWithRetry(
				r.Context(),
				s.cfg.TGStorageChatID,
				session.FileName,
				mergedPath,
				strOrEmpty(session.MimeType),
				caption,
			)
		} else {
			msg, uploadProcess, sendErr = s.sendMediaFromPathWithRetry(
				r.Context(),
				s.cfg.TGStorageChatID,
				session.FileName,
				mergedPath,
				strOrEmpty(session.MimeType),
				caption,
			)
		}
		if sendErr != nil {
			s.logger.Error("send local staged merged file failed", "error", sendErr.Error(), "session_id", session.ID.String())
			_ = st.SetUploadSessionStatus(r.Context(), session.ID, store.UploadSessionStatusFailed, time.Now())
			s.recordUploadSessionTransferHistory(
				context.Background(),
				session,
				nil,
				store.TransferStatusError,
				"上传到 Telegram 失败",
				uploadProcess,
				time.Now(),
			)
			writeError(w, http.StatusBadGateway, "bad_gateway", "上传到 Telegram 失败")
			return
		}
		resolvedDoc, docErr := s.resolveMessageDocument(r.Context(), msg)
		if docErr != nil {
			s.logger.Error(
				"sendDocument(local_path) missing file_id",
				"session_id", session.ID.String(),
				"message_id", msg.MessageID,
				"error", docErr.Error(),
			)
			if msg.MessageID > 0 {
				_ = s.deleteMessageWithRetry(r.Context(), s.cfg.TGStorageChatID, msg.MessageID)
			}
			_ = st.SetUploadSessionStatus(r.Context(), session.ID, store.UploadSessionStatusFailed, time.Now())
			s.recordUploadSessionTransferHistory(
				context.Background(),
				session,
				nil,
				store.TransferStatusError,
				"上传结果异常（缺少文件标识）",
				uploadProcess,
				time.Now(),
			)
			writeError(w, http.StatusBadGateway, "bad_gateway", "上传结果异常（缺少文件标识）")
			return
		}

		chunk := store.Chunk{
			ID:             uuid.New(),
			ItemID:         session.ItemID,
			ChunkIndex:     0,
			ChunkSize:      resolveStoredChunkSize(resolvedDoc.FileSize, session.FileSize),
			TGChatID:       s.cfg.TGStorageChatID,
			TGMessageID:    msg.MessageID,
			TGFileID:       resolvedDoc.FileID,
			TGFileUniqueID: resolvedDoc.FileUniqueID,
			CreatedAt:      time.Now(),
		}
		mergedChunk = &chunk
		mergedMessageID = msg.MessageID
	}

	actualSize := resolveStoredSizeByTelegramSize(0, session.FileSize)
	if mergedChunk != nil {
		actualSize = resolveStoredSizeByTelegramSize(0, int64(mergedChunk.ChunkSize))
	}
	if !useLocalMergedUpload {
		uploadedChunks, listErr := st.ListChunks(r.Context(), session.ItemID)
		if listErr != nil {
			s.logger.Error("list chunks failed", "error", listErr.Error(), "session_id", session.ID.String())
			writeError(w, http.StatusInternalServerError, "internal_error", "查询上传分片失败")
			return
		}
		actualSize = resolveUploadedChunkTotalSize(uploadedChunks, session.FileSize)
	}

	now := time.Now()
	item, finalizeErr := st.FinalizeUploadSession(r.Context(), store.FinalizeUploadSessionInput{
		SessionID: session.ID,
		ItemID:    session.ItemID,
		ItemSize:  actualSize,
		UpdatedAt: now,
		Chunk:     mergedChunk,
	})
	if errors.Is(finalizeErr, store.ErrConflict) && useLocalMergedUpload && mergedMessageID > 0 {
		_ = s.deleteMessageWithRetry(r.Context(), s.cfg.TGStorageChatID, mergedMessageID)
		mergedChunk = nil
		uploadedChunks, listErr := st.ListChunks(r.Context(), session.ItemID)
		if listErr != nil {
			s.logger.Error("list chunks failed after merged chunk conflict", "error", listErr.Error(), "session_id", session.ID.String())
			_ = st.SetUploadSessionStatus(r.Context(), session.ID, store.UploadSessionStatusFailed, time.Now())
			s.recordUploadSessionTransferHistory(
				context.Background(),
				session,
				nil,
				store.TransferStatusError,
				"查询上传分片失败",
				uploadProcess,
				time.Now(),
			)
			writeError(w, http.StatusInternalServerError, "internal_error", "查询上传分片失败")
			return
		}
		actualSize = resolveUploadedChunkTotalSize(uploadedChunks, session.FileSize)
		item, finalizeErr = st.FinalizeUploadSession(r.Context(), store.FinalizeUploadSessionInput{
			SessionID: session.ID,
			ItemID:    session.ItemID,
			ItemSize:  actualSize,
			UpdatedAt: time.Now(),
			Chunk:     nil,
		})
	}
	if finalizeErr != nil {
		s.logger.Error("finalize upload session failed", "error", finalizeErr.Error(), "session_id", session.ID.String())
		_ = st.SetUploadSessionStatus(r.Context(), session.ID, store.UploadSessionStatusFailed, time.Now())
		s.recordUploadSessionTransferHistory(
			context.Background(),
			session,
			nil,
			store.TransferStatusError,
			"完成上传失败",
			uploadProcess,
			time.Now(),
		)
		writeError(w, http.StatusInternalServerError, "internal_error", "完成上传失败")
		return
	}
	if useLocalMergedUpload {
		if cleanupErr := s.clearLocalUploadSession(session.ID); cleanupErr != nil {
			s.logger.Warn("cleanup local staged upload files failed", "error", cleanupErr.Error(), "session_id", session.ID.String())
		}
	}
	s.recordUploadSessionTransferHistory(
		context.Background(),
		session,
		&item.ID,
		store.TransferStatusCompleted,
		"",
		uploadProcess,
		time.Now(),
	)

	writeJSON(w, http.StatusOK, map[string]any{
		"item":          toItemDTO(item),
		"uploadProcess": toUploadProcessDTO(uploadProcess),
	})
}

func toUploadSessionDTO(ses store.UploadSession, uploaded []int) uploadSessionDTO {
	return uploadSessionDTO{
		ID:             ses.ID.String(),
		ItemID:         ses.ItemID.String(),
		FileName:       ses.FileName,
		FileSize:       ses.FileSize,
		ChunkSize:      ses.ChunkSize,
		TotalChunks:    ses.TotalChunks,
		Status:         string(ses.Status),
		UploadedChunks: uploaded,
		UploadedCount:  len(uploaded),
	}
}

func toUploadSessionChunkProgressDTO(ses store.UploadSession, uploadedCount int) uploadSessionChunkProgressDTO {
	if uploadedCount < 0 {
		uploadedCount = 0
	}
	if ses.TotalChunks > 0 && uploadedCount > ses.TotalChunks {
		uploadedCount = ses.TotalChunks
	}
	return uploadSessionChunkProgressDTO{
		SessionID:     ses.ID.String(),
		TotalChunks:   ses.TotalChunks,
		UploadedCount: uploadedCount,
		Status:        string(ses.Status),
	}
}

func strOrEmpty(ptr *string) string {
	if ptr == nil {
		return ""
	}
	return *ptr
}

func chunkSizeForIndex(ses store.UploadSession, idx int) int {
	if idx < 0 || idx >= ses.TotalChunks || ses.ChunkSize <= 0 {
		return 0
	}
	if idx < ses.TotalChunks-1 {
		return ses.ChunkSize
	}
	last := ses.FileSize - int64(idx*ses.ChunkSize)
	if last <= 0 {
		return 0
	}
	return int(last)
}

func missingChunkIndices(total int, uploaded []int) []int {
	if total <= 0 {
		return nil
	}
	flags := make([]bool, total)
	for _, idx := range uploaded {
		if idx >= 0 && idx < total {
			flags[idx] = true
		}
	}
	out := make([]int, 0)
	for idx, ok := range flags {
		if !ok {
			out = append(out, idx)
		}
	}
	return out
}

func resolveUploadedChunkTotalSize(chunks []store.Chunk, fallback int64) int64 {
	total := int64(0)
	for _, chunk := range chunks {
		if chunk.ChunkSize <= 0 {
			continue
		}
		total += int64(chunk.ChunkSize)
	}
	total = resolveStoredSizeByTelegramSize(0, total)
	if total > 0 {
		return total
	}
	return resolveStoredSizeByTelegramSize(0, fallback)
}

type tempChunkFile struct {
	path string
	size int64
}

func createChunkTempFile(part *multipart.Part, maxExpected int64) (tempChunkFile, error) {
	tmp, err := os.CreateTemp("", "tgcd-session-chunk-*")
	if err != nil {
		return tempChunkFile{}, errors.New("创建临时文件失败")
	}
	defer tmp.Close()

	written, copyErr := io.Copy(tmp, io.LimitReader(part, maxExpected+1))
	if copyErr != nil {
		_ = os.Remove(tmp.Name())
		return tempChunkFile{}, errors.New("读取分片内容失败")
	}
	if written <= 0 {
		_ = os.Remove(tmp.Name())
		return tempChunkFile{}, errors.New("空分片不支持上传")
	}
	if written > maxExpected {
		_ = os.Remove(tmp.Name())
		return tempChunkFile{}, errors.New("分片大小超过限制")
	}
	return tempChunkFile{path: tmp.Name(), size: written}, nil
}

func findMultipartChunkPart(r *http.Request) (*multipart.Part, error) {
	mr, err := r.MultipartReader()
	if err != nil {
		return nil, errors.New("请求必须为 multipart/form-data")
	}

	for {
		part, nextErr := mr.NextPart()
		if nextErr == io.EOF {
			break
		}
		if nextErr != nil {
			return nil, errors.New("解析分片上传内容失败")
		}

		formName := strings.TrimSpace(part.FormName())
		if formName == "chunk" || formName == "file" {
			return part, nil
		}

		_, _ = io.Copy(io.Discard, part)
		_ = part.Close()
	}

	return nil, errors.New("缺少分片字段 chunk")
}
