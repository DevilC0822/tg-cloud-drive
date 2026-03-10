package api

import (
	"context"
	"strings"
	"time"

	"tg-cloud-drive-api/internal/store"
)

const (
	transferPhaseProgressModeDeterminate   = "determinate"
	transferPhaseProgressModeIndeterminate = "indeterminate"
	transferPhaseProgressModeDiscrete      = "discrete"
)

type uploadPhaseView struct {
	Detail           string
	Steps            []string
	Progress         *transferProgressDTO
	ProgressMode     string
	SpeedBytesPerSec int64
	StartedAt        *time.Time
}

type uploadBatchPhaseAggregate struct {
	detail       string
	progressMode string
	progressUnit string
	current      int64
	total        int64
	speed        int64
	startedAt    *time.Time
	sessionCount int
}

func buildUploadPhaseSteps(mode store.UploadSessionMode) []string {
	if mode == store.UploadSessionModeDirectChunk {
		return []string{
			transferPhaseDetailChunkProcessing,
			transferPhaseDetailFinalizingRecord,
		}
	}
	return []string{
		transferPhaseDetailLocalChunkUploading,
		transferPhaseDetailAssemblingFile,
		transferPhaseDetailUploadingToTelegram,
		transferPhaseDetailFinalizingRecord,
	}
}

func cloneUploadPhaseSteps(steps []string) []string {
	if len(steps) == 0 {
		return nil
	}
	return append([]string(nil), steps...)
}

func resolveUploadPhaseProgressMode(detail string) string {
	switch detail {
	case transferPhaseDetailUploadingToTelegram,
		transferPhaseDetailLocalChunkUploading,
		transferPhaseDetailChunkProcessing,
		transferPhaseDetailAssemblingFile:
		return transferPhaseProgressModeDeterminate
	case transferPhaseDetailFinalizingRecord:
		return transferPhaseProgressModeDiscrete
	default:
		return transferPhaseProgressModeDeterminate
	}
}

func resolveTransferPhaseFromUploadDetail(detail string, fallback string) string {
	switch detail {
	case transferPhaseDetailLocalChunkUploading, transferPhaseDetailChunkProcessing:
		return transferPhaseUploadingChunks
	case transferPhaseDetailAssemblingFile,
		transferPhaseDetailUploadingToTelegram,
		transferPhaseDetailFinalizingRecord:
		return transferPhaseFinalizing
	default:
		return fallback
	}
}

func runtimePhaseProgressDTO(current int64, total int64, unit string) *transferProgressDTO {
	if total <= 0 && current <= 0 {
		return nil
	}
	if strings.TrimSpace(unit) == "" {
		unit = "bytes"
	}

	dto := progressFromCounts(current, maxInt64(total, 1), unit, false)
	if total > 0 && current >= total {
		dto.Percent = 100
	}
	return &dto
}

func resolveUploadChunkPhaseDetail(mode store.UploadSessionMode) string {
	if mode == store.UploadSessionModeDirectChunk {
		return transferPhaseDetailChunkProcessing
	}
	return transferPhaseDetailLocalChunkUploading
}

func resolveUploadSessionModeSafe(
	ctx context.Context,
	server *Server,
	session store.UploadSession,
) store.UploadSessionMode {
	mode, err := server.resolveUploadSessionMode(ctx, session)
	if err == nil {
		return mode
	}
	if session.UploadMode == store.UploadSessionModeDirectChunk {
		return store.UploadSessionModeDirectChunk
	}
	return store.UploadSessionModeLocalStaged
}

func resolvePhaseStartPointer(value time.Time) *time.Time {
	if value.IsZero() {
		return nil
	}
	startedAt := value
	return &startedAt
}

func buildUploadPhaseViewFromRuntime(
	steps []string,
	state uploadTransferRuntimeState,
) uploadPhaseView {
	progressMode := strings.TrimSpace(state.ProgressMode)
	if progressMode == "" {
		progressMode = resolveUploadPhaseProgressMode(state.PhaseDetail)
	}

	var progress *transferProgressDTO
	if progressMode != transferPhaseProgressModeIndeterminate {
		progress = runtimePhaseProgressDTO(
			state.ProgressCurrent,
			state.ProgressTotal,
			state.ProgressUnit,
		)
	}

	startedAt := state.PhaseStartedAt
	if startedAt.IsZero() {
		startedAt = state.UpdatedAt
	}

	return uploadPhaseView{
		Detail:           strings.TrimSpace(state.PhaseDetail),
		Steps:            cloneUploadPhaseSteps(steps),
		Progress:         progress,
		ProgressMode:     progressMode,
		SpeedBytesPerSec: maxInt64(state.SpeedBytesPerSecond, 0),
		StartedAt:        resolvePhaseStartPointer(startedAt),
	}
}

func buildFallbackFinalizingPhaseView(steps []string, updatedAt time.Time) uploadPhaseView {
	return uploadPhaseView{
		Detail:       transferPhaseDetailFinalizingRecord,
		Steps:        cloneUploadPhaseSteps(steps),
		Progress:     runtimePhaseProgressDTO(0, 1, "items"),
		ProgressMode: transferPhaseProgressModeDiscrete,
		StartedAt:    resolvePhaseStartPointer(updatedAt),
	}
}

