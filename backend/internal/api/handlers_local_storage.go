package api

import (
	"context"
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/const/tg-cloud-drive/backend/internal/store"
	"github.com/go-chi/chi/v5"
)

type localResidualFileDTO struct {
	FileName     string `json:"fileName"`
	FileSize     int64  `json:"fileSize"`
	ExistsOnDisk bool   `json:"existsOnDisk"`
}

type localResidualTaskDTO struct {
	TaskID             string                 `json:"taskId"`
	TorrentName        string                 `json:"torrentName"`
	InfoHash           string                 `json:"infoHash"`
	Status             string                 `json:"status"`
	FinishedAt         *time.Time             `json:"finishedAt"`
	ResidualFiles      []localResidualFileDTO `json:"residualFiles"`
	TotalResidualBytes int64                  `json:"totalResidualBytes"`
	TotalResidualCount int                    `json:"totalResidualCount"`
}

const localResidualSummaryPageSize = 200

func (s *Server) handleListLocalResidual(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	page := intFromQuery(query.Get("page"), 1)
	pageSize := intFromQuery(query.Get("pageSize"), 20)
	if page < 1 {
		writeError(w, http.StatusBadRequest, "bad_request", "page 范围应为 >= 1")
		return
	}
	if pageSize < 1 || pageSize > 200 {
		writeError(w, http.StatusBadRequest, "bad_request", "pageSize 范围应为 1~200")
		return
	}

	st := store.New(s.db)
	tasks, total, err := st.ListUncleanedTorrentTasks(r.Context(), page, pageSize)
	if err != nil {
		s.logger.Error("list uncleaned torrent tasks failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "读取残留任务失败")
		return
	}

	items := make([]localResidualTaskDTO, 0, len(tasks))
	for _, task := range tasks {
		dto, err := s.buildLocalResidualTaskDTO(r.Context(), st, task)
		if err != nil {
			s.logger.Error("build local residual task failed", "error", err.Error(), "task_id", task.ID.String())
			writeError(w, http.StatusInternalServerError, "internal_error", "读取残留文件失败")
			return
		}
		items = append(items, dto)
	}
	totalResidualBytes, err := s.computeLocalResidualTotalBytes(r.Context(), st, total)
	if err != nil {
		s.logger.Error("compute local residual summary failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "读取残留统计失败")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"items": items,
		"summary": map[string]any{
			"totalTasks":         total,
			"totalResidualBytes": totalResidualBytes,
			"qbtAvailable":       s.isQBittorrentAvailable(r.Context()),
		},
		"pagination": map[string]any{
			"page":       page,
			"pageSize":   pageSize,
			"totalCount": total,
			"totalPages": calcTotalPages(total, pageSize),
		},
	})
}

func (s *Server) computeLocalResidualTotalBytes(ctx context.Context, st *store.Store, totalTasks int64) (int64, error) {
	if totalTasks <= 0 {
		return 0, nil
	}

	totalPages := calcTotalPages(totalTasks, localResidualSummaryPageSize)
	var totalBytes int64
	for page := 1; page <= int(totalPages); page++ {
		tasks, _, err := st.ListUncleanedTorrentTasks(ctx, page, localResidualSummaryPageSize)
		if err != nil {
			return 0, err
		}
		for _, task := range tasks {
			dto, err := s.buildLocalResidualTaskDTO(ctx, st, task)
			if err != nil {
				return 0, err
			}
			totalBytes += dto.TotalResidualBytes
		}
	}
	return totalBytes, nil
}

func (s *Server) handleCleanupLocalResidual(w http.ResponseWriter, r *http.Request) {
	taskID, err := parseUUIDParam(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "id 非法")
		return
	}

	st := store.New(s.db)
	task, err := st.GetTorrentTask(r.Context(), taskID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "Torrent 任务不存在")
			return
		}
		s.logger.Error("get torrent task failed", "error", err.Error(), "task_id", taskID.String())
		writeError(w, http.StatusInternalServerError, "internal_error", "读取 Torrent 任务失败")
		return
	}

	warnings := s.qbittorrentCleanupWarnings(r.Context(), task)
	cleaned := s.executeTorrentTaskSourceCleanup(r.Context(), st, task)
	if cleaned {
		if err := st.MarkTorrentTaskSourceCleanupDone(r.Context(), task.ID, time.Now()); err != nil {
			s.logger.Error("mark torrent cleanup done failed", "error", err.Error(), "task_id", task.ID.String())
			writeError(w, http.StatusInternalServerError, "internal_error", "更新清理状态失败")
			return
		}
	}
	if !cleaned && len(warnings) == 0 {
		warnings = append(warnings, "仍存在未清理的本地残留文件，请检查目录权限后重试")
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":       true,
		"cleaned":  cleaned,
		"warnings": warnings,
	})
}

