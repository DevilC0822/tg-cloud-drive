package api

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"tg-cloud-drive-api/internal/store"
)

func (s *Server) handleDeleteActiveTransfer(w http.ResponseWriter, r *http.Request) {
	transferID, err := parseUUIDParam(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "id 非法")
		return
	}

	st := store.New(s.db)
	job, err := st.GetTransferJobByID(r.Context(), transferID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "传输任务不存在")
			return
		}
		s.logger.Error("get transfer job failed", "error", err.Error(), "id", transferID.String())
		writeError(w, http.StatusInternalServerError, "internal_error", "读取传输任务失败")
		return
	}
	if job.Status != store.TransferJobStatusRunning {
		writeError(w, http.StatusConflict, "conflict", "仅运行中的任务支持删除")
		return
	}
	if job.Direction != store.TransferDirectionUpload {
		writeError(w, http.StatusBadRequest, "bad_request", "暂不支持删除非上传任务")
		return
	}
	if job.SourceKind != store.TransferSourceKindUploadSession && job.SourceKind != store.TransferSourceKindUploadBatch {
		writeError(w, http.StatusBadRequest, "bad_request", "暂不支持删除该类型的上传任务")
		return
	}

	cleanup, err := s.deleteRunningUploadTransfer(r.Context(), st, job)
	if err != nil {
		s.logger.Error("delete running transfer failed", "error", err.Error(), "id", transferID.String())
		writeError(w, http.StatusInternalServerError, "internal_error", "删除传输任务失败")
		return
	}
	if len(cleanup.failures) > 0 {
		if upsertErr := st.UpsertTelegramDeleteFailures(r.Context(), cleanup.failures); upsertErr != nil {
			s.logger.Error("record telegram delete failures failed", "error", upsertErr.Error(), "count", len(cleanup.failures))
		}
	}

	if err := st.DeleteTransferJobByID(r.Context(), transferID); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "传输任务不存在")
			return
		}
		s.logger.Error("delete transfer job failed", "error", err.Error(), "id", transferID.String())
		writeError(w, http.StatusInternalServerError, "internal_error", "删除传输任务失败")
		return
	}
	s.publishTransferDeletion(transferID)

	writeJSON(w, http.StatusOK, map[string]any{
		"ok": true,
		"telegramCleanup": map[string]any{
			"attempted": cleanup.stats.Attempted,
			"deleted":   cleanup.stats.Deleted,
			"replaced":  cleanup.stats.Replaced,
			"failed":    cleanup.stats.Failed,
			"errors":    buildTelegramCleanupFailureDetails(cleanup.failures),
		},
	})
}

func (s *Server) deleteRunningUploadTransfer(
	ctx context.Context,
	st *store.Store,
	job store.TransferJob,
) (telegramCleanupResult, error) {
	switch job.SourceKind {
	case store.TransferSourceKindUploadSession:
		return s.deleteUploadSessionTransfer(ctx, st, job)
	case store.TransferSourceKindUploadBatch:
		return s.deleteUploadBatchTransfer(ctx, st, job)
	default:
		return telegramCleanupResult{}, errors.New("unsupported source kind: " + strings.TrimSpace(string(job.SourceKind)))
	}
}

func (s *Server) deleteUploadSessionTransfer(
	ctx context.Context,
	st *store.Store,
	job store.TransferJob,
) (telegramCleanupResult, error) {
	sessionID, err := uuid.Parse(strings.TrimSpace(job.SourceRef))
	if err != nil {
		return telegramCleanupResult{}, err
	}

	session, err := st.GetUploadSession(ctx, sessionID)
	if err != nil && !errors.Is(err, store.ErrNotFound) {
		return telegramCleanupResult{}, err
	}
	if err := deleteUploadSessionIfExists(ctx, st, sessionID); err != nil {
		return telegramCleanupResult{}, err
	}
	if err := s.clearLocalUploadSession(sessionID); err != nil {
		return telegramCleanupResult{}, err
	}

	itemID := resolveUploadSessionTargetItemID(job, session)
	if itemID == uuid.Nil {
		return telegramCleanupResult{}, nil
	}
	return s.purgeItemTree(ctx, st, itemID)
}

