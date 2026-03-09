package api

import (
	"context"
	"errors"
	"time"

	"tg-cloud-drive-api/internal/store"
)

func (s *Server) syncUploadSessionProgressState(
	ctx context.Context,
	session store.UploadSession,
	uploadedCount int,
) {
	now := time.Now()
	clamped := clampUploadedChunks(uploadedCount, session.TotalChunks)
	st := store.New(s.db)

	if err := st.SetUploadSessionProgress(ctx, session.ID, clamped, now); err != nil && !errors.Is(err, store.ErrNotFound) {
		s.logger.Warn("set upload session progress failed", "error", err.Error(), "session_id", session.ID.String())
	}
	if session.TransferBatchID != nil {
		status := resolveUploadFolderEntryStatus(session.Status, clamped, session.TotalChunks)
		if err := st.SetUploadFolderEntryStatusBySessionID(ctx, session.ID, status, nil, now); err != nil && !errors.Is(err, store.ErrNotFound) {
			s.logger.Warn("set upload folder entry progress failed", "error", err.Error(), "session_id", session.ID.String())
		}
	}

	session.UploadedChunks = clamped
	session.UpdatedAt = now
	s.syncUploadSessionProgressEvent(ctx, session)
}

func (s *Server) markUploadSessionFailed(
	ctx context.Context,
	session store.UploadSession,
	errText string,
) {
	now := time.Now()
	st := store.New(s.db)
	trimmed := stringPointerOrNil(errText)
	if err := st.SetUploadSessionStatus(ctx, session.ID, store.UploadSessionStatusFailed, now); err != nil && !errors.Is(err, store.ErrNotFound) {
		s.logger.Warn("set upload session failed status failed", "error", err.Error(), "session_id", session.ID.String())
	}
	if err := st.SetUploadSessionProgress(ctx, session.ID, clampUploadedChunks(session.UploadedChunks, session.TotalChunks), now); err != nil && !errors.Is(err, store.ErrNotFound) {
		s.logger.Warn("persist upload session failed progress failed", "error", err.Error(), "session_id", session.ID.String())
	}
	if session.TransferBatchID != nil {
		if err := st.SetUploadFolderEntryStatusBySessionID(ctx, session.ID, store.UploadFolderEntryStatusFailed, trimmed, now); err != nil && !errors.Is(err, store.ErrNotFound) {
			s.logger.Warn("set upload folder entry failed status failed", "error", err.Error(), "session_id", session.ID.String())
		}
	}
}

func resolveUploadFolderEntryStatus(
	status store.UploadSessionStatus,
	uploadedCount int,
	totalChunks int,
) store.UploadFolderEntryStatus {
	if status == store.UploadSessionStatusFailed {
		return store.UploadFolderEntryStatusFailed
	}
	if status == store.UploadSessionStatusCompleted {
		return store.UploadFolderEntryStatusCompleted
	}
	if uploadedCount > 0 {
		return store.UploadFolderEntryStatusUploading
	}
	return store.UploadFolderEntryStatusPending
}

func clampUploadedChunks(uploadedCount int, totalChunks int) int {
	if uploadedCount < 0 {
		return 0
	}
	if totalChunks > 0 && uploadedCount > totalChunks {
		return totalChunks
	}
	return uploadedCount
}
