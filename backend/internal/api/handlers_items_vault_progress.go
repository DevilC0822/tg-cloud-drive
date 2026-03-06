package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/const/tg-cloud-drive/backend/internal/store"
)

const (
	vaultProgressEventInit       = "init"
	vaultProgressEventProgress   = "progress"
	vaultProgressEventFinalizing = "finalizing"
	vaultProgressEventDone       = "done"
	vaultProgressEventError      = "error"

	vaultSpoilerParallelismMin     = 2
	vaultSpoilerParallelismMax     = 6
	vaultSpoilerParallelismDefault = 2
)

type vaultFolderProgressEvent struct {
	Type                   string                  `json:"type"`
	ItemID                 string                  `json:"itemId,omitempty"`
	Enabled                *bool                   `json:"enabled,omitempty"`
	Message                string                  `json:"message,omitempty"`
	TotalItems             int                     `json:"totalItems"`
	EligibleSpoilerFiles   int                     `json:"eligibleSpoilerFiles"`
	ProcessedEligibleFiles int                     `json:"processedEligibleFiles"`
	AppliedSpoilerFiles    int                     `json:"appliedSpoilerFiles"`
	SkippedSpoilerFiles    int                     `json:"skippedSpoilerFiles"`
	FailedSpoilerFiles     int                     `json:"failedSpoilerFiles"`
	Percent                float64                 `json:"percent"`
	UpdatedItems           int64                   `json:"updatedItems"`
	Item                   *ItemDTO                `json:"item,omitempty"`
	Summary                *vaultFolderSyncSummary `json:"summary,omitempty"`
}

type vaultFolderProgressReporter func(vaultFolderProgressEvent) error

type vaultProgressStreamWriter struct {
	enc     *json.Encoder
	flusher http.Flusher
	mu      sync.Mutex
}

type responseWriterUnwrapper interface {
	Unwrap() http.ResponseWriter
}

func isVaultProgressStreamRequested(raw string) bool {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "1", "true", "yes", "on":
		return true
	default:
		return false
	}
}

func newVaultProgressStreamWriter(w http.ResponseWriter) (*vaultProgressStreamWriter, error) {
	flusher, ok := resolveResponseWriterFlusher(w)
	if !ok {
		return nil, errors.New("streaming not supported")
	}
	w.Header().Set("Content-Type", "application/x-ndjson; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)
	flusher.Flush()
	return &vaultProgressStreamWriter{enc: json.NewEncoder(w), flusher: flusher}, nil
}

func resolveResponseWriterFlusher(w http.ResponseWriter) (http.Flusher, bool) {
	current := w
	for current != nil {
		if flusher, ok := current.(http.Flusher); ok {
			return flusher, true
		}
		unwrapper, ok := current.(responseWriterUnwrapper)
		if !ok {
			return nil, false
		}
		next := unwrapper.Unwrap()
		if next == nil || next == current {
			return nil, false
		}
		current = next
	}
	return nil, false
}

func (w *vaultProgressStreamWriter) write(event any) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	if err := w.enc.Encode(event); err != nil {
		return err
	}
	w.flusher.Flush()
	return nil
}

func (s *Server) streamFolderVaultSync(
	w http.ResponseWriter,
	r *http.Request,
	st *store.Store,
	root store.Item,
	enabled bool,
	now time.Time,
) {
	writer, err := newVaultProgressStreamWriter(w)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "服务端不支持流式进度")
		return
	}

	reporter := func(event vaultFolderProgressEvent) error {
		event.ItemID = root.ID.String()
		event.Enabled = boolPointer(enabled)
		return writer.write(event)
	}

	updated, summary, syncErr := s.setFolderVaultInternal(r.Context(), st, root, enabled, now, reporter)
	if syncErr != nil {
		_ = writer.write(vaultFolderProgressEvent{
			Type:    vaultProgressEventError,
			ItemID:  root.ID.String(),
			Enabled: boolPointer(enabled),
			Message: syncErr.Error(),
		})
		return
	}

	item := toItemDTO(updated)
	done := buildDoneProgressEvent(summary, item)
	done.ItemID = root.ID.String()
	done.Enabled = boolPointer(enabled)
	if err := writer.write(done); err != nil {
		s.logger.Warn("write vault progress done event failed", "error", err.Error(), "item_id", root.ID.String())
	}
}