func (s *Server) deleteUploadBatchTransfer(
	ctx context.Context,
	st *store.Store,
	job store.TransferJob,
) (telegramCleanupResult, error) {
	batchID, err := uuid.Parse(strings.TrimSpace(job.SourceRef))
	if err != nil {
		return telegramCleanupResult{}, err
	}

	sessions, err := st.ListUploadSessionsByBatch(ctx, batchID)
	if err != nil {
		return telegramCleanupResult{}, err
	}
	rootItemID, err := resolveFolderUploadRootItemID(ctx, st, batchID)
	if err != nil {
		return telegramCleanupResult{}, err
	}

	for _, session := range sessions {
		if err := deleteUploadSessionIfExists(ctx, st, session.ID); err != nil {
			return telegramCleanupResult{}, err
		}
		if err := s.clearLocalUploadSession(session.ID); err != nil {
			return telegramCleanupResult{}, err
		}
	}

	if rootItemID != uuid.Nil {
		return s.purgeItemTree(ctx, st, rootItemID)
	}
	return s.purgeUploadBatchItems(ctx, st, sessions)
}

func resolveUploadSessionTargetItemID(job store.TransferJob, session store.UploadSession) uuid.UUID {
	if session.ID != uuid.Nil && session.ItemID != uuid.Nil {
		return session.ItemID
	}
	if job.TargetItemID != nil {
		return *job.TargetItemID
	}
	return uuid.Nil
}

func resolveFolderUploadRootItemID(ctx context.Context, st *store.Store, batchID uuid.UUID) (uuid.UUID, error) {
	batch, err := st.GetUploadFolderBatch(ctx, batchID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			return uuid.Nil, nil
		}
		return uuid.Nil, err
	}
	return batch.RootItemID, nil
}

func deleteUploadSessionIfExists(ctx context.Context, st *store.Store, sessionID uuid.UUID) error {
	if sessionID == uuid.Nil {
		return nil
	}
	if err := st.DeleteUploadSessionByID(ctx, sessionID); err != nil && !errors.Is(err, store.ErrNotFound) {
		return err
	}
	return nil
}

func (s *Server) purgeUploadBatchItems(
	ctx context.Context,
	st *store.Store,
	sessions []store.UploadSession,
) (telegramCleanupResult, error) {
	seen := make(map[uuid.UUID]struct{}, len(sessions))
	merged := telegramCleanupResult{}
	for _, session := range sessions {
		itemID := session.ItemID
		if itemID == uuid.Nil {
			continue
		}
		if _, ok := seen[itemID]; ok {
			continue
		}
		seen[itemID] = struct{}{}

		result, err := s.purgeItemTree(ctx, st, itemID)
		if err != nil {
			return telegramCleanupResult{}, err
		}
		merged = mergeTelegramCleanupResult(merged, result)
	}
	return merged, nil
}

func (s *Server) purgeItemTree(
	ctx context.Context,
	st *store.Store,
	itemID uuid.UUID,
) (telegramCleanupResult, error) {
	if itemID == uuid.Nil {
		return telegramCleanupResult{}, nil
	}
	item, err := st.GetItem(ctx, itemID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			return telegramCleanupResult{}, nil
		}
		return telegramCleanupResult{}, err
	}
	refs, err := st.ListChunkDeleteRefsByPathPrefix(ctx, item.Path)
	if err != nil {
		return telegramCleanupResult{}, err
	}
	cleanup := s.cleanupTelegramMessages(ctx, item, refs)
	if err := st.DeleteItemsByPathPrefix(ctx, item.Path); err != nil {
		return telegramCleanupResult{}, err
	}
	return cleanup, nil
}

func mergeTelegramCleanupResult(left telegramCleanupResult, right telegramCleanupResult) telegramCleanupResult {
	left.stats.Attempted += right.stats.Attempted
	left.stats.Deleted += right.stats.Deleted
	left.stats.Replaced += right.stats.Replaced
	left.stats.Failed += right.stats.Failed
	left.failures = append(left.failures, right.failures...)
	return left
}

func buildTelegramCleanupFailureDetails(failures []store.TelegramDeleteFailure) []map[string]any {
	if len(failures) == 0 {
		return nil
	}
	out := make([]map[string]any, 0, len(failures))
	for _, f := range failures {
		out = append(out, map[string]any{
			"chatId":    f.TGChatID,
			"messageId": f.TGMessageID,
			"error":     f.Error,
		})
	}
	return out
}
