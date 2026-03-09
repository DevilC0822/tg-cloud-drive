package api

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"tg-cloud-drive-api/internal/store"
	"tg-cloud-drive-api/internal/telegram"

	"github.com/google/uuid"
)

const (
	telegramDeleteParallelismMin     = 4
	telegramDeleteParallelismMax     = 32
	telegramDeleteParallelismDefault = 12
	telegramDeleteWindow             = 48 * time.Hour
	telegramDeletedCaption           = "文件已删除"
)

type telegramDeleteTarget struct {
	chatID    string
	messageID int64
	createdAt time.Time
	itemType  store.ItemType
}

type telegramCleanupStats struct {
	Attempted int
	Deleted   int
	Replaced  int
	Failed    int
}

type telegramCleanupResult struct {
	stats    telegramCleanupStats
	failures []store.TelegramDeleteFailure
}

type telegramDeleteAction string

const (
	telegramDeleteActionDeleted  telegramDeleteAction = "deleted"
	telegramDeleteActionReplaced telegramDeleteAction = "replaced"
	telegramDeleteActionFailed   telegramDeleteAction = "failed"
)

type telegramDeleteResult struct {
	target telegramDeleteTarget
	action telegramDeleteAction
	err    error
}

func collectTelegramDeleteTargets(defaultChatID string, refs []store.ChunkDeleteRef) []telegramDeleteTarget {
	targets := make([]telegramDeleteTarget, 0, len(refs))
	seen := make(map[string]struct{}, len(refs))
	for _, ref := range refs {
		target, ok := buildTelegramDeleteTarget(defaultChatID, ref)
		if !ok {
			continue
		}
		key := target.chatID + ":" + strconv.FormatInt(target.messageID, 10)
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		targets = append(targets, target)
	}
	return targets
}

func buildTelegramDeleteTarget(defaultChatID string, ref store.ChunkDeleteRef) (telegramDeleteTarget, bool) {
	chatID := strings.TrimSpace(ref.TGChatID)
	if chatID == "" {
		chatID = strings.TrimSpace(defaultChatID)
	}
	if chatID == "" || ref.TGMessageID <= 0 {
		return telegramDeleteTarget{}, false
	}
	return telegramDeleteTarget{
		chatID:    chatID,
		messageID: ref.TGMessageID,
		createdAt: ref.CreatedAt,
		itemType:  ref.ItemType,
	}, true
}

func (s *Server) resolveTelegramDeleteWorkers(ctx context.Context, targetCount int) int {
	if targetCount <= 0 {
		return 0
	}
	parallelism := s.resolveTelegramDeleteParallelism(ctx)
	if targetCount < parallelism {
		return targetCount
	}
	return parallelism
}

func (s *Server) resolveTelegramDeleteParallelism(ctx context.Context) int {
	settings, err := s.getRuntimeSettings(ctx)
	if err != nil {
		s.logger.Warn("load runtime settings for telegram delete failed", "error", err.Error())
		return telegramDeleteParallelismDefault
	}
	return normalizeTelegramDeleteParallelism(settings.TelegramDeleteConcurrency)
}

func normalizeTelegramDeleteParallelism(value int) int {
	return clampInt(value, telegramDeleteParallelismMin, telegramDeleteParallelismMax)
}

func shouldEditDeletedMessage(createdAt time.Time, now time.Time) bool {
	if createdAt.IsZero() {
		return false
	}
	return !createdAt.Add(telegramDeleteWindow).After(now)
}

func shouldReplaceAfterDeleteError(err error) bool {
	var cannotDeleteErr telegram.MessageCannotBeDeletedError
	return errors.As(err, &cannotDeleteErr)
}

func (s *Server) cleanupTelegramMessages(
	ctx context.Context,
	item store.Item,
	refs []store.ChunkDeleteRef,
) telegramCleanupResult {
	targets := collectTelegramDeleteTargets(s.cfg.TGStorageChatID, refs)
	if len(targets) == 0 {
		return telegramCleanupResult{}
	}

	results := s.runTelegramDeleteJobs(ctx, item, targets)
	return buildTelegramCleanupResult(item, len(targets), results)
}

func (s *Server) runTelegramDeleteJobs(
	ctx context.Context,
	item store.Item,
	targets []telegramDeleteTarget,
) []telegramDeleteResult {
	jobs := make(chan telegramDeleteTarget)
	results := make(chan telegramDeleteResult, len(targets))
	var wg sync.WaitGroup
	for idx := 0; idx < s.resolveTelegramDeleteWorkers(ctx, len(targets)); idx++ {
		wg.Add(1)
		go s.runTelegramDeleteWorker(ctx, item, jobs, results, &wg)
	}
	enqueueTelegramDeleteJobs(ctx, targets, jobs)
	wg.Wait()
	close(results)
	return collectTelegramDeleteResults(results)
}

func enqueueTelegramDeleteJobs(ctx context.Context, targets []telegramDeleteTarget, jobs chan<- telegramDeleteTarget) {
	defer close(jobs)
	for _, target := range targets {
		select {
		case <-ctx.Done():
			return
		case jobs <- target:
		}
	}
}

