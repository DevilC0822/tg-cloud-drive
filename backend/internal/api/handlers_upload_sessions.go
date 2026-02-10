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

	"github.com/const/tg-cloud-drive/backend/internal/store"
	"github.com/const/tg-cloud-drive/backend/internal/telegram"
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

func (s *Server) handleCreateUploadSession(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ParentID *string `json:"parentId"`
		Name     string  `json:"name"`
		MimeType *string `json:"mimeType"`
		Size     int64   `json:"size"`
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

	chunkSizeLimit := s.cfg.ChunkSizeBytes
	if chunkSizeLimit <= 0 {
		chunkSizeLimit = 20 * 1024 * 1024
	}

	st := store.New(s.db)
	now := time.Now()
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

	mimeType := strings.TrimSpace(strOrEmpty(req.MimeType))
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
		ID:           uuid.New(),
		ItemID:       it.ID,
		FileName:     fileName,
		MimeType:     mimePtr,
		FileSize:     req.Size,
		ChunkSize:    int(chunkSizeLimit),
		TotalChunks:  totalChunks,
		AccessMethod: accessMethod,
		Status:       store.UploadSessionStatusUploading,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	if err := st.CreateUploadSession(r.Context(), session); err != nil {
		_ = st.DeleteItemsByPathPrefix(r.Context(), it.Path)
		s.logger.Error("create upload session failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "创建上传会话失败")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"session": toUploadSessionDTO(session, nil),
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
	if chunkIndex < 0 || chunkIndex >= session.TotalChunks {
		writeError(w, http.StatusBadRequest, "bad_request", "chunk index 超出范围")
		return
	}

	exists, err := s.hasUploadedChunkBySession(r.Context(), session, chunkIndex)
	if err != nil {
		s.logger.Error("check chunk exists failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "检查分片状态失败")
		return
	}
	if exists {
		uploaded, listErr := s.listUploadedChunkIndicesBySession(r.Context(), session)
		if listErr != nil {
			s.logger.Error("list uploaded chunks failed", "error", listErr.Error())
			writeError(w, http.StatusInternalServerError, "internal_error", "查询上传进度失败")
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"alreadyUploaded": true,
			"session":         toUploadSessionDTO(session, uploaded),
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

	useLocalChunkStaging := normalizeUploadAccessMethod(session.AccessMethod) == setupAccessMethodSelfHosted
	if !useLocalChunkStaging {
		useLocalChunkStaging, err = s.shouldUseLocalStagingForOfficialSession(r.Context(), session)
		if err != nil {
			s.logger.Error("decide official upload strategy failed", "error", err.Error(), "session_id", session.ID.String())
			writeError(w, http.StatusInternalServerError, "internal_error", "计算上传策略失败")
			return
		}
	}

	if useLocalChunkStaging {
		if err := s.saveLocalSessionChunk(session, chunkIndex, tmpFile.path); err != nil {
			if errors.Is(err, store.ErrConflict) {
				uploaded, listErr := s.listUploadedChunkIndicesBySession(r.Context(), session)
				if listErr != nil {
					s.logger.Error("list uploaded chunks failed", "error", listErr.Error())
					writeError(w, http.StatusInternalServerError, "internal_error", "查询上传进度失败")
					return
				}
				writeJSON(w, http.StatusOK, map[string]any{
					"alreadyUploaded": true,
					"session":         toUploadSessionDTO(session, uploaded),
				})
				return
			}
			s.logger.Error("save local upload chunk failed", "error", err.Error())
			writeError(w, http.StatusInternalServerError, "internal_error", "保存分片失败")
			return
		}

		_ = st.SetUploadSessionStatus(r.Context(), session.ID, store.UploadSessionStatusUploading, time.Now())
		uploaded, err := s.listUploadedChunkIndicesBySession(r.Context(), session)
		if err != nil {
			s.logger.Error("list uploaded chunks failed", "error", err.Error())
			writeError(w, http.StatusInternalServerError, "internal_error", "查询上传进度失败")
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"alreadyUploaded": false,
			"session":         toUploadSessionDTO(session, uploaded),
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
		writeError(w, http.StatusBadGateway, "bad_gateway", "上传结果异常（缺少文件标识）")
		return
	}

	chunk := store.Chunk{
		ID:             uuid.New(),
		ItemID:         session.ItemID,
		ChunkIndex:     chunkIndex,
		ChunkSize:      int(tmpFile.size),
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
			writeError(w, http.StatusInternalServerError, "internal_error", "写入分块元数据失败")
			return
		}
	}

	_ = st.SetUploadSessionStatus(r.Context(), session.ID, store.UploadSessionStatusUploading, time.Now())
	uploaded, err := s.listUploadedChunkIndicesBySession(r.Context(), session)
	if err != nil {
		s.logger.Error("list uploaded chunks failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "查询上传进度失败")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"alreadyUploaded": false,
		"session":         toUploadSessionDTO(session, uploaded),
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
		writeError(w, http.StatusConflict, "conflict", fmt.Sprintf("仍有 %d 个分片未上传，请重试后续传", len(missing)))
		return
	}

	method := normalizeUploadAccessMethod(session.AccessMethod)
	useLocalMergedUpload := method == setupAccessMethodSelfHosted
	if !useLocalMergedUpload {
		useLocalMergedUpload, err = s.shouldUseLocalStagingForOfficialSession(r.Context(), session)
		if err != nil {
			s.logger.Error("decide official upload strategy failed", "error", err.Error(), "session_id", session.ID.String())
			writeError(w, http.StatusInternalServerError, "internal_error", "计算上传策略失败")
			return
		}
	}
	var uploadProcess *videoUploadProcessMeta

	if useLocalMergedUpload {
		mergedPath, mergeErr := s.mergeLocalSessionChunks(session)
		if mergeErr != nil {
			s.logger.Error("merge local staged upload chunks failed", "error", mergeErr.Error(), "session_id", session.ID.String())
			_ = st.SetUploadSessionStatus(r.Context(), session.ID, store.UploadSessionStatusFailed, time.Now())
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
			writeError(w, http.StatusBadGateway, "bad_gateway", "上传结果异常（缺少文件标识）")
			return
		}

		chunk := store.Chunk{
			ID:             uuid.New(),
			ItemID:         session.ItemID,
			ChunkIndex:     0,
			ChunkSize:      int(session.FileSize),
			TGChatID:       s.cfg.TGStorageChatID,
			TGMessageID:    msg.MessageID,
			TGFileID:       resolvedDoc.FileID,
			TGFileUniqueID: resolvedDoc.FileUniqueID,
			CreatedAt:      time.Now(),
		}
		if err := st.InsertChunk(r.Context(), chunk); err != nil {
			if msg.MessageID > 0 {
				_ = s.deleteMessageWithRetry(r.Context(), s.cfg.TGStorageChatID, msg.MessageID)
			}
			s.logger.Error("insert merged chunk failed", "error", err.Error(), "session_id", session.ID.String())
			_ = st.SetUploadSessionStatus(r.Context(), session.ID, store.UploadSessionStatusFailed, time.Now())
			writeError(w, http.StatusInternalServerError, "internal_error", "写入上传元数据失败")
			return
		}
	}

	if err := st.UpdateItemSize(r.Context(), session.ItemID, session.FileSize, time.Now()); err != nil {
		s.logger.Error("update item size failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "更新文件大小失败")
		return
	}
	if err := st.SetUploadSessionStatus(r.Context(), session.ID, store.UploadSessionStatusCompleted, time.Now()); err != nil {
		s.logger.Error("set upload session status failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "更新上传会话状态失败")
		return
	}
	if useLocalMergedUpload {
		if cleanupErr := s.clearLocalUploadSession(session.ID); cleanupErr != nil {
			s.logger.Warn("cleanup local staged upload files failed", "error", cleanupErr.Error(), "session_id", session.ID.String())
		}
	}

	item, err := st.GetItem(r.Context(), session.ItemID)
	if err != nil {
		s.logger.Error("get item failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "查询失败")
		return
	}

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
