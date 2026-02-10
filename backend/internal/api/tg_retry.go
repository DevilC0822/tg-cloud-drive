package api

import (
	"context"
	"errors"
	"time"

	"github.com/const/tg-cloud-drive/backend/internal/telegram"
)

func (s *Server) sendDocumentByFileIDWithRetry(ctx context.Context, chatID string, fileID string, caption string) (telegram.Message, error) {
	tgClient := s.telegramClient()
	if tgClient == nil {
		return telegram.Message{}, errors.New("telegram 客户端未初始化")
	}
	var lastErr error
	for attempt := 0; attempt < 6; attempt++ {
		msg, err := tgClient.SendDocumentByFileID(ctx, chatID, fileID, caption)
		if err == nil {
			return msg, nil
		}
		lastErr = err

		var ra telegram.RetryAfterError
		if errors.As(err, &ra) {
			if sleepErr := sleepWithContext(ctx, ra.After); sleepErr != nil {
				return telegram.Message{}, sleepErr
			}
			continue
		}

		backoff := time.Duration(attempt+1) * 400 * time.Millisecond
		if sleepErr := sleepWithContext(ctx, backoff); sleepErr != nil {
			return telegram.Message{}, sleepErr
		}
	}
	return telegram.Message{}, lastErr
}

func (s *Server) sendPhotoByFileIDWithRetry(ctx context.Context, chatID string, fileID string, caption string, hasSpoiler bool) (telegram.Message, error) {
	tgClient := s.telegramClient()
	if tgClient == nil {
		return telegram.Message{}, errors.New("telegram 客户端未初始化")
	}
	var lastErr error
	for attempt := 0; attempt < 6; attempt++ {
		msg, err := tgClient.SendPhotoByFileID(ctx, chatID, fileID, caption, hasSpoiler)
		if err == nil {
			return msg, nil
		}
		lastErr = err

		var ra telegram.RetryAfterError
		if errors.As(err, &ra) {
			if sleepErr := sleepWithContext(ctx, ra.After); sleepErr != nil {
				return telegram.Message{}, sleepErr
			}
			continue
		}

		backoff := time.Duration(attempt+1) * 400 * time.Millisecond
		if sleepErr := sleepWithContext(ctx, backoff); sleepErr != nil {
			return telegram.Message{}, sleepErr
		}
	}
	return telegram.Message{}, lastErr
}

func (s *Server) sendVideoByFileIDWithRetry(ctx context.Context, chatID string, fileID string, caption string, hasSpoiler bool) (telegram.Message, error) {
	tgClient := s.telegramClient()
	if tgClient == nil {
		return telegram.Message{}, errors.New("telegram 客户端未初始化")
	}
	var lastErr error
	for attempt := 0; attempt < 6; attempt++ {
		msg, err := tgClient.SendVideoByFileID(ctx, chatID, fileID, caption, hasSpoiler)
		if err == nil {
			return msg, nil
		}
		lastErr = err

		var ra telegram.RetryAfterError
		if errors.As(err, &ra) {
			if sleepErr := sleepWithContext(ctx, ra.After); sleepErr != nil {
				return telegram.Message{}, sleepErr
			}
			continue
		}

		backoff := time.Duration(attempt+1) * 400 * time.Millisecond
		if sleepErr := sleepWithContext(ctx, backoff); sleepErr != nil {
			return telegram.Message{}, sleepErr
		}
	}
	return telegram.Message{}, lastErr
}

func (s *Server) sendAnimationByFileIDWithRetry(ctx context.Context, chatID string, fileID string, caption string, hasSpoiler bool) (telegram.Message, error) {
	tgClient := s.telegramClient()
	if tgClient == nil {
		return telegram.Message{}, errors.New("telegram 客户端未初始化")
	}
	var lastErr error
	for attempt := 0; attempt < 6; attempt++ {
		msg, err := tgClient.SendAnimationByFileID(ctx, chatID, fileID, caption, hasSpoiler)
		if err == nil {
			return msg, nil
		}
		lastErr = err

		var ra telegram.RetryAfterError
		if errors.As(err, &ra) {
			if sleepErr := sleepWithContext(ctx, ra.After); sleepErr != nil {
				return telegram.Message{}, sleepErr
			}
			continue
		}

		backoff := time.Duration(attempt+1) * 400 * time.Millisecond
		if sleepErr := sleepWithContext(ctx, backoff); sleepErr != nil {
			return telegram.Message{}, sleepErr
		}
	}
	return telegram.Message{}, lastErr
}

func (s *Server) forwardMessageWithRetry(ctx context.Context, toChatID string, fromChatID string, messageID int64) (telegram.Message, error) {
	tgClient := s.telegramClient()
	if tgClient == nil {
		return telegram.Message{}, errors.New("telegram 客户端未初始化")
	}
	var lastErr error
	for attempt := 0; attempt < 6; attempt++ {
		msg, err := tgClient.ForwardMessage(ctx, toChatID, fromChatID, messageID)
		if err == nil {
			return msg, nil
		}
		lastErr = err

		var ra telegram.RetryAfterError
		if errors.As(err, &ra) {
			if sleepErr := sleepWithContext(ctx, ra.After); sleepErr != nil {
				return telegram.Message{}, sleepErr
			}
			continue
		}

		backoff := time.Duration(attempt+1) * 400 * time.Millisecond
		if sleepErr := sleepWithContext(ctx, backoff); sleepErr != nil {
			return telegram.Message{}, sleepErr
		}
	}
	return telegram.Message{}, lastErr
}
