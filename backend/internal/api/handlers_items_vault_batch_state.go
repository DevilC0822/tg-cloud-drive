package api

import (
	"errors"

	"tg-cloud-drive-api/internal/store"
)

func newVaultBatchState(
	enabled bool,
	totalTargets int,
	initialFailures []vaultBatchFailure,
	reporter vaultBatchProgressReporter,
) *vaultBatchState {
	summary := vaultBatchSummary{
		TotalTargets:  totalTargets,
		FailedTargets: len(initialFailures),
		Failures:      append([]vaultBatchFailure(nil), initialFailures...),
	}
	return &vaultBatchState{enabled: enabled, summary: summary, reporter: reporter}
}

func (s *vaultBatchState) emitInit() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.emitLocked(vaultBatchProgressEvent{
		Type:             vaultBatchProgressEventInit,
		Enabled:          boolPointer(s.enabled),
		TotalTargets:     s.summary.TotalTargets,
		DoneTargets:      s.doneTargets(),
		SucceededTargets: s.summary.SucceededTargets,
		FailedTargets:    s.summary.FailedTargets,
		Percent:          vaultBatchOverallPercent(s.doneTargets(), s.summary.TotalTargets),
	})
}

func (s *vaultBatchState) emitTargetStart(item store.Item) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.emitLocked(vaultBatchProgressEvent{
		Type:             vaultBatchProgressEventTargetInit,
		Enabled:          boolPointer(s.enabled),
		Stage:            vaultProgressEventInit,
		TotalTargets:     s.summary.TotalTargets,
		DoneTargets:      s.doneTargets(),
		SucceededTargets: s.summary.SucceededTargets,
		FailedTargets:    s.summary.FailedTargets,
		Percent:          vaultBatchOverallPercent(s.doneTargets(), s.summary.TotalTargets),
		CurrentItemID:    item.ID.String(),
		CurrentItemName:  item.Name,
		CurrentItemType:  string(item.Type),
	})
}

func (s *vaultBatchState) emitFolderProgress(item store.Item, folderEvent vaultFolderProgressEvent) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.emitLocked(vaultBatchProgressEvent{
		Type:                   vaultBatchProgressEventTarget,
		Enabled:                boolPointer(s.enabled),
		Stage:                  folderEvent.Type,
		TotalTargets:           s.summary.TotalTargets,
		DoneTargets:            s.doneTargets(),
		SucceededTargets:       s.summary.SucceededTargets,
		FailedTargets:          s.summary.FailedTargets,
		Percent:                vaultBatchOverallPercent(s.doneTargets(), s.summary.TotalTargets),
		CurrentItemID:          item.ID.String(),
		CurrentItemName:        item.Name,
		CurrentItemType:        string(item.Type),
		CurrentItemPercent:     folderEvent.Percent,
		TotalItems:             folderEvent.TotalItems,
		EligibleSpoilerFiles:   folderEvent.EligibleSpoilerFiles,
		ProcessedEligibleFiles: folderEvent.ProcessedEligibleFiles,
		AppliedSpoilerFiles:    folderEvent.AppliedSpoilerFiles,
		SkippedSpoilerFiles:    folderEvent.SkippedSpoilerFiles,
		FailedSpoilerFiles:     folderEvent.FailedSpoilerFiles,
	})
}

func (s *vaultBatchState) recordResult(result vaultBatchTargetResult) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.mergeStats(result)
	if result.success {
		s.summary.SucceededTargets++
	} else {
		s.summary.FailedTargets++
		s.summary.Failures = append(s.summary.Failures, vaultBatchFailure{
			ItemID: result.itemID,
			Name:   result.name,
			Stage:  result.stage,
			Error:  result.message,
		})
	}

	return s.emitLocked(vaultBatchProgressEvent{
		Type:                   vaultBatchProgressEventTargetDone,
		Enabled:                boolPointer(s.enabled),
		Stage:                  result.stage,
		Message:                result.message,
		TotalTargets:           s.summary.TotalTargets,
		DoneTargets:            s.doneTargets(),
		SucceededTargets:       s.summary.SucceededTargets,
		FailedTargets:          s.summary.FailedTargets,
		Percent:                vaultBatchOverallPercent(s.doneTargets(), s.summary.TotalTargets),
		CurrentItemID:          result.itemID,
		CurrentItemName:        result.name,
		CurrentItemType:        result.itemType,
		CurrentItemPercent:     100,
		TotalItems:             result.stats.TotalItems,
		EligibleSpoilerFiles:   result.stats.EligibleSpoilerFiles,
		ProcessedEligibleFiles: result.stats.ProcessedEligibleFiles,
		AppliedSpoilerFiles:    result.stats.AppliedSpoilerFiles,
		SkippedSpoilerFiles:    result.stats.SkippedSpoilerFiles,
		FailedSpoilerFiles:     result.stats.FailedSpoilerFiles,
	})
}

func (s *vaultBatchState) mergeStats(result vaultBatchTargetResult) {
	s.summary.TotalItems += result.stats.TotalItems
	s.summary.UpdatedItems += result.stats.UpdatedItems
	s.summary.EligibleSpoilerFiles += result.stats.EligibleSpoilerFiles
	s.summary.ProcessedEligibleFiles += result.stats.ProcessedEligibleFiles
	s.summary.AppliedSpoilerFiles += result.stats.AppliedSpoilerFiles
	s.summary.SkippedSpoilerFiles += result.stats.SkippedSpoilerFiles
	s.summary.FailedSpoilerFiles += result.stats.FailedSpoilerFiles
}

func (s *vaultBatchState) finish() (vaultBatchSummary, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	err := s.emitLocked(vaultBatchProgressEvent{
		Type:             vaultBatchProgressEventDone,
		Enabled:          boolPointer(s.enabled),
		Stage:            vaultProgressEventDone,
		TotalTargets:     s.summary.TotalTargets,
		DoneTargets:      s.doneTargets(),
		SucceededTargets: s.summary.SucceededTargets,
		FailedTargets:    s.summary.FailedTargets,
		Percent:          vaultBatchOverallPercent(s.doneTargets(), s.summary.TotalTargets),
		Summary:          s.copySummary(),
	})
	if err != nil {
		return s.summary, err
	}
	return s.summary, nil
}

func (s *vaultBatchState) copySummary() *vaultBatchSummary {
	copyFailures := append([]vaultBatchFailure(nil), s.summary.Failures...)
	summary := s.summary
	summary.Failures = copyFailures
	return &summary
}

func (s *vaultBatchState) doneTargets() int {
	return s.summary.SucceededTargets + s.summary.FailedTargets
}

func (s *vaultBatchState) emitLocked(event vaultBatchProgressEvent) error {
	if s.reporter == nil {
		return nil
	}
	if s.failed {
		return errors.New("vault batch reporter unavailable")
	}
	if err := s.reporter(event); err != nil {
		s.failed = true
		return err
	}
	return nil
}

func (s *vaultBatchState) reportErr() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.failed {
		return nil
	}
	return errors.New("vault batch reporter unavailable")
}

func (s *vaultBatchState) snapshot() vaultBatchSummary {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.summary
}

func vaultBatchOverallPercent(done int, total int) float64 {
	if total <= 0 {
		return 100
	}
	if done < 0 {
		done = 0
	}
	if done > total {
		done = total
	}
	return float64(done*100) / float64(total)
}
