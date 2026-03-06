package api

import (
	"context"

	"github.com/const/tg-cloud-drive/backend/internal/telegram"
)

func (s *Server) editPhotoMessageByFileIDWithRetry(
	ctx context.Context,
	chatID string,
	messageID int64,
	fileID string,
	caption string,
	hasSpoiler bool,
) (telegram.Message, error) {
	tgClient, err := s.requireTelegramClient()
	if err != nil {
		return telegram.Message{}, err
	}
	return retryTelegramMessageSend(ctx, func() (telegram.Message, error) {
		return tgClient.EditPhotoMessageByFileID(ctx, chatID, messageID, fileID, caption, hasSpoiler)
	})
}

func (s *Server) editVideoMessageByFileIDWithRetry(
	ctx context.Context,
	chatID string,
	messageID int64,
	fileID string,
	caption string,
	hasSpoiler bool,
) (telegram.Message, error) {
	tgClient, err := s.requireTelegramClient()
	if err != nil {
		return telegram.Message{}, err
	}
	return retryTelegramMessageSend(ctx, func() (telegram.Message, error) {
		return tgClient.EditVideoMessageByFileID(ctx, chatID, messageID, fileID, caption, hasSpoiler)
	})
}

func (s *Server) editAnimationMessageByFileIDWithRetry(
	ctx context.Context,
	chatID string,
	messageID int64,
	fileID string,
	caption string,
	hasSpoiler bool,
) (telegram.Message, error) {
	tgClient, err := s.requireTelegramClient()
	if err != nil {
		return telegram.Message{}, err
	}
	return retryTelegramMessageSend(ctx, func() (telegram.Message, error) {
		return tgClient.EditAnimationMessageByFileID(ctx, chatID, messageID, fileID, caption, hasSpoiler)
	})
}