func (s *Server) buildLocalResidualTaskDTO(
	ctx context.Context,
	st *store.Store,
	task store.TorrentTask,
) (localResidualTaskDTO, error) {
	files, err := st.ListTorrentTaskFiles(ctx, task.ID)
	if err != nil {
		return localResidualTaskDTO{}, err
	}

	residualFiles := make([]localResidualFileDTO, 0, len(files))
	var totalResidualBytes int64
	totalResidualCount := 0
	for _, file := range files {
		dto := s.inspectLocalResidualFile(task.ID.String(), file)
		residualFiles = append(residualFiles, dto)
		if dto.ExistsOnDisk {
			totalResidualCount++
			totalResidualBytes += dto.FileSize
		}
	}

	return localResidualTaskDTO{
		TaskID:             task.ID.String(),
		TorrentName:        task.TorrentName,
		InfoHash:           task.InfoHash,
		Status:             string(task.Status),
		FinishedAt:         task.FinishedAt,
		ResidualFiles:      residualFiles,
		TotalResidualBytes: totalResidualBytes,
		TotalResidualCount: totalResidualCount,
	}, nil
}

func (s *Server) inspectLocalResidualFile(taskID string, file store.TorrentTaskFile) localResidualFileDTO {
	filePath := strings.TrimSpace(file.FilePath)
	fileName := strings.TrimSpace(file.FileName)
	if fileName == "" && filePath != "" {
		fileName = filepath.Base(filePath)
	}

	dto := localResidualFileDTO{
		FileName:     fileName,
		FileSize:     0,
		ExistsOnDisk: false,
	}
	if filePath == "" {
		return dto
	}

	info, err := os.Stat(filePath)
	if err == nil {
		dto.ExistsOnDisk = true
		if !info.IsDir() {
			dto.FileSize = info.Size()
		}
		return dto
	}
	if errors.Is(err, os.ErrNotExist) {
		return dto
	}

	dto.ExistsOnDisk = true
	dto.FileSize = file.FileSize
	if dto.FileSize < 0 {
		dto.FileSize = 0
	}
	s.logger.Warn("stat local residual file failed", "error", err.Error(), "task_id", taskID, "file_path", filePath)
	return dto
}

func (s *Server) isQBittorrentAvailable(ctx context.Context) bool {
	qbt, err := s.newQBittorrentClient(ctx)
	if err != nil {
		return false
	}
	return qbt.Authenticate(ctx) == nil
}

func (s *Server) qbittorrentCleanupWarnings(ctx context.Context, task store.TorrentTask) []string {
	hash := resolveTorrentTaskCleanupHash(task)
	if hash == "" {
		return nil
	}

	qbt, err := s.newQBittorrentClient(ctx)
	if err != nil {
		return []string{"qBittorrent 不可用，本次仅尝试清理本地文件：" + err.Error()}
	}
	if err := qbt.Authenticate(ctx); err != nil {
		return []string{"qBittorrent 不可用，本次仅尝试清理本地文件：" + err.Error()}
	}
	return nil
}

func resolveTorrentTaskCleanupHash(task store.TorrentTask) string {
	if task.QBTorrentHash != nil {
		if hash := strings.TrimSpace(*task.QBTorrentHash); hash != "" {
			return hash
		}
	}
	return strings.TrimSpace(task.InfoHash)
}

func calcTotalPages(total int64, pageSize int) int64 {
	if pageSize <= 0 {
		return 1
	}
	totalPages := (total + int64(pageSize) - 1) / int64(pageSize)
	if totalPages <= 0 {
		return 1
	}
	return totalPages
}
