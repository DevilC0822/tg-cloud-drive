package api

import (
	"context"
	"time"

	"github.com/google/uuid"
	"tg-cloud-drive-api/internal/store"
)

type transferStreamEvent struct {
	Type  string               `json:"type"`
	ID    *string              `json:"id,omitempty"`
	Item  *transferJobViewDTO  `json:"item,omitempty"`
	Items []transferJobViewDTO `json:"items,omitempty"`
}

type downloadTransferProgress struct {
	JobID        uuid.UUID
	ItemID       uuid.UUID
	TotalSize    int64
	WrittenBytes int64
	UpdatedAt    time.Time
}

type uploadTransferRuntimeState struct {
	PhaseDetail         string
	ProgressCurrent     int64
	ProgressTotal       int64
	ProgressUnit        string
	ProgressMode        string
	SpeedBytesPerSecond int64
	PhaseStartedAt      time.Time
	UpdatedAt           time.Time
}

func (s *Server) subscribeTransferEvents() (uint64, chan transferStreamEvent) {
	id := s.transferSubscriberSeq.Add(1)
	ch := make(chan transferStreamEvent, 32)

	s.transferEventsMu.Lock()
	s.transferSubscribers[id] = ch
	s.transferEventsMu.Unlock()
	return id, ch
}

func (s *Server) unsubscribeTransferEvents(id uint64) {
	s.transferEventsMu.Lock()
	ch, ok := s.transferSubscribers[id]
	if ok {
		delete(s.transferSubscribers, id)
		close(ch)
	}
	s.transferEventsMu.Unlock()
}

func (s *Server) publishTransferEvent(event transferStreamEvent) {
	s.transferEventsMu.RLock()
	defer s.transferEventsMu.RUnlock()

	for _, ch := range s.transferSubscribers {
		select {
		case ch <- event:
		default:
		}
	}
}

func (s *Server) setDownloadTransferProgress(
	jobID uuid.UUID,
	itemID uuid.UUID,
	totalSize int64,
	writtenBytes int64,
) {
	s.downloadProgressMu.Lock()
	s.downloadProgress[jobID] = downloadTransferProgress{
		JobID:        jobID,
		ItemID:       itemID,
		TotalSize:    totalSize,
		WrittenBytes: writtenBytes,
		UpdatedAt:    time.Now(),
	}
	s.downloadProgressMu.Unlock()
}

func (s *Server) getDownloadTransferProgress(jobID uuid.UUID) (downloadTransferProgress, bool) {
	s.downloadProgressMu.RLock()
	progress, ok := s.downloadProgress[jobID]
	s.downloadProgressMu.RUnlock()
	return progress, ok
}

func (s *Server) clearDownloadTransferProgress(jobID uuid.UUID) {
	s.downloadProgressMu.Lock()
	delete(s.downloadProgress, jobID)
	s.downloadProgressMu.Unlock()
}

func (s *Server) setUploadSessionRuntimeState(sessionID uuid.UUID, state uploadTransferRuntimeState) {
	s.uploadRuntimeMu.Lock()
	if state.UpdatedAt.IsZero() {
		state.UpdatedAt = time.Now()
	}
	prev, ok := s.uploadRuntime[sessionID]
	if state.PhaseStartedAt.IsZero() {
		if ok && prev.PhaseDetail == state.PhaseDetail && prev.ProgressMode == state.ProgressMode && !prev.PhaseStartedAt.IsZero() {
			state.PhaseStartedAt = prev.PhaseStartedAt
		} else {
			state.PhaseStartedAt = state.UpdatedAt
		}
	}
	s.uploadRuntime[sessionID] = state
	s.uploadRuntimeMu.Unlock()
}

func (s *Server) getUploadSessionRuntime(sessionID uuid.UUID) (uploadTransferRuntimeState, bool) {
	s.uploadRuntimeMu.RLock()
	state, ok := s.uploadRuntime[sessionID]
	s.uploadRuntimeMu.RUnlock()
	return state, ok
}

func (s *Server) clearUploadSessionRuntime(sessionID uuid.UUID) {
	s.uploadRuntimeMu.Lock()
	delete(s.uploadRuntime, sessionID)
	s.uploadRuntimeMu.Unlock()
}

func (s *Server) resolveUploadTransferJobID(ctx context.Context, session store.UploadSession) (uuid.UUID, bool) {
	if session.TransferBatchID != nil {
		return *session.TransferBatchID, true
	}

	job, err := store.New(s.db).GetTransferJobBySource(
		ctx,
		store.TransferDirectionUpload,
		store.TransferSourceKindUploadSession,
		buildUploadSessionTransferSourceRef(session.ID),
	)
	if err != nil {
		return uuid.Nil, false
	}
	return job.ID, true
}

func (s *Server) syncUploadTransferRuntimeStateBySession(
	ctx context.Context,
	session store.UploadSession,
	state uploadTransferRuntimeState,
) {
	jobID, ok := s.resolveUploadTransferJobID(ctx, session)
	if !ok || state.PhaseDetail == "" {
		return
	}

	s.setUploadSessionRuntimeState(session.ID, state)
	s.syncTransferJobByID(ctx, jobID)
}

func (s *Server) setUploadTransferPhaseDetailBySession(ctx context.Context, session store.UploadSession, phaseDetail string) {
	s.syncUploadTransferRuntimeStateBySession(ctx, session, uploadTransferRuntimeState{
		PhaseDetail:  phaseDetail,
		ProgressMode: resolveUploadPhaseProgressMode(phaseDetail),
	})
}

func (s *Server) clearUploadTransferRuntimeBySession(ctx context.Context, session store.UploadSession) {
	_ = ctx
	s.clearUploadSessionRuntime(session.ID)
}
