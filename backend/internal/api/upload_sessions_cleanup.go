package api

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/const/tg-cloud-drive/backend/internal/store"
)

const (
	expiredUploadSessionCleanupBatchSize = 32
	expiredUploadSessionCleanupMaxRounds = 12
)

func (s *Server) startUploadSessionCleanupLoop() {
	go func() {
		for {
			settings, err := s.getRuntimeSettings(context.Background())
			if err != nil {
				s.logger.Warn("load runtime settings for cleanup failed", "error", err.Error())
				settings = s.defaultRuntimeSettings()
			}

			ttl := uploadSessionTTLFromHours(settings.UploadSessionTTLHours)
			s.runExpiredUploadSessionCleanup(ttl)

			interval := uploadSessionCleanupIntervalFromMins(settings.UploadSessionCleanupIntervalMins)
			time.Sleep(interval)
		}
	}()
}

func uploadSessionTTLFromHours(hours int) time.Duration {
	if hours <= 0 {
		hours = 24
	}
	return time.Duration(hours) * time.Hour
}

func uploadSessionCleanupIntervalFromMins(minutes int) time.Duration {
	if minutes <= 0 {
		minutes = 30
	}
	return time.Duration(minutes) * time.Minute
}

func (s *Server) runExpiredUploadSessionCleanup(ttl time.Duration) {
	s.cleanupMu.Lock()
	if s.cleanupRunning {
		s.cleanupMu.Unlock()
		return
	}
	s.cleanupRunning = true
	s.cleanupMu.Unlock()

	defer func() {
		s.cleanupMu.Lock()
		s.cleanupRunning = false
		s.cleanupMu.Unlock()
	}()

	if ttl <= 0 {
		ttl = 24 * time.Hour
	}
	cutoff := time.Now().Add(-ttl)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	st := store.New(s.db)
	totalCleaned := 0

	for round := 0; round < expiredUploadSessionCleanupMaxRounds; round++ {
		if ctx.Err() != nil {
			break
		}

		sessions, err := st.ListExpiredUploadSessions(ctx, cutoff, expiredUploadSessionCleanupBatchSize)
		if err != nil {
			s.logger.Warn("list expired upload sessions failed", "error", err.Error())
			break
		}
		if len(sessions) == 0 {
			break
		}

		for _, session := range sessions {
			if ctx.Err() != nil {
				break
			}
			if err := s.cleanupExpiredUploadSession(ctx, st, session); err != nil {
				s.logger.Warn(
					"cleanup expired upload session failed",
					"error", err.Error(),
					"session_id", session.ID.String(),
					"item_id", session.ItemID.String(),
				)
				continue
			}
			totalCleaned++
		}

		if len(sessions) < expiredUploadSessionCleanupBatchSize {
			break
		}
	}

	if totalCleaned > 0 {
		s.logger.Info("expired upload sessions cleaned", "count", totalCleaned)
	}
}

func (s *Server) cleanupExpiredUploadSession(ctx context.Context, st *store.Store, session store.UploadSession) error {
	if err := s.clearLocalUploadSession(session.ID); err != nil {
		s.logger.Warn(
			"cleanup expired upload session local files failed",
			"error", err.Error(),
			"session_id", session.ID.String(),
		)
	}

	item, err := st.GetItem(ctx, session.ItemID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			return nil
		}
		return err
	}

	refs, err := st.ListChunkDeleteRefsByPathPrefix(ctx, item.Path)
	if err != nil {
		return err
	}

	for _, ref := range refs {
		chatID := strings.TrimSpace(ref.TGChatID)
		if chatID == "" {
			chatID = s.cfg.TGStorageChatID
		}
		if chatID == "" || ref.TGMessageID <= 0 {
			continue
		}
		if err := s.deleteMessageWithRetry(ctx, chatID, ref.TGMessageID); err != nil {
			s.logger.Warn(
				"delete expired upload chunk message failed",
				"error", err.Error(),
				"chat_id", chatID,
				"message_id", ref.TGMessageID,
				"session_id", session.ID.String(),
			)
		}
	}

	return st.DeleteItemsByPathPrefix(ctx, item.Path)
}
