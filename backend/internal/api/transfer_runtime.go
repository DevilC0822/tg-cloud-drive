package api

import (
	"time"

	"github.com/google/uuid"
)

type transferStreamEvent struct {
	Type string              `json:"type"`
	ID   *string             `json:"id,omitempty"`
	Item *transferJobViewDTO `json:"item,omitempty"`
}

type downloadTransferProgress struct {
	JobID        uuid.UUID
	ItemID       uuid.UUID
	TotalSize    int64
	WrittenBytes int64
	UpdatedAt    time.Time
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