func (s *Server) runTelegramDeleteWorker(
	ctx context.Context,
	item store.Item,
	jobs <-chan telegramDeleteTarget,
	results chan<- telegramDeleteResult,
	wg *sync.WaitGroup,
) {
	defer wg.Done()
	for target := range jobs {
		if ctx.Err() != nil {
			return
		}
		results <- s.cleanupTelegramTarget(ctx, item, target, time.Now())
	}
}

func (s *Server) cleanupTelegramTarget(
	ctx context.Context,
	item store.Item,
	target telegramDeleteTarget,
	now time.Time,
) telegramDeleteResult {
	if shouldEditDeletedMessage(target.createdAt, now) {
		return s.replaceDeletedTelegramTarget(ctx, item, target, nil)
	}
	err := s.deleteMessageWithRetry(ctx, target.chatID, target.messageID)
	if err == nil {
		return telegramDeleteResult{target: target, action: telegramDeleteActionDeleted}
	}
	if shouldReplaceAfterDeleteError(err) {
		return s.replaceDeletedTelegramTarget(ctx, item, target, err)
	}
	s.logTelegramDeleteFailure(item, target, err)
	return telegramDeleteResult{target: target, action: telegramDeleteActionFailed, err: err}
}

func (s *Server) replaceDeletedTelegramTarget(
	ctx context.Context,
	item store.Item,
	target telegramDeleteTarget,
	deleteErr error,
) telegramDeleteResult {
	if err := s.replaceMessageWithDeletedPlaceholderWithRetry(
		ctx,
		target.chatID,
		target.messageID,
		usesPhotoDeletedPlaceholder(target.itemType),
		telegramDeletedCaption,
	); err == nil {
		return telegramDeleteResult{target: target, action: telegramDeleteActionReplaced}
	} else {
		s.logTelegramCleanupFailure(item, target, deleteErr, err)
		return telegramDeleteResult{target: target, action: telegramDeleteActionFailed, err: joinTelegramCleanupErrors(deleteErr, err)}
	}
}

func usesPhotoDeletedPlaceholder(itemType store.ItemType) bool {
	switch itemType {
	case store.ItemTypeImage, store.ItemTypeVideo:
		return true
	default:
		return false
	}
}

func (s *Server) logTelegramCleanupFailure(
	item store.Item,
	target telegramDeleteTarget,
	deleteErr error,
	editErr error,
) {
	s.logger.Warn(
		"cleanup telegram message failed, will continue local purge",
		"delete_error", errorTextOrEmpty(deleteErr),
		"edit_error", errorTextOrEmpty(editErr),
		"item_id", item.ID.String(),
		"item_path", item.Path,
		"message_id", target.messageID,
	)
}

func (s *Server) logTelegramDeleteFailure(
	item store.Item,
	target telegramDeleteTarget,
	deleteErr error,
) {
	s.logger.Warn(
		"delete telegram message failed, will continue local purge",
		"delete_error", errorTextOrEmpty(deleteErr),
		"item_id", item.ID.String(),
		"item_path", item.Path,
		"message_id", target.messageID,
	)
}

func joinTelegramCleanupErrors(deleteErr error, editErr error) error {
	switch {
	case deleteErr == nil && editErr == nil:
		return nil
	case deleteErr == nil:
		return editErr
	case editErr == nil:
		return deleteErr
	default:
		return fmt.Errorf("delete failed: %w; edit failed: %s", deleteErr, strings.TrimSpace(editErr.Error()))
	}
}

func errorTextOrEmpty(err error) string {
	if err == nil {
		return ""
	}
	return strings.TrimSpace(err.Error())
}

func collectTelegramDeleteResults(results <-chan telegramDeleteResult) []telegramDeleteResult {
	out := make([]telegramDeleteResult, 0)
	for result := range results {
		out = append(out, result)
	}
	return out
}

func buildTelegramCleanupResult(
	item store.Item,
	attempted int,
	results []telegramDeleteResult,
) telegramCleanupResult {
	failures := make([]store.TelegramDeleteFailure, 0)
	stats := telegramCleanupStats{Attempted: attempted}
	for _, result := range results {
		switch result.action {
		case telegramDeleteActionDeleted:
			stats.Deleted++
		case telegramDeleteActionReplaced:
			stats.Replaced++
		default:
			stats.Failed++
			failures = append(failures, newTelegramDeleteFailure(item, result))
		}
	}
	return telegramCleanupResult{stats: stats, failures: failures}
}

func newTelegramDeleteFailure(item store.Item, result telegramDeleteResult) store.TelegramDeleteFailure {
	itemID := item.ID
	return store.TelegramDeleteFailure{
		ID:          uuid.New(),
		ItemID:      &itemID,
		ItemPath:    item.Path,
		TGChatID:    result.target.chatID,
		TGMessageID: result.target.messageID,
		Error:       errorTextOrEmpty(result.err),
		FailedAt:    time.Now(),
	}
}
