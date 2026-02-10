package api

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/const/tg-cloud-drive/backend/internal/telegram"
)

// resolveMessageDocument 确保上传结果中拿到可持久化的 file_id。
// 某些代理/上游场景可能导致 sendDocument 返回的 document 字段不完整，
// 这里通过 forwardMessage 做一次回补，避免上传直接失败。
func (s *Server) resolveMessageDocument(ctx context.Context, msg telegram.Message) (telegram.Document, error) {
	if strings.TrimSpace(msg.Document.FileID) != "" {
		return msg.Document, nil
	}

	if strings.TrimSpace(s.cfg.TGStorageChatID) == "" || msg.MessageID <= 0 {
		return telegram.Document{}, errors.New("message 缺少 file_id 且无法回补")
	}

	forwarded, err := s.forwardMessageWithRetry(ctx, s.cfg.TGStorageChatID, s.cfg.TGStorageChatID, msg.MessageID)
	if err != nil {
		return telegram.Document{}, fmt.Errorf("forwardMessage 回补失败: %w", err)
	}

	if forwarded.MessageID > 0 {
		if cleanupErr := s.deleteMessageWithRetry(ctx, s.cfg.TGStorageChatID, forwarded.MessageID); cleanupErr != nil {
			s.logger.Warn("cleanup forwarded message failed", "error", cleanupErr.Error(), "message_id", forwarded.MessageID)
		}
	}

	if strings.TrimSpace(forwarded.Document.FileID) == "" {
		return telegram.Document{}, errors.New("forwardMessage 回补后仍缺少 file_id")
	}
	return forwarded.Document, nil
}