func buildDoneProgressEvent(summary vaultFolderSyncSummary, item ItemDTO) vaultFolderProgressEvent {
	return vaultFolderProgressEvent{
		Type:                   vaultProgressEventDone,
		TotalItems:             summary.TotalItems,
		EligibleSpoilerFiles:   summary.EligibleSpoilerFiles,
		ProcessedEligibleFiles: summary.EligibleSpoilerFiles,
		AppliedSpoilerFiles:    summary.AppliedSpoilerFiles,
		SkippedSpoilerFiles:    summary.SkippedSpoilerFiles,
		FailedSpoilerFiles:     summary.FailedSpoilerFiles,
		Percent:                vaultSpoilerProgressPercent(summary.EligibleSpoilerFiles, summary.EligibleSpoilerFiles),
		UpdatedItems:           summary.UpdatedItems,
		Item:                   &item,
		Summary:                &summary,
	}
}

func (s *Server) setFolderVaultInternal(
	ctx context.Context,
	st *store.Store,
	root store.Item,
	enabled bool,
	now time.Time,
	reporter vaultFolderProgressReporter,
) (store.Item, vaultFolderSyncSummary, error) {
	items, err := st.ListSubtreeItems(ctx, root.Path)
	if err != nil {
		return store.Item{}, vaultFolderSyncSummary{}, fmt.Errorf("查询目录子项失败")
	}

	summary := vaultFolderSyncSummary{TotalItems: len(items), Failures: make([]vaultFolderSyncFailure, 0)}
	targets := collectVaultSpoilerTargets(changedVaultItems(items, enabled))
	summary.EligibleSpoilerFiles = len(targets)
	if err := reportVaultInit(reporter, summary); err != nil {
		return store.Item{}, vaultFolderSyncSummary{}, err
	}

	if err := s.processVaultSpoilerTargets(ctx, st, targets, enabled, &summary, reporter); err != nil {
		return store.Item{}, vaultFolderSyncSummary{}, err
	}

	updatedRows, err := st.UpdateItemsVaultByPathPrefix(ctx, root.Path, enabled, now)
	if err != nil {
		return store.Item{}, vaultFolderSyncSummary{}, fmt.Errorf("更新目录密码箱状态失败")
	}
	summary.UpdatedItems = updatedRows
	if err := reportVaultFinalizing(reporter, summary); err != nil {
		return store.Item{}, vaultFolderSyncSummary{}, err
	}

	updatedRoot, err := st.GetItem(ctx, root.ID)
	if err != nil {
		return store.Item{}, vaultFolderSyncSummary{}, fmt.Errorf("查询目录状态失败")
	}
	return updatedRoot, summary, nil
}

func collectVaultSpoilerTargets(items []store.Item) []store.Item {
	targets := make([]store.Item, 0, len(items))
	for _, item := range items {
		if item.Type == store.ItemTypeFolder {
			continue
		}
		if isVaultSpoilerTypeSupported(item) {
			targets = append(targets, item)
		}
	}
	return targets
}

func (s *Server) processVaultSpoilerTargets(
	ctx context.Context,
	st *store.Store,
	targets []store.Item,
	enabled bool,
	summary *vaultFolderSyncSummary,
	reporter vaultFolderProgressReporter,
) error {
	if len(targets) == 0 {
		return nil
	}

	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	parallelism := s.resolveVaultSpoilerParallelism(ctx)
	jobs := make(chan store.Item)
	state := &vaultSpoilerProgressState{}
	var wg sync.WaitGroup
	for idx := 0; idx < parallelism; idx++ {
		wg.Add(1)
		go s.runVaultSpoilerWorker(ctx, st, jobs, enabled, summary, reporter, state, cancel, &wg)
	}

	if err := enqueueVaultSpoilerTargets(ctx, jobs, targets); err != nil {
		state.markEnqueueErr(err)
		cancel()
	}
	wg.Wait()
	if state.reportErr != nil {
		return state.reportErr
	}
	if state.enqueueErr != nil {
		return state.enqueueErr
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	return nil
}

type vaultSpoilerProgressState struct {
	mu         sync.Mutex
	processed  int
	reportErr  error
	enqueueErr error
}

func enqueueVaultSpoilerTargets(ctx context.Context, jobs chan<- store.Item, targets []store.Item) error {
	defer close(jobs)
	for _, target := range targets {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case jobs <- target:
		}
	}
	return nil
}

