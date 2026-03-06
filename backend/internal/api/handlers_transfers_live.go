package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/const/tg-cloud-drive/backend/internal/store"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

const (
	activeTransfersPageSize      = 200
	transferStreamKeepAliveEvery = 15 * time.Second
)

type createDownloadTransferRequest struct {
	ItemID string `json:"itemId"`
}

func (s *Server) handleGetActiveTransfers(w http.ResponseWriter, r *http.Request) {
	items, err := s.listActiveTransferViews(r.Context())
	if err != nil {
		s.logger.Error("list active transfers failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "查询当前传输失败")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (s *Server) handleGetTransferDetail(w http.ResponseWriter, r *http.Request) {
	id, err := parseUUIDParam(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "id 非法")
		return
	}

	job, err := store.New(s.db).GetTransferJobByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "传输记录不存在")
			return
		}
		s.logger.Error("get transfer detail failed", "error", err.Error(), "id", id.String())
		writeError(w, http.StatusInternalServerError, "internal_error", "读取传输详情失败")
		return
	}

	detail, err := s.buildTransferDetailDTO(r.Context(), job)
	if err != nil {
		s.logger.Error("build transfer detail failed", "error", err.Error(), "id", id.String())
		writeError(w, http.StatusInternalServerError, "internal_error", "组装传输详情失败")
		return
	}
	writeJSON(w, http.StatusOK, detail)
}

func (s *Server) handleTransferStream(w http.ResponseWriter, r *http.Request) {
	flusher, ok := resolveResponseWriterFlusher(w)
	if !ok {
		writeError(w, http.StatusInternalServerError, "internal_error", "服务端不支持流式传输")
		return
	}

	w.Header().Set("Content-Type", "text/event-stream; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)
	flusher.Flush()

	snapshot, err := s.listActiveTransferViews(r.Context())
	if err != nil {
		s.logger.Warn("load transfer stream snapshot failed", "error", err.Error())
	}
	for _, item := range snapshot {
		event := transferStreamEvent{Type: "job_upsert", Item: &item}
		if err := writeTransferSSEEvent(w, event); err != nil {
			return
		}
		flusher.Flush()
	}

	subscriptionID, events := s.subscribeTransferEvents()
	defer s.unsubscribeTransferEvents(subscriptionID)

	keepAlive := time.NewTicker(transferStreamKeepAliveEvery)
	defer keepAlive.Stop()

	for {
		select {
		case <-r.Context().Done():
			return
		case <-keepAlive.C:
			if _, err := fmt.Fprint(w, ": ping\n\n"); err != nil {
				return
			}
			flusher.Flush()
		case event, ok := <-events:
			if !ok {
				return
			}
			if err := writeTransferSSEEvent(w, event); err != nil {
				return
			}
			flusher.Flush()
		}
	}
}

func (s *Server) handleCreateDownloadTransfer(w http.ResponseWriter, r *http.Request) {
	var req createDownloadTransferRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "请求体不是合法 JSON")
		return
	}

	itemID, err := uuid.Parse(strings.TrimSpace(req.ItemID))
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "itemId 非法")
		return
	}

	st := store.New(s.db)
	item, err := st.GetItem(r.Context(), itemID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "文件不存在")
			return
		}
		s.logger.Error("get download transfer item failed", "error", err.Error(), "item_id", itemID.String())
		writeError(w, http.StatusInternalServerError, "internal_error", "读取文件失败")
		return
	}
	if item.Type == store.ItemTypeFolder {
		writeError(w, http.StatusBadRequest, "bad_request", "文件夹不支持下载")
		return
	}
	if item.InVault && !s.requireVaultUnlocked(w, r) {
		return
	}

	totalSize, err := s.resolveDownloadTransferSize(r.Context(), item)
	if err != nil {
		s.logger.Error("resolve download transfer size failed", "error", err.Error(), "item_id", item.ID.String())
		writeError(w, http.StatusInternalServerError, "internal_error", "读取文件大小失败")
		return
	}

	job := buildDownloadTransferJob(item, totalSize, time.Now())
	if err := st.CreateTransferJob(r.Context(), job); err != nil {
		s.logger.Error("create download transfer job failed", "error", err.Error(), "item_id", item.ID.String())
		writeError(w, http.StatusInternalServerError, "internal_error", "创建下载任务失败")
		return
	}

	s.setDownloadTransferProgress(job.ID, item.ID, totalSize, 0)
	s.syncTransferJobEvent(r.Context(), job)

	itemDTO, buildErr := s.buildTransferJobViewDTO(r.Context(), job)
	if buildErr != nil {
		itemDTO = toTransferJobViewDTO(job)
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"transferJobId": job.ID.String(),
		"downloadUrl":   buildDownloadTransferURL(item.ID, job.ID),
		"job":           itemDTO,
	})
}

func (s *Server) listActiveTransferViews(ctx context.Context) ([]transferJobViewDTO, error) {
	items, _, err := store.New(s.db).ListTransferJobsByQuery(ctx, store.TransferJobListParams{
		Status:   transferJobStatusPointer(store.TransferJobStatusRunning),
		Page:     1,
		PageSize: activeTransfersPageSize,
	})
	if err != nil {
		return nil, err
	}

	views := make([]transferJobViewDTO, 0, len(items))
	for _, item := range items {
		view, buildErr := s.buildTransferJobViewDTO(ctx, item)
		if buildErr != nil {
			views = append(views, toTransferJobViewDTO(item))
			continue
		}
		views = append(views, view)
	}
	sort.SliceStable(views, func(i int, j int) bool {
		return views[i].UpdatedAt.After(views[j].UpdatedAt)
	})
	return views, nil
}

func writeTransferSSEEvent(w http.ResponseWriter, event transferStreamEvent) error {
	payload, err := json.Marshal(event)
	if err != nil {
		return err
	}
	_, err = fmt.Fprintf(w, "data: %s\n\n", payload)
	return err
}

func transferJobStatusPointer(status store.TransferJobStatus) *store.TransferJobStatus {
	return &status
}

func buildDownloadTransferJob(item store.Item, totalSize int64, now time.Time) store.TransferJob {
	jobID := uuid.New()
	return store.TransferJob{
		ID:             jobID,
		Direction:      store.TransferDirectionDownload,
		SourceKind:     store.TransferSourceKindDownloadTask,
		SourceRef:      jobID.String(),
		UnitKind:       store.TransferUnitKindFile,
		Name:           strings.TrimSpace(item.Name),
		TargetItemID:   &item.ID,
		TotalSize:      totalSize,
		ItemCount:      1,
		CompletedCount: 0,
		ErrorCount:     0,
		CanceledCount:  0,
		Status:         store.TransferJobStatusRunning,
		LastError:      nil,
		StartedAt:      now,
		FinishedAt:     now,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
}

func buildDownloadTransferURL(itemID uuid.UUID, jobID uuid.UUID) string {
	return fmt.Sprintf("/api/items/%s/content?download=1&transferId=%s", itemID.String(), jobID.String())
}

func (s *Server) resolveDownloadTransferSize(ctx context.Context, item store.Item) (int64, error) {
	if item.Size > 0 {
		return item.Size, nil
	}
	chunks, err := store.New(s.db).ListChunks(ctx, item.ID)
	if err != nil {
		return 0, err
	}
	total := int64(0)
	for _, chunk := range chunks {
		total += int64(chunk.ChunkSize)
	}
	return total, nil
}
