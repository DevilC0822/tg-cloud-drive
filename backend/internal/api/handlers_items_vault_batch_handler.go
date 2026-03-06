package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/const/tg-cloud-drive/backend/internal/store"
	"github.com/google/uuid"
)

func (s *Server) handleBatchSetItemsVault(w http.ResponseWriter, r *http.Request) {
	if !s.requireVaultUnlocked(w, r) {
		return
	}

	req, err := decodeBatchVaultRequest(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", err.Error())
		return
	}

	ids, err := parseUniqueBatchVaultIDs(req.ItemIDs)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", err.Error())
		return
	}

	st := store.New(s.db)
	targets, initialFailures, err := s.loadBatchVaultTargets(r.Context(), st, ids)
	if err != nil {
		s.logger.Error("load batch vault targets failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "查询文件失败")
		return
	}

	enabled := *req.Enabled
	now := time.Now()
	totalTargets := len(ids)
	if isVaultProgressStreamRequested(r.URL.Query().Get("progress")) {
		s.streamBatchVaultSync(w, r, st, targets, initialFailures, enabled, now, totalTargets)
		return
	}

	summary, runErr := s.runBatchVaultSync(r.Context(), st, targets, initialFailures, enabled, now, totalTargets, nil)
	if runErr != nil {
		s.logger.Error("batch vault sync failed", "error", runErr.Error())
		writeError(w, http.StatusBadGateway, "bad_gateway", runErr.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"summary": summary})
}

func decodeBatchVaultRequest(r *http.Request) (batchSetItemVaultRequest, error) {
	var req batchSetItemVaultRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return batchSetItemVaultRequest{}, fmt.Errorf("请求体不是合法 JSON")
	}
	if req.Enabled == nil {
		return batchSetItemVaultRequest{}, fmt.Errorf("缺少 enabled 字段")
	}
	if len(req.ItemIDs) == 0 {
		return batchSetItemVaultRequest{}, fmt.Errorf("缺少 itemIds")
	}
	return req, nil
}

func parseUniqueBatchVaultIDs(rawIDs []string) ([]uuid.UUID, error) {
	seen := map[string]struct{}{}
	ids := make([]uuid.UUID, 0, len(rawIDs))
	for _, raw := range rawIDs {
		trimmed := strings.TrimSpace(raw)
		if trimmed == "" {
			return nil, fmt.Errorf("itemIds 包含空值")
		}
		id, err := uuid.Parse(trimmed)
		if err != nil {
			return nil, fmt.Errorf("itemIds 包含非法 id")
		}
		key := id.String()
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		ids = append(ids, id)
	}
	if len(ids) == 0 {
		return nil, fmt.Errorf("itemIds 不能为空")
	}
	return ids, nil
}

func (s *Server) loadBatchVaultTargets(
	ctx context.Context,
	st *store.Store,
	ids []uuid.UUID,
) ([]store.Item, []vaultBatchFailure, error) {
	targets := make([]store.Item, 0, len(ids))
	initialFailures := make([]vaultBatchFailure, 0)
	for _, id := range ids {
		item, err := st.GetItem(ctx, id)
		if err != nil {
			failure, handled := mapBatchVaultLookupFailure(id, err)
			if handled {
				initialFailures = append(initialFailures, failure)
				continue
			}
			return nil, nil, err
		}
		targets = append(targets, item)
	}
	return targets, initialFailures, nil
}

func mapBatchVaultLookupFailure(id uuid.UUID, err error) (vaultBatchFailure, bool) {
	if !errors.Is(err, store.ErrNotFound) {
		return vaultBatchFailure{}, false
	}
	return vaultBatchFailure{
		ItemID: id.String(),
		Name:   id.String(),
		Stage:  "lookup",
		Error:  "文件不存在",
	}, true
}

func (s *Server) streamBatchVaultSync(
	w http.ResponseWriter,
	r *http.Request,
	st *store.Store,
	targets []store.Item,
	initialFailures []vaultBatchFailure,
	enabled bool,
	now time.Time,
	totalTargets int,
) {
	streamWriter, err := newVaultProgressStreamWriter(w)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "服务端不支持流式进度")
		return
	}
	writer := func(event vaultBatchProgressEvent) error {
		return streamWriter.write(event)
	}
	summary, runErr := s.runBatchVaultSync(r.Context(), st, targets, initialFailures, enabled, now, totalTargets, writer)
	if runErr == nil {
		return
	}
	_ = writer(vaultBatchProgressEvent{
		Type:             vaultBatchProgressEventError,
		Enabled:          boolPointer(enabled),
		Message:          runErr.Error(),
		TotalTargets:     summary.TotalTargets,
		DoneTargets:      summary.SucceededTargets + summary.FailedTargets,
		SucceededTargets: summary.SucceededTargets,
		FailedTargets:    summary.FailedTargets,
		Percent:          vaultBatchOverallPercent(summary.SucceededTargets+summary.FailedTargets, summary.TotalTargets),
	})
}
