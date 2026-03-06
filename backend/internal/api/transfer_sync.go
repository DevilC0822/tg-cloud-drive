package api

import (
	"context"

	"github.com/const/tg-cloud-drive/backend/internal/store"
	"github.com/google/uuid"
)

func (s *Server) syncTransferJobEvent(ctx context.Context, job store.TransferJob) {
	if job.Status == store.TransferJobStatusRunning {
		s.publishRunningTransferJob(ctx, job)
		return
	}
	s.publishFinishedTransferJob(ctx, job)
}

func (s *Server) syncTransferJobByID(ctx context.Context, id uuid.UUID) {
	job, err := store.New(s.db).GetTransferJobByID(ctx, id)
	if err != nil {
		return
	}
	s.syncTransferJobEvent(ctx, job)
}

func (s *Server) publishRunningTransferJob(ctx context.Context, job store.TransferJob) {
	item, err := s.buildTransferJobViewDTO(ctx, job)
	if err != nil {
		return
	}
	s.publishTransferEvent(transferStreamEvent{Type: "job_upsert", Item: &item})
}

func (s *Server) publishFinishedTransferJob(ctx context.Context, job store.TransferJob) {
	item, err := s.buildTransferJobViewDTO(ctx, job)
	if err != nil {
		return
	}
	id := item.ID
	s.publishTransferEvent(transferStreamEvent{Type: "job_remove", ID: &id})
	s.publishTransferEvent(transferStreamEvent{Type: "history_upsert", Item: &item})
}

func (s *Server) publishTransferDeletion(id uuid.UUID) {
	value := id.String()
	s.publishTransferEvent(transferStreamEvent{Type: "job_remove", ID: &value})
	s.publishTransferEvent(transferStreamEvent{Type: "history_remove", ID: &value})
}
