package api

import (
	"net/http"

	"github.com/const/tg-cloud-drive/backend/internal/store"
)

type storageTypeStatsDTO struct {
	Bytes int64 `json:"bytes"`
	Count int64 `json:"count"`
}

type storageStatsDTO struct {
	TotalBytes int64                          `json:"totalBytes"`
	TotalFiles int64                          `json:"totalFiles"`
	ByType     map[string]storageTypeStatsDTO `json:"byType"`
}

func (s *Server) handleGetStorageStats(w http.ResponseWriter, r *http.Request) {
	stats, err := store.New(s.db).GetStorageStats(r.Context())
	if err != nil {
		s.logger.Error("get storage stats failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal_error", "读取存储统计失败")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"stats": toStorageStatsDTO(stats),
	})
}

func toStorageStatsDTO(stats store.StorageStats) storageStatsDTO {
	byType := map[string]storageTypeStatsDTO{}
	keys := []store.ItemType{
		store.ItemTypeImage,
		store.ItemTypeVideo,
		store.ItemTypeAudio,
		store.ItemTypeDocument,
		store.ItemTypeArchive,
		store.ItemTypeCode,
		store.ItemTypeOther,
	}

	for _, key := range keys {
		value := stats.ByType[key]
		byType[string(key)] = storageTypeStatsDTO{
			Bytes: value.Bytes,
			Count: value.Count,
		}
	}

	return storageStatsDTO{
		TotalBytes: stats.TotalBytes,
		TotalFiles: stats.TotalFiles,
		ByType:     byType,
	}
}
