package store

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"
)

func (s *Store) UpsertTelegramDeleteFailures(ctx context.Context, failures []TelegramDeleteFailure) error {
	if len(failures) == 0 {
		return nil
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	const query = `
INSERT INTO telegram_delete_failures(
  id,
  item_id,
  item_path,
  tg_chat_id,
  tg_message_id,
  error_message,
  retry_count,
  resolved,
  failed_at,
  last_retry_at,
  resolved_at
)
VALUES (
  $1,
  $2,
  $3,
  $4,
  $5,
  $6,
  0,
  FALSE,
  $7,
  $7,
  NULL
)
ON CONFLICT (tg_chat_id, tg_message_id) DO UPDATE
SET item_id = EXCLUDED.item_id,
    item_path = EXCLUDED.item_path,
    error_message = EXCLUDED.error_message,
    retry_count = telegram_delete_failures.retry_count + 1,
    resolved = FALSE,
    resolved_at = NULL,
    last_retry_at = EXCLUDED.last_retry_at
`

	for i := range failures {
		item := failures[i]
		item.ItemPath = strings.TrimSpace(item.ItemPath)
		item.TGChatID = strings.TrimSpace(item.TGChatID)
		item.Error = strings.TrimSpace(item.Error)
		if item.ID == uuid.Nil {
			item.ID = uuid.New()
		}
		if item.FailedAt.IsZero() {
			item.FailedAt = time.Now()
		}
		if item.ItemPath == "" || item.TGChatID == "" || item.TGMessageID <= 0 || item.Error == "" {
			return ErrBadInput
		}

		if _, err := tx.Exec(
			ctx,
			query,
			item.ID,
			item.ItemID,
			item.ItemPath,
			item.TGChatID,
			item.TGMessageID,
			item.Error,
			item.FailedAt,
		); err != nil {
			return err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return err
	}
	return nil
}

