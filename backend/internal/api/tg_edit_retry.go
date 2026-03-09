package api

import (
	"context"

	"tg-cloud-drive-api/internal/telegram"
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

func (s *Server) replaceMessageWithDeletedPlaceholderWithRetry(
	ctx context.Context,
	chatID string,
	messageID int64,
	usePhoto bool,
	caption string,
) error {
	tgClient, err := s.requireTelegramClient()
	if err != nil {
		return err
	}
	return retryTelegramAction(ctx, func() error {
		if usePhoto {
			return tgClient.ReplaceMessageWithDeletedPhoto(ctx, chatID, messageID, caption)
		}
		return tgClient.ReplaceMessageWithDeletedDocument(ctx, chatID, messageID, caption)
	})
}
