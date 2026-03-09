package api

import (
	"context"
	"errors"
	"math/rand/v2"
	"time"

	"tg-cloud-drive-api/internal/telegram"
)

const (
	telegramRetryMaxAttempts = 6
	telegramRetryBaseDelay   = 400 * time.Millisecond
	telegramRetryMaxDelay    = 5 * time.Second
	telegramRetryJitterMax   = 250 * time.Millisecond
)

type telegramRetryPolicy struct {
	MaxAttempts int
	BaseDelay   time.Duration
	MaxDelay    time.Duration
	JitterMax   time.Duration
}

func defaultTelegramRetryPolicy() telegramRetryPolicy {
	return telegramRetryPolicy{
		MaxAttempts: telegramRetryMaxAttempts,
		BaseDelay:   telegramRetryBaseDelay,
		MaxDelay:    telegramRetryMaxDelay,
		JitterMax:   telegramRetryJitterMax,
	}
}

func (s *Server) requireTelegramClient() (*telegram.Client, error) {
	tgClient := s.telegramClient()
	if tgClient == nil {
		return nil, errors.New("telegram 客户端未初始化")
	}
	return tgClient, nil
}

func (s *Server) sendDocumentByFileIDWithRetry(ctx context.Context, chatID string, fileID string, caption string) (telegram.Message, error) {
	tgClient, err := s.requireTelegramClient()
	if err != nil {
		return telegram.Message{}, err
	}
	return retryTelegramMessageSend(ctx, func() (telegram.Message, error) {
		return tgClient.SendDocumentByFileID(ctx, chatID, fileID, caption)
	})
}

func (s *Server) forwardMessageWithRetry(ctx context.Context, toChatID string, fromChatID string, messageID int64) (telegram.Message, error) {
	tgClient, err := s.requireTelegramClient()
	if err != nil {
		return telegram.Message{}, err
	}
	return retryTelegramMessageSend(ctx, func() (telegram.Message, error) {
		return tgClient.ForwardMessage(ctx, toChatID, fromChatID, messageID)
	})
}

func retryTelegramMessageSend(ctx context.Context, fn func() (telegram.Message, error)) (telegram.Message, error) {
	return retryTelegramCall(ctx, defaultTelegramRetryPolicy(), fn)
}

func retryTelegramAction(ctx context.Context, fn func() error) error {
	_, err := retryTelegramCall(ctx, defaultTelegramRetryPolicy(), func() (struct{}, error) {
		if callErr := fn(); callErr != nil {
			return struct{}{}, callErr
		}
		return struct{}{}, nil
	})
	return err
}

func retryTelegramCall[T any](ctx context.Context, policy telegramRetryPolicy, fn func() (T, error)) (T, error) {
	var zero T
	cfg := normalizeTelegramRetryPolicy(policy)
	var lastErr error
	for attempt := 0; attempt < cfg.MaxAttempts; attempt++ {
		value, err := fn()
		if err == nil {
			return value, nil
		}
		lastErr = err
		if attempt == cfg.MaxAttempts-1 {
			return zero, lastErr
		}

		delay := resolveTelegramRetryDelay(err, attempt, cfg)
		if sleepErr := sleepWithContext(ctx, delay); sleepErr != nil {
			return zero, sleepErr
		}
	}
	return zero, lastErr
}

func normalizeTelegramRetryPolicy(policy telegramRetryPolicy) telegramRetryPolicy {
	if policy.MaxAttempts <= 0 {
		policy.MaxAttempts = telegramRetryMaxAttempts
	}
	if policy.BaseDelay <= 0 {
		policy.BaseDelay = telegramRetryBaseDelay
	}
	if policy.MaxDelay < policy.BaseDelay {
		policy.MaxDelay = telegramRetryMaxDelay
	}
	if policy.JitterMax < 0 {
		policy.JitterMax = 0
	}
	return policy
}

func resolveTelegramRetryDelay(err error, attempt int, policy telegramRetryPolicy) time.Duration {
	var ra telegram.RetryAfterError
	if errors.As(err, &ra) && ra.After > 0 {
		return ra.After + telegramRetryJitter(policy.JitterMax)
	}
	return telegramRetryBackoff(attempt, policy)
}

func telegramRetryBackoff(attempt int, policy telegramRetryPolicy) time.Duration {
	if attempt < 0 {
		attempt = 0
	}
	delay := policy.BaseDelay
	for idx := 0; idx < attempt; idx++ {
		delay *= 2
		if delay >= policy.MaxDelay {
			delay = policy.MaxDelay
			break
		}
	}
	if delay > policy.MaxDelay {
		delay = policy.MaxDelay
	}
	return delay + telegramRetryJitter(policy.JitterMax)
}

func telegramRetryJitter(max time.Duration) time.Duration {
	if max <= 0 {
		return 0
	}
	return time.Duration(rand.Int64N(int64(max) + 1))
}

func (s *Server) deleteMessageWithRetry(ctx context.Context, chatID string, messageID int64) error {
	tgClient, err := s.requireTelegramClient()
	if err != nil {
		return err
	}
	return retryTelegramAction(ctx, func() error {
		return tgClient.DeleteMessage(ctx, chatID, messageID)
	})
}