func buildUploadingChunksPhaseView(
	steps []string,
	mode store.UploadSessionMode,
	uploadedCount int,
	totalChunks int,
	startedAt time.Time,
) uploadPhaseView {
	return uploadPhaseView{
		Detail:       resolveUploadChunkPhaseDetail(mode),
		Steps:        cloneUploadPhaseSteps(steps),
		Progress:     runtimePhaseProgressDTO(int64(uploadedCount), int64(max(totalChunks, 1)), "chunks"),
		ProgressMode: transferPhaseProgressModeDeterminate,
		StartedAt:    resolvePhaseStartPointer(startedAt),
	}
}

func (s *Server) resolveUploadSessionPhaseView(
	ctx context.Context,
	session store.UploadSession,
	phase string,
	uploadedCount int,
) uploadPhaseView {
	mode := resolveUploadSessionModeSafe(ctx, s, session)
	steps := buildUploadPhaseSteps(mode)
	if phase == "" {
		return uploadPhaseView{Steps: steps}
	}
	if phase == transferPhaseUploadingChunks {
		return buildUploadingChunksPhaseView(
			steps,
			mode,
			uploadedCount,
			session.TotalChunks,
			session.CreatedAt,
		)
	}

	if state, ok := s.getUploadSessionRuntime(session.ID); ok {
		return buildUploadPhaseViewFromRuntime(steps, state)
	}
	return buildFallbackFinalizingPhaseView(steps, session.UpdatedAt)
}

func resolveUploadBatchRuntimeDetailPriority(detail string) int {
	switch detail {
	case transferPhaseDetailUploadingToTelegram:
		return 4
	case transferPhaseDetailAssemblingFile:
		return 3
	case transferPhaseDetailLocalChunkUploading, transferPhaseDetailChunkProcessing:
		return 2
	case transferPhaseDetailFinalizingRecord:
		return 1
	default:
		return 0
	}
}

func preferUploadBatchAggregate(next uploadBatchPhaseAggregate, current uploadBatchPhaseAggregate) bool {
	nextPriority := resolveUploadBatchRuntimeDetailPriority(next.detail)
	currentPriority := resolveUploadBatchRuntimeDetailPriority(current.detail)
	if nextPriority != currentPriority {
		return nextPriority > currentPriority
	}
	if next.sessionCount != current.sessionCount {
		return next.sessionCount > current.sessionCount
	}
	return strings.Compare(next.detail, current.detail) < 0
}

func mergeUploadBatchStartedAt(current *time.Time, candidate *time.Time) *time.Time {
	if candidate == nil {
		return current
	}
	if current == nil || candidate.Before(*current) {
		startedAt := *candidate
		return &startedAt
	}
	return current
}

func (s *Server) buildUploadBatchPhaseAggregate(
	ctx context.Context,
	session store.UploadSession,
) uploadBatchPhaseAggregate {
	uploadedCount, _ := s.countUploadedChunksBySession(ctx, session)
	phase := resolveUploadSessionStatusPhase(session.Status, uploadedCount, session.TotalChunks)
	if phase == "" {
		return uploadBatchPhaseAggregate{}
	}

	view := s.resolveUploadSessionPhaseView(ctx, session, phase, uploadedCount)
	if view.Detail == "" {
		return uploadBatchPhaseAggregate{}
	}

	progressUnit := ""
	var current int64
	var total int64
	if view.Progress != nil {
		progressUnit = view.Progress.Unit
		current = view.Progress.Current
		total = view.Progress.Total
	}

	return uploadBatchPhaseAggregate{
		detail:       view.Detail,
		progressMode: view.ProgressMode,
		progressUnit: progressUnit,
		current:      current,
		total:        total,
		speed:        maxInt64(view.SpeedBytesPerSec, 0),
		startedAt:    view.StartedAt,
		sessionCount: 1,
	}
}

func mergeUploadBatchAggregate(
	current uploadBatchPhaseAggregate,
	next uploadBatchPhaseAggregate,
) uploadBatchPhaseAggregate {
	if current.detail == "" {
		return next
	}
	current.current += next.current
	current.total += next.total
	current.speed += next.speed
	current.sessionCount += next.sessionCount
	current.startedAt = mergeUploadBatchStartedAt(current.startedAt, next.startedAt)
	if current.progressMode != next.progressMode {
		current.progressMode = transferPhaseProgressModeIndeterminate
	}
	if current.progressMode == transferPhaseProgressModeIndeterminate {
		current.current = 0
		current.total = 0
		current.speed = 0
		current.progressUnit = ""
	}
	if current.progressUnit == "" {
		current.progressUnit = next.progressUnit
	}
	return current
}

func (s *Server) resolveUploadBatchPhaseView(
	ctx context.Context,
	sessions []store.UploadSession,
) uploadPhaseView {
	selected := uploadBatchPhaseAggregate{}
	for _, session := range sessions {
		candidate := s.buildUploadBatchPhaseAggregate(ctx, session)
		if candidate.detail == "" {
			continue
		}
		if selected.detail == "" || preferUploadBatchAggregate(candidate, selected) {
			selected = candidate
			continue
		}
		if candidate.detail == selected.detail {
			selected = mergeUploadBatchAggregate(selected, candidate)
		}
	}

	if selected.detail == "" {
		return uploadPhaseView{}
	}

	var progress *transferProgressDTO
	if selected.progressMode != transferPhaseProgressModeIndeterminate {
		progress = runtimePhaseProgressDTO(selected.current, selected.total, selected.progressUnit)
	}
	speed := selected.speed
	if selected.progressMode == transferPhaseProgressModeIndeterminate {
		speed = 0
	}

	return uploadPhaseView{
		Detail:           selected.detail,
		Progress:         progress,
		ProgressMode:     selected.progressMode,
		SpeedBytesPerSec: speed,
		StartedAt:        selected.startedAt,
	}
}