func (s *Server) runVaultSpoilerWorker(
	ctx context.Context,
	st *store.Store,
	jobs <-chan store.Item,
	enabled bool,
	summary *vaultFolderSyncSummary,
	reporter vaultFolderProgressReporter,
	state *vaultSpoilerProgressState,
	cancel context.CancelFunc,
	wg *sync.WaitGroup,
) {
	defer wg.Done()
	for item := range jobs {
		if ctx.Err() != nil {
			return
		}
		applied, _, syncErr := s.syncVaultSpoilerForItem(ctx, st, item, enabled)
		update := state.record(summary, item, applied, syncErr)
		if reporter == nil {
			continue
		}
		if err := reporter(update); err != nil {
			state.markReportErr(err)
			cancel()
			return
		}
	}
}

func (s *vaultSpoilerProgressState) record(
	summary *vaultFolderSyncSummary,
	item store.Item,
	applied bool,
	syncErr error,
) vaultFolderProgressEvent {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.processed++
	recordVaultSpoilerResult(summary, item, applied, syncErr)
	return buildVaultProgressEvent(*summary, s.processed)
}

func (s *vaultSpoilerProgressState) markReportErr(err error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.reportErr == nil {
		s.reportErr = err
	}
}

func (s *vaultSpoilerProgressState) markEnqueueErr(err error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.enqueueErr == nil {
		s.enqueueErr = err
	}
}

func recordVaultSpoilerResult(summary *vaultFolderSyncSummary, item store.Item, applied bool, syncErr error) {
	if syncErr != nil {
		summary.FailedSpoilerFiles++
		summary.Failures = append(summary.Failures, vaultFolderSyncFailure{
			ID: item.ID.String(), Name: item.Name, Error: syncErr.Error(),
		})
		return
	}
	if applied {
		summary.AppliedSpoilerFiles++
		return
	}
	summary.SkippedSpoilerFiles++
}

func buildVaultProgressEvent(summary vaultFolderSyncSummary, processed int) vaultFolderProgressEvent {
	return vaultFolderProgressEvent{
		Type:                   vaultProgressEventProgress,
		TotalItems:             summary.TotalItems,
		EligibleSpoilerFiles:   summary.EligibleSpoilerFiles,
		ProcessedEligibleFiles: processed,
		AppliedSpoilerFiles:    summary.AppliedSpoilerFiles,
		SkippedSpoilerFiles:    summary.SkippedSpoilerFiles,
		FailedSpoilerFiles:     summary.FailedSpoilerFiles,
		Percent:                vaultSpoilerProgressPercent(processed, summary.EligibleSpoilerFiles),
	}
}

func reportVaultInit(reporter vaultFolderProgressReporter, summary vaultFolderSyncSummary) error {
	if reporter == nil {
		return nil
	}
	return reporter(vaultFolderProgressEvent{
		Type:                 vaultProgressEventInit,
		TotalItems:           summary.TotalItems,
		EligibleSpoilerFiles: summary.EligibleSpoilerFiles,
	})
}

func reportVaultFinalizing(reporter vaultFolderProgressReporter, summary vaultFolderSyncSummary) error {
	if reporter == nil {
		return nil
	}
	return reporter(vaultFolderProgressEvent{
		Type:                   vaultProgressEventFinalizing,
		TotalItems:             summary.TotalItems,
		EligibleSpoilerFiles:   summary.EligibleSpoilerFiles,
		ProcessedEligibleFiles: summary.EligibleSpoilerFiles,
		AppliedSpoilerFiles:    summary.AppliedSpoilerFiles,
		SkippedSpoilerFiles:    summary.SkippedSpoilerFiles,
		FailedSpoilerFiles:     summary.FailedSpoilerFiles,
		Percent:                vaultSpoilerProgressPercent(summary.EligibleSpoilerFiles, summary.EligibleSpoilerFiles),
		UpdatedItems:           summary.UpdatedItems,
	})
}

func vaultSpoilerProgressPercent(processed int, total int) float64 {
	if total <= 0 {
		return 100
	}
	if processed < 0 {
		processed = 0
	}
	if processed > total {
		processed = total
	}
	return float64(processed*100) / float64(total)
}

func (s *Server) resolveVaultSpoilerParallelism(ctx context.Context) int {
	settings, err := s.getRuntimeSettings(ctx)
	if err != nil {
		s.logger.Warn("load runtime settings for vault spoiler failed", "error", err.Error())
		return vaultSpoilerParallelismDefault
	}
	return clampInt(settings.UploadConcurrency, vaultSpoilerParallelismMin, vaultSpoilerParallelismMax)
}

func clampInt(value int, minValue int, maxValue int) int {
	if value < minValue {
		return minValue
	}
	if value > maxValue {
		return maxValue
	}
	return value
}

func boolPointer(value bool) *bool {
	return &value
}
