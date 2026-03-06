package api

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
)

const uploadChunkLockPollInterval = 80 * time.Millisecond

func buildUploadSessionChunkLockKey(sessionID uuid.UUID, chunkIndex int) string {
	return fmt.Sprintf("%s:%d", sessionID.String(), chunkIndex)
}

func (s *Server) acquireUploadSessionChunkLock(ctx context.Context, sessionID uuid.UUID, chunkIndex int) error {
	key := buildUploadSessionChunkLockKey(sessionID, chunkIndex)
	for {
		s.chunkUploadMu.Lock()
		if s.chunkUploadInFlight == nil {
			s.chunkUploadInFlight = map[string]struct{}{}
		}
		if _, exists := s.chunkUploadInFlight[key]; !exists {
			s.chunkUploadInFlight[key] = struct{}{}
			s.chunkUploadMu.Unlock()
			return nil
		}
		s.chunkUploadMu.Unlock()

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(uploadChunkLockPollInterval):
		}
	}
}

func (s *Server) releaseUploadSessionChunkLock(sessionID uuid.UUID, chunkIndex int) {
	key := buildUploadSessionChunkLockKey(sessionID, chunkIndex)
	s.chunkUploadMu.Lock()
	delete(s.chunkUploadInFlight, key)
	s.chunkUploadMu.Unlock()
}
