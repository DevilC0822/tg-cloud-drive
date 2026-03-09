package api

import (
	"context"
	"fmt"
	"sort"
	"strings"

	"tg-cloud-drive-api/internal/store"

	"github.com/google/uuid"
)

const (
	uploadFolderConflictPreviewLimit = 3
	uploadFolderConflictGenericMsg   = "目标位置存在同名文件或文件夹，目录上传已整体取消"
)

func (s *Server) describeUploadFolderConflict(
	ctx context.Context,
	parentID *uuid.UUID,
	manifest uploadFolderManifest,
) string {
	items, err := s.loadUploadFolderConflictItems(ctx, parentID, manifest)
	if err != nil {
		s.logger.Warn("load upload folder conflict items failed", "error", err.Error())
		return uploadFolderConflictGenericMsg
	}
	return buildUploadFolderConflictMessage(items)
}

func (s *Server) loadUploadFolderConflictItems(
	ctx context.Context,
	parentID *uuid.UUID,
	manifest uploadFolderManifest,
) ([]store.Item, error) {
	parentPath, err := s.resolveUploadFolderParentPath(ctx, parentID)
	if err != nil {
		return nil, err
	}
	paths := collectUploadFolderTargetPaths(parentPath, manifest)
	return store.New(s.db).ListItemsByExactPaths(ctx, paths)
}

func (s *Server) resolveUploadFolderParentPath(ctx context.Context, parentID *uuid.UUID) (string, error) {
	if parentID == nil {
		return "/", nil
	}
	item, err := store.New(s.db).GetItem(ctx, *parentID)
	if err != nil {
		return "", err
	}
	if item.Type != store.ItemTypeFolder {
		return "", store.ErrBadInput
	}
	return item.Path, nil
}

func buildUploadFolderConflictMessage(items []store.Item) string {
	if len(items) == 0 {
		return uploadFolderConflictGenericMsg
	}
	preview, hiddenVaultOnly, hasVault := summarizeUploadFolderConflicts(items)
	switch {
	case hiddenVaultOnly:
		return fmt.Sprintf(
			"目标位置存在同名密码箱文件或文件夹：%s。当前文件视图不会显示密码箱项目，目录上传已整体取消",
			preview,
		)
	case hasVault:
		return fmt.Sprintf("目标位置存在同名文件或文件夹（含密码箱项目）：%s，目录上传已整体取消", preview)
	default:
		return fmt.Sprintf("目标位置存在同名文件或文件夹：%s，目录上传已整体取消", preview)
	}
}

func summarizeUploadFolderConflicts(items []store.Item) (string, bool, bool) {
	labels := make([]string, 0, len(items))
	hiddenVaultOnly := true
	hasVault := false
	for _, item := range items {
		if item.InVault {
			hasVault = true
		} else {
			hiddenVaultOnly = false
		}
		labels = append(labels, formatUploadFolderConflictLabel(item))
	}
	sort.Strings(labels)
	labels = uniqueUploadFolderConflictLabels(labels)
	return joinUploadFolderConflictPreview(labels), hiddenVaultOnly, hasVault
}

func formatUploadFolderConflictLabel(item store.Item) string {
	if item.InVault {
		return item.Path + "（密码箱）"
	}
	return item.Path
}

func joinUploadFolderConflictPreview(labels []string) string {
	if len(labels) == 0 {
		return ""
	}
	limit := uploadFolderConflictPreviewLimit
	if len(labels) <= limit {
		return strings.Join(labels, "、")
	}
	return fmt.Sprintf("%s 等 %d 项", strings.Join(labels[:limit], "、"), len(labels))
}

func uniqueUploadFolderConflictLabels(labels []string) []string {
	if len(labels) == 0 {
		return nil
	}
	seen := make(map[string]struct{}, len(labels))
	out := make([]string, 0, len(labels))
	for _, label := range labels {
		if _, ok := seen[label]; ok {
			continue
		}
		seen[label] = struct{}{}
		out = append(out, label)
	}
	return out
}
