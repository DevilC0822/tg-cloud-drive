package api

import (
	"github.com/const/tg-cloud-drive/backend/internal/store"
	"mime"
	"path/filepath"
	"strings"
)

const binaryMimeType = "application/octet-stream"

func normalizeMimeType(raw string) string {
	normalized := strings.ToLower(strings.TrimSpace(raw))
	if idx := strings.Index(normalized, ";"); idx >= 0 {
		normalized = strings.TrimSpace(normalized[:idx])
	}
	return normalized
}

func inferMimeTypeByFileName(fileName string) string {
	ext := strings.ToLower(strings.TrimSpace(filepath.Ext(fileName)))
	if ext == "" {
		return ""
	}
	return normalizeMimeType(mime.TypeByExtension(ext))
}

func normalizeUploadMimeType(fileName string, rawMimeType string) string {
	normalized := normalizeMimeType(rawMimeType)
	if normalized != "" && normalized != binaryMimeType {
		return normalized
	}
	inferred := inferMimeTypeByFileName(fileName)
	if inferred != "" {
		return inferred
	}
	return normalized
}

func resolveDownloadMimeType(it store.Item) string {
	rawMimeType := ""
	if it.MimeType != nil {
		rawMimeType = *it.MimeType
	}

	normalized := normalizeMimeType(rawMimeType)
	if normalized != "" && normalized != binaryMimeType {
		return normalized
	}
	inferred := inferMimeTypeByFileName(it.Name)
	if inferred != "" {
		return inferred
	}
	if normalized != "" {
		return normalized
	}
	return binaryMimeType
}

func isPreviewableItemType(itemType store.ItemType) bool {
	switch itemType {
	case store.ItemTypeImage, store.ItemTypeVideo, store.ItemTypeAudio:
		return true
	default:
		return false
	}
}

func shouldInlinePreviewDownload(itemType store.ItemType, mimeType string, forceDownload bool) bool {
	if forceDownload {
		return false
	}
	if isPreviewableMime(mimeType) {
		return true
	}
	return isPreviewableItemType(itemType)
}
