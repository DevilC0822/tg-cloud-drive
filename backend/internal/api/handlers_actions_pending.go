package api

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/const/tg-cloud-drive/backend/internal/store"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

func (s *Server) handleDeleteItemPermanently(w http.ResponseWriter, r *http.Request) {
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
		s.logger.Error("get item failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "查询失败")
		return
	}

	refs, err := st.ListChunkDeleteRefsByPathPrefix(r.Context(), it.Path)
	if err != nil {
		if errors.Is(err, store.ErrBadInput) {
			writeError(w, http.StatusBadRequest, "bad_request", "路径非法")
			return
		}
		s.logger.Error("list delete refs failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "查询失败")
		return
	}

	// 先尽力删除 Telegram 消息；删除失败记录到表中，但不阻塞本地永久删除（宽松模式）。
	failedDeletes := make([]store.TelegramDeleteFailure, 0)
	for _, ref := range refs {
		if err := s.deleteMessageWithRetry(r.Context(), ref.TGChatID, ref.TGMessageID); err != nil {
			errText := strings.TrimSpace(err.Error())
			s.logger.Warn(
				"delete telegram message failed, will continue local purge",
				"error", errText,
				"item_id", it.ID.String(),
				"item_path", it.Path,
				"message_id", ref.TGMessageID,
			)
			failedDeletes = append(failedDeletes, store.TelegramDeleteFailure{
				ID:          uuid.New(),
				ItemID:      &it.ID,
				ItemPath:    it.Path,
				TGChatID:    ref.TGChatID,
				TGMessageID: ref.TGMessageID,
				Error:       errText,
				FailedAt:    time.Now(),
			})
		}
	}

	if len(failedDeletes) > 0 {
		if err := st.UpsertTelegramDeleteFailures(r.Context(), failedDeletes); err != nil {
			s.logger.Error("record telegram delete failures failed", "error", err.Error(), "count", len(failedDeletes))
		}
	}

	if err := st.DeleteItemsByPathPrefix(r.Context(), it.Path); err != nil {
		s.logger.Error("delete items failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "删除失败")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok": true,
		"telegramCleanup": map[string]any{
			"attempted": len(refs),
			"deleted":   len(refs) - len(failedDeletes),
			"failed":    len(failedDeletes),
		},
	})
}

func (s *Server) handleCopyItem(w http.ResponseWriter, r *http.Request) {
	id, err := parseUUIDParam(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "id 非法")
		return
	}

	var req struct {
		DestinationParentRaw *json.RawMessage `json:"destinationParentId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil && !errors.Is(err, io.EOF) {
		writeError(w, http.StatusBadRequest, "bad_request", "请求体不是合法 JSON")
		return
	}

	st := store.New(s.db)
	src, err := st.GetItem(r.Context(), id)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "文件不存在")
			return
		}
		s.logger.Error("get item failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "查询失败")
		return
	}
	if src.TrashedAt != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "回收站内文件不支持复制，请先还原")
		return
	}

	// destinationParentId: 缺省=原父目录；null=根目录；uuid=目标目录
	destParent := src.ParentID
	if req.DestinationParentRaw != nil {
		raw := bytes.TrimSpace(*req.DestinationParentRaw)
		if bytes.Equal(raw, []byte("null")) {
			destParent = nil
		} else if len(raw) > 0 {
			var sID string
			if err := json.Unmarshal(raw, &sID); err != nil {
				writeError(w, http.StatusBadRequest, "bad_request", "destinationParentId 非法")
				return
			}
			parsed, err := uuid.Parse(strings.TrimSpace(sID))
			if err != nil {
				writeError(w, http.StatusBadRequest, "bad_request", "destinationParentId 非法")
				return
			}
			destParent = &parsed
		}
	}

	if destParent != nil {
		parent, err := st.GetItem(r.Context(), *destParent)
		if err != nil {
			if errors.Is(err, store.ErrNotFound) {
				writeError(w, http.StatusBadRequest, "bad_request", "目标目录不存在")
				return
			}
			s.logger.Error("get dest parent failed", "error", err.Error())
			writeError(w, http.StatusInternalServerError, "internal_error", "查询失败")
			return
		}
		if parent.TrashedAt != nil || parent.Type != store.ItemTypeFolder {
			writeError(w, http.StatusBadRequest, "bad_request", "目标目录不可用")
			return
		}
	}

	now := time.Now()

	if src.Type != store.ItemTypeFolder {
		newItem, err := st.CreateFileItem(r.Context(), destParent, src.Type, nameWithCopySuffix(src.Name), src.Size, src.MimeType, now)
		if err != nil {
			if errors.Is(err, store.ErrBadInput) {
				writeError(w, http.StatusBadRequest, "bad_request", "目标目录不可用")
				return
			}
			if errors.Is(err, store.ErrConflict) {
				writeError(w, http.StatusConflict, "conflict", "同一目录下已存在同名文件或文件夹")
				return
			}
			s.logger.Error("create file item failed", "error", err.Error())
			writeError(w, http.StatusInternalServerError, "internal_error", "复制失败")
			return
		}

		// 拷贝分块：使用 file_id 重新 sendDocument，不重新上传字节
		srcChunks, err := st.ListChunks(r.Context(), src.ID)
		if err != nil {
			_ = st.DeleteItemsByPathPrefix(r.Context(), newItem.Path)
			s.logger.Error("list chunks failed", "error", err.Error())
			writeError(w, http.StatusInternalServerError, "internal_error", "复制失败")
			return
		}

		var createdRefs []store.ChunkDeleteRef
		cleanup := func(ctx context.Context) {
			for _, ref := range createdRefs {
				_ = s.deleteMessageWithRetry(ctx, ref.TGChatID, ref.TGMessageID)
			}
			_ = st.DeleteItemsByPathPrefix(ctx, newItem.Path)
		}

		for _, c := range srcChunks {
			caption := fmt.Sprintf("tgcd-copy:%s:%d", newItem.ID.String(), c.ChunkIndex)
			msg, err := s.sendDocumentByFileIDWithRetry(r.Context(), s.cfg.TGStorageChatID, c.TGFileID, caption)
			if err != nil {
				s.logger.Error("sendDocument(file_id) failed", "error", err.Error())
				cleanup(r.Context())
				writeError(w, http.StatusBadGateway, "bad_gateway", "复制到 Telegram 失败")
				return
			}
			resolvedDoc, docErr := s.resolveMessageDocument(r.Context(), msg)
			if docErr != nil {
				s.logger.Error(
					"sendDocument(file_id) missing file_id",
					"src_item_id", src.ID.String(),
					"chunk_index", c.ChunkIndex,
					"message_id", msg.MessageID,
					"error", docErr.Error(),
				)
				if msg.MessageID > 0 {
					_ = s.deleteMessageWithRetry(r.Context(), s.cfg.TGStorageChatID, msg.MessageID)
				}
				cleanup(r.Context())
				writeError(w, http.StatusBadGateway, "bad_gateway", "复制结果异常（缺少文件标识）")
				return
			}

			createdRefs = append(createdRefs, store.ChunkDeleteRef{TGChatID: s.cfg.TGStorageChatID, TGMessageID: msg.MessageID})

			chunkSize := c.ChunkSize
			if resolvedDoc.FileSize > 0 && resolvedDoc.FileSize < int64(^uint(0)>>1) {
				chunkSize = int(resolvedDoc.FileSize)
			}
			if err := st.InsertChunk(r.Context(), store.Chunk{
				ID:             uuid.New(),
				ItemID:         newItem.ID,
				ChunkIndex:     c.ChunkIndex,
				ChunkSize:      chunkSize,
				TGChatID:       s.cfg.TGStorageChatID,
				TGMessageID:    msg.MessageID,
				TGFileID:       resolvedDoc.FileID,
				TGFileUniqueID: resolvedDoc.FileUniqueID,
				CreatedAt:      now,
			}); err != nil {
				s.logger.Error("insert chunk failed", "error", err.Error())
				cleanup(r.Context())
				writeError(w, http.StatusInternalServerError, "internal_error", "写入分块元数据失败")
				return
			}
		}

		writeJSON(w, http.StatusOK, map[string]any{"item": toItemDTO(newItem)})
		return
	}

	// 文件夹复制：先读取子树快照，再创建新根目录，避免“复制到自身/子目录”时把新目录也扫进来。
	subtree, err := st.ListSubtreeItems(r.Context(), src.Path)
	if err != nil {
		if errors.Is(err, store.ErrBadInput) {
			writeError(w, http.StatusBadRequest, "bad_request", "路径非法")
			return
		}
		s.logger.Error("list subtree failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "复制失败")
		return
	}

	newRoot, err := st.CreateFolder(r.Context(), destParent, nameWithCopySuffix(src.Name), now)
	if err != nil {
		if errors.Is(err, store.ErrBadInput) {
			writeError(w, http.StatusBadRequest, "bad_request", "目标目录不可用")
			return
		}
		if errors.Is(err, store.ErrConflict) {
			writeError(w, http.StatusConflict, "conflict", "同一目录下已存在同名文件或文件夹")
			return
		}
		s.logger.Error("create folder failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "复制失败")
		return
	}

	var createdRefs []store.ChunkDeleteRef
	cleanupTree := func(ctx context.Context) {
		for _, ref := range createdRefs {
			_ = s.deleteMessageWithRetry(ctx, ref.TGChatID, ref.TGMessageID)
		}
		_ = st.DeleteItemsByPathPrefix(ctx, newRoot.Path)
	}

	idMap := map[uuid.UUID]uuid.UUID{
		src.ID: newRoot.ID,
	}

	for _, node := range subtree {
		if node.ID == src.ID {
			continue
		}
		if node.ParentID == nil {
			cleanupTree(r.Context())
			writeError(w, http.StatusInternalServerError, "internal_error", "目录结构异常")
			return
		}

		mappedParent, ok := idMap[*node.ParentID]
		if !ok {
			cleanupTree(r.Context())
			writeError(w, http.StatusInternalServerError, "internal_error", "目录结构异常")
			return
		}

		rel := strings.TrimPrefix(node.Path, src.Path)
		if rel == "" || !strings.HasPrefix(rel, "/") {
			cleanupTree(r.Context())
			writeError(w, http.StatusInternalServerError, "internal_error", "路径计算失败")
			return
		}
		newPath := strings.TrimRight(newRoot.Path, "/") + rel

		newID := uuid.New()
		parentID := mappedParent
		if err := st.InsertItemRaw(r.Context(), store.InsertItemRawInput{
			ID:        newID,
			Type:      node.Type,
			Name:      node.Name,
			ParentID:  &parentID,
			Path:      newPath,
			Size:      node.Size,
			MimeType:  node.MimeType,
			CreatedAt: now,
			UpdatedAt: now,
		}); err != nil {
			s.logger.Error("insert item raw failed", "error", err.Error())
			cleanupTree(r.Context())
			writeError(w, http.StatusInternalServerError, "internal_error", "复制失败")
			return
		}
		idMap[node.ID] = newID

		if node.Type == store.ItemTypeFolder {
			continue
		}

		srcChunks, err := st.ListChunks(r.Context(), node.ID)
		if err != nil {
			s.logger.Error("list chunks failed", "error", err.Error())
			cleanupTree(r.Context())
			writeError(w, http.StatusInternalServerError, "internal_error", "复制失败")
			return
		}
		for _, c := range srcChunks {
			caption := fmt.Sprintf("tgcd-copy:%s:%d", newID.String(), c.ChunkIndex)
			msg, err := s.sendDocumentByFileIDWithRetry(r.Context(), s.cfg.TGStorageChatID, c.TGFileID, caption)
			if err != nil {
				s.logger.Error("sendDocument(file_id) failed", "error", err.Error())
				cleanupTree(r.Context())
				writeError(w, http.StatusBadGateway, "bad_gateway", "复制到 Telegram 失败")
				return
			}
			resolvedDoc, docErr := s.resolveMessageDocument(r.Context(), msg)
			if docErr != nil {
				s.logger.Error(
					"sendDocument(file_id) missing file_id",
					"src_item_id", node.ID.String(),
					"chunk_index", c.ChunkIndex,
					"message_id", msg.MessageID,
					"error", docErr.Error(),
				)
				if msg.MessageID > 0 {
					_ = s.deleteMessageWithRetry(r.Context(), s.cfg.TGStorageChatID, msg.MessageID)
				}
				cleanupTree(r.Context())
				writeError(w, http.StatusBadGateway, "bad_gateway", "复制结果异常（缺少文件标识）")
				return
			}

			createdRefs = append(createdRefs, store.ChunkDeleteRef{TGChatID: s.cfg.TGStorageChatID, TGMessageID: msg.MessageID})

			chunkSize := c.ChunkSize
			if resolvedDoc.FileSize > 0 && resolvedDoc.FileSize < int64(^uint(0)>>1) {
				chunkSize = int(resolvedDoc.FileSize)
			}
			if err := st.InsertChunk(r.Context(), store.Chunk{
				ID:             uuid.New(),
				ItemID:         newID,
				ChunkIndex:     c.ChunkIndex,
				ChunkSize:      chunkSize,
				TGChatID:       s.cfg.TGStorageChatID,
				TGMessageID:    msg.MessageID,
				TGFileID:       resolvedDoc.FileID,
				TGFileUniqueID: resolvedDoc.FileUniqueID,
				CreatedAt:      now,
			}); err != nil {
				s.logger.Error("insert chunk failed", "error", err.Error())
				cleanupTree(r.Context())
				writeError(w, http.StatusInternalServerError, "internal_error", "写入分块元数据失败")
				return
			}
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{"item": toItemDTO(newRoot)})
}

func nameWithCopySuffix(original string) string {
	name := strings.TrimSpace(original)
	if name == "" {
		return "副本"
	}

	// 文件名：插在扩展名前；目录：直接追加
	dot := strings.LastIndex(name, ".")
	if dot > 0 && dot < len(name)-1 {
		return name[:dot] + " 副本" + name[dot:]
	}
	return name + " 副本"
}
