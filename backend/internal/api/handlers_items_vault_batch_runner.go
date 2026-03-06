package api

import (
	"context"
	"sync"
	"time"

	"tg-cloud-drive-api/internal/store"
)

func (s *Server) runBatchVaultSync(
	ctx context.Context,
	st *store.Store,
	targets []store.Item,
	initialFailures []vaultBatchFailure,
	enabled bool,
	now time.Time,
	totalTargets int,
	reporter vaultBatchProgressReporter,
) (vaultBatchSummary, error) {
	state := newVaultBatchState(enabled, totalTargets, initialFailures, reporter)
	if err := state.emitInit(); err != nil {
		return state.snapshot(), err
	}
	if len(targets) == 0 {
		return state.finish()
	}

	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	jobs := make(chan store.Item)
	var wg sync.WaitGroup
	for i := 0; i < s.resolveVaultBatchParallelism(ctx); i++ {
		wg.Add(1)
		go s.runBatchVaultWorker(ctx, st, jobs, enabled, now, state, cancel, &wg)
	}

	if err := enqueueBatchVaultJobs(ctx, jobs, targets); err != nil {
		cancel()
		wg.Wait()
		return state.snapshot(), err
	}
	wg.Wait()
	if err := state.reportErr(); err != nil {
		return state.snapshot(), err
	}
	return state.finish()
}

func enqueueBatchVaultJobs(ctx context.Context, jobs chan<- store.Item, targets []store.Item) error {
	defer close(jobs)
	for _, item := range targets {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case jobs <- item:
		}
	}
	return nil
}

func (s *Server) runBatchVaultWorker(
	ctx context.Context,
	st *store.Store,
	jobs <-chan store.Item,
	enabled bool,
	now time.Time,
	state *vaultBatchState,
	cancel context.CancelFunc,
	wg *sync.WaitGroup,
) {
	defer wg.Done()
	for item := range jobs {
		if ctx.Err() != nil {
			return
		}
		if err := state.emitTargetStart(item); err != nil {
			cancel()
			return
		}
		result := s.processBatchVaultTarget(ctx, st, item, enabled, now, state)
		if err := state.recordResult(result); err != nil {
			cancel()
			return
		}
	}
}

func (s *Server) processBatchVaultTarget(
	ctx context.Context,
	st *store.Store,
	item store.Item,
	enabled bool,
	now time.Time,
	state *vaultBatchState,
) vaultBatchTargetResult {
	if item.Type == store.ItemTypeFolder {
		return s.processBatchVaultFolder(ctx, st, item, enabled, now, state)
	}
	return s.processBatchVaultFile(ctx, st, item, enabled, now)
}

func (s *Server) processBatchVaultFolder(
	ctx context.Context,
	st *store.Store,
	item store.Item,
	enabled bool,
	now time.Time,
	state *vaultBatchState,
) vaultBatchTargetResult {
	reporter := func(folderEvent vaultFolderProgressEvent) error {
		return state.emitFolderProgress(item, folderEvent)
	}
	_, folderSummary, err := s.setFolderVaultInternal(ctx, st, item, enabled, now, reporter)
	if err != nil {
		return failedBatchResult(item, "folder_sync", err.Error(), vaultBatchStats{})
	}

	stats := vaultBatchStats{
		TotalItems:             folderSummary.TotalItems,
		UpdatedItems:           folderSummary.UpdatedItems,
		EligibleSpoilerFiles:   folderSummary.EligibleSpoilerFiles,
		ProcessedEligibleFiles: folderSummary.EligibleSpoilerFiles,
		AppliedSpoilerFiles:    folderSummary.AppliedSpoilerFiles,
		SkippedSpoilerFiles:    folderSummary.SkippedSpoilerFiles,
		FailedSpoilerFiles:     folderSummary.FailedSpoilerFiles,
	}
	return successBatchResult(item, stats)
}

func (s *Server) processBatchVaultFile(
	ctx context.Context,
	st *store.Store,
	item store.Item,
	enabled bool,
	now time.Time,
) vaultBatchTargetResult {
	if item.InVault == enabled {
		return successBatchResult(item, vaultBatchStats{TotalItems: 1})
	}

	applied, eligible, syncErr := s.syncVaultSpoilerForItem(ctx, st, item, enabled)
	if syncErr != nil {
		return failedBatchResult(item, "sync", syncErr.Error(), failedSpoilerStats(eligible))
	}

	if _, err := st.UpdateItemVault(ctx, item.ID, enabled, now); err != nil {
		return failedBatchResult(item, "update", "更新文件密码箱状态失败", vaultBatchStats{TotalItems: 1})
	}

	stats := vaultBatchStats{TotalItems: 1, UpdatedItems: 1}
	if !eligible {
		return successBatchResult(item, stats)
	}
	stats.EligibleSpoilerFiles = 1
	stats.ProcessedEligibleFiles = 1
	if applied {
		stats.AppliedSpoilerFiles = 1
	} else {
		stats.SkippedSpoilerFiles = 1
	}
	return successBatchResult(item, stats)
}

func failedSpoilerStats(eligible bool) vaultBatchStats {
	stats := vaultBatchStats{TotalItems: 1}
	if !eligible {
		return stats
	}
	stats.EligibleSpoilerFiles = 1
	stats.ProcessedEligibleFiles = 1
	stats.FailedSpoilerFiles = 1
	return stats
}

func successBatchResult(item store.Item, stats vaultBatchStats) vaultBatchTargetResult {
	return vaultBatchTargetResult{
		itemID:   item.ID.String(),
		name:     item.Name,
		itemType: string(item.Type),
		success:  true,
		stage:    "done",
		stats:    stats,
	}
}

func failedBatchResult(item store.Item, stage string, message string, stats vaultBatchStats) vaultBatchTargetResult {
	return vaultBatchTargetResult{
		itemID:   item.ID.String(),
		name:     item.Name,
		itemType: string(item.Type),
		success:  false,
		stage:    stage,
		message:  message,
		stats:    stats,
	}
}

func (s *Server) resolveVaultBatchParallelism(ctx context.Context) int {
	settings, err := s.getRuntimeSettings(ctx)
	if err != nil {
		s.logger.Warn("load runtime settings for vault batch failed", "error", err.Error())
		return vaultBatchParallelismDefault
	}
	return clampInt(settings.UploadConcurrency, vaultBatchParallelismMin, vaultBatchParallelismMax)
}
