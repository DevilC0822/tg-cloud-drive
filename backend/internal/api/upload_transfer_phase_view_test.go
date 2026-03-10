package api

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"tg-cloud-drive-api/internal/store"
)

func TestResolveUploadSessionPhaseViewUploadingChunks(t *testing.T) {
	server := &Server{uploadRuntime: map[uuid.UUID]uploadTransferRuntimeState{}}
	now := time.Now()

	localSession := store.UploadSession{
		ID:          uuid.New(),
		UploadMode:  store.UploadSessionModeLocalStaged,
		TotalChunks: 4,
		CreatedAt:   now,
	}
	localView := server.resolveUploadSessionPhaseView(context.Background(), localSession, transferPhaseUploadingChunks, 2)
	if localView.Detail != transferPhaseDetailLocalChunkUploading {
		t.Fatalf("local detail = %q, want %q", localView.Detail, transferPhaseDetailLocalChunkUploading)
	}
	if localView.ProgressMode != transferPhaseProgressModeDeterminate {
		t.Fatalf("local progress mode = %q, want %q", localView.ProgressMode, transferPhaseProgressModeDeterminate)
	}
	if localView.Progress == nil || localView.Progress.Current != 2 || localView.Progress.Total != 4 {
		t.Fatalf("local progress = %#v, want current=2 total=4", localView.Progress)
	}
	if len(localView.Steps) != 4 {
		t.Fatalf("local steps = %v, want 4 steps", localView.Steps)
	}

	directSession := store.UploadSession{
		ID:          uuid.New(),
		UploadMode:  store.UploadSessionModeDirectChunk,
		TotalChunks: 5,
		CreatedAt:   now,
	}
	directView := server.resolveUploadSessionPhaseView(context.Background(), directSession, transferPhaseUploadingChunks, 3)
	if directView.Detail != transferPhaseDetailChunkProcessing {
		t.Fatalf("direct detail = %q, want %q", directView.Detail, transferPhaseDetailChunkProcessing)
	}
	if directView.Progress == nil || directView.Progress.Current != 3 || directView.Progress.Total != 5 {
		t.Fatalf("direct progress = %#v, want current=3 total=5", directView.Progress)
	}
	if len(directView.Steps) != 2 {
		t.Fatalf("direct steps = %v, want 2 steps", directView.Steps)
	}
}

func TestResolveUploadSessionPhaseViewRuntimeModes(t *testing.T) {
	sessionID := uuid.New()
	startedAt := time.Now().Add(-10 * time.Second)
	server := &Server{
		uploadRuntime: map[uuid.UUID]uploadTransferRuntimeState{
			sessionID: {
				PhaseDetail:    transferPhaseDetailUploadingToTelegram,
				ProgressMode:   transferPhaseProgressModeIndeterminate,
				PhaseStartedAt: startedAt,
				UpdatedAt:      startedAt,
			},
		},
	}

	session := store.UploadSession{
		ID:         sessionID,
		UploadMode: store.UploadSessionModeLocalStaged,
		UpdatedAt:  time.Now(),
	}
	view := server.resolveUploadSessionPhaseView(context.Background(), session, transferPhaseFinalizing, 1)
	if view.Detail != transferPhaseDetailUploadingToTelegram {
		t.Fatalf("detail = %q, want %q", view.Detail, transferPhaseDetailUploadingToTelegram)
	}
	if view.ProgressMode != transferPhaseProgressModeIndeterminate {
		t.Fatalf("progress mode = %q, want %q", view.ProgressMode, transferPhaseProgressModeIndeterminate)
	}
	if view.Progress != nil {
		t.Fatalf("progress = %#v, want nil for indeterminate phase", view.Progress)
	}
	if view.StartedAt == nil || !view.StartedAt.Equal(startedAt) {
		t.Fatalf("startedAt = %v, want %v", view.StartedAt, startedAt)
	}
}

func TestResolveUploadBatchPhaseViewPriority(t *testing.T) {
	uploadingID := uuid.New()
	localID := uuid.New()
	startedAt := time.Now().Add(-30 * time.Second)
	server := &Server{
		uploadRuntime: map[uuid.UUID]uploadTransferRuntimeState{
			uploadingID: {
				PhaseDetail:    transferPhaseDetailUploadingToTelegram,
				ProgressMode:   transferPhaseProgressModeIndeterminate,
				PhaseStartedAt: startedAt,
				UpdatedAt:      startedAt,
			},
		},
	}

	sessions := []store.UploadSession{
		{
			ID:             uploadingID,
			UploadMode:     store.UploadSessionModeLocalStaged,
			Status:         store.UploadSessionStatusUploading,
			UploadedChunks: 4,
			TotalChunks:    4,
			CreatedAt:      startedAt.Add(-5 * time.Second),
			UpdatedAt:      startedAt,
		},
		{
			ID:             localID,
			UploadMode:     store.UploadSessionModeLocalStaged,
			Status:         store.UploadSessionStatusUploading,
			UploadedChunks: 1,
			TotalChunks:    4,
			CreatedAt:      startedAt.Add(-2 * time.Second),
			UpdatedAt:      startedAt.Add(2 * time.Second),
		},
	}

	view := server.resolveUploadBatchPhaseView(context.Background(), sessions)
	if view.Detail != transferPhaseDetailUploadingToTelegram {
		t.Fatalf("detail = %q, want %q", view.Detail, transferPhaseDetailUploadingToTelegram)
	}
	if view.ProgressMode != transferPhaseProgressModeIndeterminate {
		t.Fatalf("progress mode = %q, want %q", view.ProgressMode, transferPhaseProgressModeIndeterminate)
	}
	if view.Progress != nil {
		t.Fatalf("progress = %#v, want nil for indeterminate aggregate", view.Progress)
	}
}
