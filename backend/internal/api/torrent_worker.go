package api

import (
	"context"
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/const/tg-cloud-drive/backend/internal/store"
	itorrent "github.com/const/tg-cloud-drive/backend/internal/torrent"
	"github.com/google/uuid"
)

func (s *Server) startTorrentTaskWorkerLoop() {
	if !s.cfg.TorrentEnabled {
		return
	}
	go func() {
		pollInterval := s.cfg.TorrentWorkerPollInterval
		if pollInterval <= 0 {
			pollInterval = 3 * time.Second
		}
		for {
			processed, err := s.runOneTorrentTaskCycle(context.Background())
			if err != nil {
				s.logger.Warn("torrent worker cycle failed", "error", err.Error())
				time.Sleep(pollInterval)
				continue
			}
			if !processed {
				time.Sleep(pollInterval)
			}
		}
	}()
}

func (s *Server) runOneTorrentTaskCycle(ctx context.Context) (bool, error) {
	if !s.isSystemInitialized() || s.db == nil || !s.cfg.TorrentEnabled {
		return false, nil
	}
	if err := os.MkdirAll(s.cfg.TorrentWorkDir, 0o755); err != nil {
		return false, err
	}
	if err := os.MkdirAll(s.cfg.TorrentDownloadDir, 0o755); err != nil {
		return false, err
	}

	now := time.Now()
	st := store.New(s.db)

	queuedTask, err := st.ClaimNextTorrentTask(
		ctx,
		[]store.TorrentTaskStatus{store.TorrentTaskStatusQueued},
		store.TorrentTaskStatusDownloading,
		now,
	)
	if err == nil {
		if runErr := s.processDownloadingTorrentTask(ctx, queuedTask); runErr != nil {
			msg := strings.TrimSpace(runErr.Error())
			if msg == "" {
				msg = "下载任务处理失败"
			}
			_ = st.FinishTorrentTask(context.Background(), queuedTask.ID, store.TorrentTaskStatusError, &msg, time.Now())
			return true, runErr
		}
		return true, nil
	}
	if err != nil && !errors.Is(err, store.ErrNotFound) {
		return false, err
	}

	downloadingTask, err := st.ClaimNextTorrentTask(
		ctx,
		[]store.TorrentTaskStatus{store.TorrentTaskStatusDownloading},
		store.TorrentTaskStatusDownloading,
		now,
	)
	if err == nil {
		if runErr := s.processDownloadingTorrentTask(ctx, downloadingTask); runErr != nil {
			msg := strings.TrimSpace(runErr.Error())
			if msg == "" {
				msg = "下载任务处理失败"
			}
			_ = st.FinishTorrentTask(context.Background(), downloadingTask.ID, store.TorrentTaskStatusError, &msg, time.Now())
			return true, runErr
		}
		return true, nil
	}
	if err != nil && !errors.Is(err, store.ErrNotFound) {
		return false, err
	}

	uploadingTask, err := st.ClaimNextTorrentTask(
		ctx,
		[]store.TorrentTaskStatus{
			store.TorrentTaskStatusUploading,
			store.TorrentTaskStatusAwaitingSelection,
		},
		store.TorrentTaskStatusUploading,
		now,
	)
	if err == nil {
		if runErr := s.processUploadingTorrentTask(ctx, uploadingTask); runErr != nil {
			msg := strings.TrimSpace(runErr.Error())
			if msg == "" {
				msg = "上传任务处理失败"
			}
			_ = st.FinishTorrentTask(context.Background(), uploadingTask.ID, store.TorrentTaskStatusError, &msg, time.Now())
			return true, runErr
		}
		return true, nil
	}
	if err != nil && !errors.Is(err, store.ErrNotFound) {
		return false, err
	}

	cleanupTask, err := st.ClaimNextDueTorrentCleanupTask(ctx, now)
	if err == nil {
		s.processDueTorrentCleanupTask(ctx, st, cleanupTask)
		return true, nil
	}
	if err != nil && !errors.Is(err, store.ErrNotFound) {
		return false, err
	}

	return false, nil
}

func (s *Server) processDownloadingTorrentTask(ctx context.Context, task store.TorrentTask) error {
	st := store.New(s.db)
	qbt, err := s.newQBittorrentClient(ctx)
	if err != nil {
		return err
	}
	if err := qbt.Authenticate(ctx); err != nil {
		return fmt.Errorf("qBittorrent 认证失败: %w", err)
	}
	if s.cfg.TorrentQBTDisableDHTPexLSD {
		if err := qbt.SetPrivateProfile(ctx); err != nil {
			s.logger.Warn("set qBittorrent private profile failed", "error", err.Error())
		}
	}

	normalizedHash := strings.TrimSpace(strings.ToLower(task.InfoHash))
	if task.QBTorrentHash != nil && strings.TrimSpace(*task.QBTorrentHash) != "" {
		normalizedHash = strings.TrimSpace(strings.ToLower(*task.QBTorrentHash))
	}
	if task.QBTorrentHash == nil || strings.TrimSpace(*task.QBTorrentHash) == "" {
		torrentData, readErr := os.ReadFile(task.TorrentFilePath)
		if readErr != nil {
			return fmt.Errorf("读取 torrent 文件失败: %w", readErr)
		}
		if err := qbt.AddTorrentFile(ctx, filepath.Base(task.TorrentFilePath), torrentData, s.cfg.TorrentDownloadDir); err != nil {
			return err
		}
		if err := st.SetTorrentTaskQBTorrentHash(ctx, task.ID, normalizedHash, time.Now()); err != nil {
			return err
		}
		hashCopy := normalizedHash
		task.QBTorrentHash = &hashCopy
	}

	info, resolvedHash, err := s.resolveTorrentTaskInfo(ctx, st, qbt, task)
	if err != nil {
		return err
	}
	if info == nil {
		return nil
	}
	selectionByIndex := map[int]bool{}
	existingFiles, err := st.ListTorrentTaskFiles(ctx, task.ID)
	if err != nil {
		return err
	}
	for _, file := range existingFiles {
		selectionByIndex[file.FileIndex] = file.Selected
	}
	selectedIndexes := make([]int, 0, len(selectionByIndex))
	skippedIndexes := make([]int, 0, len(selectionByIndex))
	for idx, selected := range selectionByIndex {
		if selected {
			selectedIndexes = append(selectedIndexes, idx)
			continue
		}
		skippedIndexes = append(skippedIndexes, idx)
	}
	if len(skippedIndexes) > 0 {
		priorityHash := strings.TrimSpace(strings.ToLower(resolvedHash))
		if priorityHash == "" {
			priorityHash = strings.TrimSpace(strings.ToLower(info.Hash))
		}
		if priorityHash != "" {
			if err := qbt.SetTorrentFilePriority(ctx, priorityHash, skippedIndexes, 0); err != nil {
				s.logger.Warn("set torrent skipped file priority failed", "task_id", task.ID.String(), "error", err.Error())
			}
			if len(selectedIndexes) > 0 {
				if err := qbt.SetTorrentFilePriority(ctx, priorityHash, selectedIndexes, 1); err != nil {
					s.logger.Warn("set torrent selected file priority failed", "task_id", task.ID.String(), "error", err.Error())
				}
			}
		}
	}

	estimated := info.TotalSize
	if estimated <= 0 {
		estimated = task.EstimatedSize
	}
	downloaded := info.Completed
	if downloaded <= 0 && estimated > 0 && info.Progress > 0 {
		downloaded = int64(float64(estimated) * info.Progress)
	}
	if downloaded > estimated && estimated > 0 {
		downloaded = estimated
	}
	if err := st.UpdateTorrentTaskProgress(ctx, task.ID, downloaded, estimated, info.Progress, time.Now()); err != nil {
		return err
	}

	completed := info.AmountLeft <= 0 || info.Progress >= 0.999
	if !completed {
		return nil
	}

	if resolvedHash == "" {
		resolvedHash = strings.TrimSpace(strings.ToLower(info.Hash))
	}
	if resolvedHash == "" {
		return errors.New("下载任务缺少可用 torrent hash")
	}

	files, err := qbt.GetTorrentFiles(ctx, resolvedHash)
	if err != nil {
		return err
	}
	if len(files) == 0 {
		return errors.New("下载完成但未找到可用文件")
	}

	fileRows := make([]store.TorrentTaskFile, 0, len(files))
	for _, file := range files {
		absPath := resolveDownloadedFilePath(info, file, len(files))
		selected := true
		if len(selectionByIndex) > 0 {
			if preset, ok := selectionByIndex[file.Index]; ok {
				selected = preset
			}
		}
		fileRows = append(fileRows, store.TorrentTaskFile{
			TaskID:    task.ID,
			FileIndex: file.Index,
			FilePath:  absPath,
			FileName:  filepath.Base(absPath),
			FileSize:  file.Size,
			Selected:  selected,
			Uploaded:  false,
		})
	}
	if err := st.ReplaceTorrentTaskFiles(ctx, task.ID, fileRows, time.Now()); err != nil {
		return err
	}

	if err := st.SetTorrentTaskStatus(ctx, task.ID, store.TorrentTaskStatusUploading, nil, time.Now()); err != nil {
		return err
	}
	_ = st.UpdateTorrentTaskProgress(ctx, task.ID, estimated, estimated, 1, time.Now())
	return nil
}

func (s *Server) resolveTorrentTaskInfo(
	ctx context.Context,
	st *store.Store,
	qbt *itorrent.QBittorrentClient,
	task store.TorrentTask,
) (*itorrent.QBittorrentTorrentInfo, string, error) {
	hashes := make([]string, 0, 2)
	if task.QBTorrentHash != nil {
		hashes = append(hashes, strings.TrimSpace(strings.ToLower(*task.QBTorrentHash)))
	}
	hashes = append(hashes, strings.TrimSpace(strings.ToLower(task.InfoHash)))

	seen := map[string]struct{}{}
	for _, hash := range hashes {
		if hash == "" {
			continue
		}
		if _, ok := seen[hash]; ok {
			continue
		}
		seen[hash] = struct{}{}

		info, err := qbt.GetTorrentInfo(ctx, hash)
		if err != nil {
			return nil, "", err
		}
		if info == nil {
			continue
		}
		resolvedHash := normalizeTorrentHash(info.Hash)
		if resolvedHash == "" {
			resolvedHash = hash
		}
		if err := s.syncResolvedTorrentHash(ctx, st, task, resolvedHash); err != nil {
			return nil, "", err
		}
		return info, resolvedHash, nil
	}

	info, err := s.findTorrentInfoByTaskMeta(ctx, qbt, task)
	if err != nil {
		return nil, "", err
	}
	if info == nil {
		return nil, "", nil
	}

	resolvedHash := normalizeTorrentHash(info.Hash)
	if resolvedHash == "" {
		return nil, "", nil
	}
	if err := s.syncResolvedTorrentHash(ctx, st, task, resolvedHash); err != nil {
		return nil, "", err
	}
	return info, resolvedHash, nil
}

func (s *Server) syncResolvedTorrentHash(
	ctx context.Context,
	st *store.Store,
	task store.TorrentTask,
	resolvedHash string,
) error {
	resolvedHash = normalizeTorrentHash(resolvedHash)
	if resolvedHash == "" {
		return nil
	}
	currentHash := ""
	if task.QBTorrentHash != nil {
		currentHash = normalizeTorrentHash(*task.QBTorrentHash)
	}
	if currentHash == resolvedHash {
		return nil
	}
	return st.SetTorrentTaskQBTorrentHash(ctx, task.ID, resolvedHash, time.Now())
}

func (s *Server) findTorrentInfoByTaskMeta(
	ctx context.Context,
	qbt *itorrent.QBittorrentClient,
	task store.TorrentTask,
) (*itorrent.QBittorrentTorrentInfo, error) {
	targetName := strings.TrimSpace(task.TorrentName)
	if targetName == "" {
		return nil, nil
	}

	infos, err := qbt.ListTorrentInfos(ctx)
	if err != nil {
		return nil, err
	}
	if len(infos) == 0 {
		return nil, nil
	}

	downloadRoot := strings.TrimSpace(s.cfg.TorrentDownloadDir)
	var (
		fallbackByName     *itorrent.QBittorrentTorrentInfo
		fallbackByNameSize *itorrent.QBittorrentTorrentInfo
	)

	for _, info := range infos {
		if !strings.EqualFold(strings.TrimSpace(info.Name), targetName) {
			continue
		}
		sizeMatched := task.EstimatedSize <= 0 || info.TotalSize <= 0 || info.TotalSize == task.EstimatedSize
		candidate := info
		if downloadRoot != "" {
			savePath := strings.TrimSpace(candidate.SavePath)
			contentPath := strings.TrimSpace(candidate.ContentPath)
			inRoot := (savePath != "" && pathInsideBaseDir(savePath, downloadRoot)) ||
				(contentPath != "" && pathInsideBaseDir(contentPath, downloadRoot))
			if inRoot {
				if sizeMatched {
					return &candidate, nil
				}
				if fallbackByName == nil {
					fallbackByName = &candidate
				}
				continue
			}
		}
		if sizeMatched && fallbackByNameSize == nil {
			fallbackByNameSize = &candidate
		}
		if fallbackByName == nil {
			fallbackByName = &candidate
		}
	}
	if fallbackByNameSize != nil {
		return fallbackByNameSize, nil
	}
	return fallbackByName, nil
}

func normalizeTorrentHash(raw string) string {
	return strings.TrimSpace(strings.ToLower(raw))
}

func resolveDownloadedFilePath(
	info *itorrent.QBittorrentTorrentInfo,
	file itorrent.QBittorrentTorrentFile,
	totalFiles int,
) string {
	fileName := strings.TrimSpace(filepath.FromSlash(file.Name))
	if fileName == "" {
		fileName = fmt.Sprintf("file-%d", file.Index)
	}
	contentPath := strings.TrimSpace(info.ContentPath)
	savePath := strings.TrimSpace(info.SavePath)

	// 单文件优先使用 content_path（通常是完整绝对路径）
	if totalFiles == 1 && contentPath != "" {
		return filepath.Clean(contentPath)
	}

	baseDir := contentPath
	if baseDir == "" {
		baseDir = savePath
	}
	if baseDir == "" {
		return filepath.Clean(fileName)
	}

	candidate := filepath.Clean(filepath.Join(baseDir, fileName))
	if _, err := os.Stat(candidate); err == nil {
		return candidate
	}

	// 部分 qBittorrent 版本的 name 可能已包含顶层目录，回退到 save_path 再拼一次。
	if savePath != "" {
		alt := filepath.Clean(filepath.Join(savePath, fileName))
		if _, err := os.Stat(alt); err == nil {
			return alt
		}
	}
	return candidate
}

func (s *Server) processUploadingTorrentTask(ctx context.Context, task store.TorrentTask) error {
	st := store.New(s.db)
	files, err := s.ensureTorrentTaskPendingUploadFiles(ctx, st, task)
	if err != nil {
		return err
	}

	for _, file := range files {
		settings, setErr := s.getRuntimeSettings(ctx)
		if setErr != nil {
			return setErr
		}
		if err := s.acquireUploadSlot(ctx, settings.UploadConcurrency); err != nil {
			return err
		}

		startedAt := time.Now()
		item, processMeta, uploadErr := s.uploadTorrentTaskFileToTelegram(ctx, task, file)
		s.releaseUpload()

		finishedAt := time.Now()
		if uploadErr != nil {
			_ = st.MarkTorrentTaskFileError(ctx, task.ID, file.FileIndex, uploadErr.Error(), finishedAt)
			s.recordTorrentTransferHistory(
				context.Background(),
				task,
				file,
				nil,
				processMeta,
				startedAt,
				finishedAt,
				store.TransferStatusError,
				uploadErr.Error(),
			)
			return uploadErr
		}

		if err := st.MarkTorrentTaskFileUploaded(ctx, task.ID, file.FileIndex, item.ID, finishedAt); err != nil {
			return err
		}
		s.recordTorrentTransferHistory(
			context.Background(),
			task,
			file,
			&item.ID,
			processMeta,
			startedAt,
			finishedAt,
			store.TransferStatusCompleted,
			"",
		)
	}

	completedAt := time.Now()
	if err := st.FinishTorrentTask(ctx, task.ID, store.TorrentTaskStatusCompleted, nil, completedAt); err != nil {
		return err
	}
	s.scheduleTorrentTaskSourceCleanup(ctx, st, task)
	return nil
}

func (s *Server) ensureTorrentTaskPendingUploadFiles(
	ctx context.Context,
	st *store.Store,
	task store.TorrentTask,
) ([]store.TorrentTaskFile, error) {
	files, err := st.ListTorrentTaskPendingUploadFiles(ctx, task.ID)
	if err != nil {
		return nil, err
	}
	if len(files) > 0 {
		return files, nil
	}

	allFiles, err := st.ListTorrentTaskFiles(ctx, task.ID)
	if err != nil {
		return nil, err
	}
	if len(allFiles) == 0 {
		return nil, errors.New("下载完成但未找到可上传文件")
	}

	indexes := make([]int, 0, len(allFiles))
	for _, file := range allFiles {
		if file.Uploaded {
			continue
		}
		indexes = append(indexes, file.FileIndex)
	}
	if len(indexes) == 0 {
		return nil, errors.New("当前任务没有待上传文件")
	}

	now := time.Now()
	if err := st.SetTorrentTaskFileSelection(ctx, task.ID, indexes, now); err != nil {
		return nil, err
	}
	if task.Status != store.TorrentTaskStatusUploading {
		if err := st.SetTorrentTaskStatus(ctx, task.ID, store.TorrentTaskStatusUploading, nil, now); err != nil {
			return nil, err
		}
	}

	files, err = st.ListTorrentTaskPendingUploadFiles(ctx, task.ID)
	if err != nil {
		return nil, err
	}
	if len(files) == 0 {
		return nil, errors.New("自动选择上传文件失败")
	}
	return files, nil
}

func (s *Server) scheduleTorrentTaskSourceCleanup(
	ctx context.Context,
	st *store.Store,
	task store.TorrentTask,
) {
	settings, err := s.getRuntimeSettings(ctx)
	if err != nil {
		s.logger.Warn("get runtime settings failed while scheduling torrent cleanup", "error", err.Error(), "task_id", task.ID.String())
		settings = s.defaultRuntimeSettings()
	}

	mode, err := normalizeTorrentSourceDeleteMode(settings.TorrentSourceDeleteMode)
	if err != nil {
		mode = torrentSourceDeleteModeImmediate
	}

	dueAt := resolveTorrentSourceCleanupDueAt(settings, time.Now())
	if mode == torrentSourceDeleteModeImmediate {
		cleaned := s.executeTorrentTaskSourceCleanup(ctx, st, task)
		if cleaned {
			if err := st.MarkTorrentTaskSourceCleanupDone(ctx, task.ID, time.Now()); err != nil {
				s.logger.Warn("mark torrent source cleanup done failed", "error", err.Error(), "task_id", task.ID.String())
			}
			return
		}
		retryAt := time.Now().Add(1 * time.Minute)
		if err := st.SetTorrentTaskSourceCleanupSchedule(ctx, task.ID, retryAt, time.Now()); err != nil {
			s.logger.Warn("set torrent source cleanup retry schedule failed", "error", err.Error(), "task_id", task.ID.String())
		}
		return
	}

	if err := st.SetTorrentTaskSourceCleanupSchedule(ctx, task.ID, dueAt, time.Now()); err != nil {
		s.logger.Warn("set torrent source cleanup schedule failed", "error", err.Error(), "task_id", task.ID.String())
	}
}

func (s *Server) processDueTorrentCleanupTask(ctx context.Context, st *store.Store, task store.TorrentTask) {
	cleaned := s.executeTorrentTaskSourceCleanup(ctx, st, task)
	if cleaned {
		if err := st.MarkTorrentTaskSourceCleanupDone(ctx, task.ID, time.Now()); err != nil {
			s.logger.Warn("mark torrent source cleanup done failed", "error", err.Error(), "task_id", task.ID.String())
		}
		return
	}

	retryAt := time.Now().Add(1 * time.Minute)
	if err := st.SetTorrentTaskSourceCleanupSchedule(ctx, task.ID, retryAt, time.Now()); err != nil {
		s.logger.Warn("set torrent source cleanup retry schedule failed", "error", err.Error(), "task_id", task.ID.String())
	}
}

func (s *Server) executeTorrentTaskSourceCleanup(ctx context.Context, st *store.Store, task store.TorrentTask) bool {
	files, err := st.ListTorrentTaskFiles(ctx, task.ID)
	if err != nil {
		s.logger.Warn("list torrent task files failed while cleanup", "error", err.Error(), "task_id", task.ID.String())
		return false
	}
	warnings := s.cleanupTorrentTaskResources(ctx, task, files)
	for _, warning := range warnings {
		s.logger.Warn("cleanup torrent task resource warning", "warning", warning, "task_id", task.ID.String())
	}
	return !s.hasTorrentTaskLocalResidual(task, files)
}

func (s *Server) hasTorrentTaskLocalResidual(task store.TorrentTask, files []store.TorrentTaskFile) bool {
	seen := make(map[string]struct{}, len(files))
	for _, file := range files {
		filePath := strings.TrimSpace(file.FilePath)
		if filePath == "" {
			continue
		}
		if _, ok := seen[filePath]; ok {
			continue
		}
		seen[filePath] = struct{}{}
		if _, err := os.Stat(filePath); err == nil {
			return true
		} else if err != nil && !errors.Is(err, os.ErrNotExist) {
			return true
		}
	}

	torrentPath := strings.TrimSpace(task.TorrentFilePath)
	if torrentPath == "" {
		return false
	}
	if _, err := os.Stat(torrentPath); err == nil {
		return true
	} else if err != nil && !errors.Is(err, os.ErrNotExist) {
		return true
	}
	return false
}

func (s *Server) uploadTorrentTaskFileToTelegram(
	ctx context.Context,
	task store.TorrentTask,
	file store.TorrentTaskFile,
) (store.Item, *videoUploadProcessMeta, error) {
	filePath := strings.TrimSpace(file.FilePath)
	if filePath == "" {
		return store.Item{}, nil, errors.New("任务文件路径为空")
	}
	info, err := os.Stat(filePath)
	if err != nil {
		return store.Item{}, nil, fmt.Errorf("读取任务文件失败: %w", err)
	}
	if info.IsDir() {
		return store.Item{}, nil, errors.New("暂不支持直接上传目录")
	}
	if info.Size() <= 0 {
		return store.Item{}, nil, errors.New("空文件不支持上传")
	}

	mimeType := inferMimeTypeByPath(filePath)
	fileName := strings.TrimSpace(file.FileName)
	if fileName == "" {
		fileName = filepath.Base(filePath)
	}
	if fileName == "" {
		fileName = fmt.Sprintf("torrent-%d.bin", file.FileIndex)
	}

	now := time.Now()
	st := store.New(s.db)
	itemType := store.GuessItemType(fileName, mimeType)
	var mimePtr *string
	if mimeType != "" {
		mimePtr = &mimeType
	}

	it, err := st.CreateFileItem(ctx, task.TargetParentID, itemType, fileName, 0, mimePtr, now)
	if err != nil {
		return store.Item{}, nil, err
	}

	cleanupItem := func() {
		_ = st.DeleteItemsByPathPrefix(ctx, it.Path)
	}

	accessMethod, err := s.resolveUploadAccessMethod(ctx)
	if err != nil {
		cleanupItem()
		return store.Item{}, nil, err
	}

	caption := fmt.Sprintf("tgcd:%s", it.ID.String())

	if normalizeUploadAccessMethod(accessMethod) == setupAccessMethodSelfHosted {
		msg, processMeta, sendErr := s.sendMediaFromLocalPathWithRetry(
			ctx,
			s.cfg.TGStorageChatID,
			fileName,
			filePath,
			mimeType,
			caption,
		)
		if sendErr != nil {
			cleanupItem()
			return store.Item{}, processMeta, sendErr
		}
		resolvedDoc, docErr := s.resolveMessageDocument(ctx, msg)
		if docErr != nil {
			if msg.MessageID > 0 {
				_ = s.deleteMessageWithRetry(ctx, s.cfg.TGStorageChatID, msg.MessageID)
			}
			cleanupItem()
			return store.Item{}, processMeta, docErr
		}
		ch := store.Chunk{
			ID:             uuid.New(),
			ItemID:         it.ID,
			ChunkIndex:     0,
			ChunkSize:      int(info.Size()),
			TGChatID:       s.cfg.TGStorageChatID,
			TGMessageID:    msg.MessageID,
			TGFileID:       resolvedDoc.FileID,
			TGFileUniqueID: resolvedDoc.FileUniqueID,
			CreatedAt:      now,
		}
		if err := st.InsertChunk(ctx, ch); err != nil {
			_ = s.deleteMessageWithRetry(ctx, ch.TGChatID, ch.TGMessageID)
			cleanupItem()
			return store.Item{}, processMeta, err
		}
		if err := st.UpdateItemSize(ctx, it.ID, info.Size(), time.Now()); err != nil {
			_ = s.deleteMessageWithRetry(ctx, ch.TGChatID, ch.TGMessageID)
			cleanupItem()
			return store.Item{}, processMeta, err
		}
		updated, err := st.GetItem(ctx, it.ID)
		if err != nil {
			return store.Item{}, processMeta, err
		}
		return updated, processMeta, nil
	}

	singleLimit := officialBotAPISingleUploadLimitBytes(fileName, mimeType)
	if info.Size() <= singleLimit {
		msg, processMeta, sendErr := s.sendMediaFromPathWithRetry(
			ctx,
			s.cfg.TGStorageChatID,
			fileName,
			filePath,
			mimeType,
			caption,
		)
		if sendErr != nil {
			cleanupItem()
			return store.Item{}, processMeta, sendErr
		}
		resolvedDoc, docErr := s.resolveMessageDocument(ctx, msg)
		if docErr != nil {
			if msg.MessageID > 0 {
				_ = s.deleteMessageWithRetry(ctx, s.cfg.TGStorageChatID, msg.MessageID)
			}
			cleanupItem()
			return store.Item{}, processMeta, docErr
		}
		ch := store.Chunk{
			ID:             uuid.New(),
			ItemID:         it.ID,
			ChunkIndex:     0,
			ChunkSize:      int(info.Size()),
			TGChatID:       s.cfg.TGStorageChatID,
			TGMessageID:    msg.MessageID,
			TGFileID:       resolvedDoc.FileID,
			TGFileUniqueID: resolvedDoc.FileUniqueID,
			CreatedAt:      now,
		}
		if err := st.InsertChunk(ctx, ch); err != nil {
			_ = s.deleteMessageWithRetry(ctx, ch.TGChatID, ch.TGMessageID)
			cleanupItem()
			return store.Item{}, processMeta, err
		}
		if err := st.UpdateItemSize(ctx, it.ID, info.Size(), time.Now()); err != nil {
			_ = s.deleteMessageWithRetry(ctx, ch.TGChatID, ch.TGMessageID)
			cleanupItem()
			return store.Item{}, processMeta, err
		}
		updated, err := st.GetItem(ctx, it.ID)
		if err != nil {
			return store.Item{}, processMeta, err
		}
		return updated, processMeta, nil
	}

	uploaded, totalBytes, uploadErr := s.uploadChunksFromTempFile(
		ctx,
		st,
		it.ID,
		fileName,
		filePath,
		s.cfg.ChunkSizeBytes,
		now,
	)
	if uploadErr != nil {
		for _, chunk := range uploaded {
			_ = s.deleteMessageWithRetry(ctx, chunk.TGChatID, chunk.TGMessageID)
		}
		cleanupItem()
		return store.Item{}, nil, uploadErr
	}
	if totalBytes <= 0 {
		cleanupItem()
		return store.Item{}, nil, errors.New("分片上传结果为空")
	}
	if err := st.UpdateItemSize(ctx, it.ID, totalBytes, time.Now()); err != nil {
		for _, chunk := range uploaded {
			_ = s.deleteMessageWithRetry(ctx, chunk.TGChatID, chunk.TGMessageID)
		}
		cleanupItem()
		return store.Item{}, nil, err
	}
	updated, err := st.GetItem(ctx, it.ID)
	if err != nil {
		return store.Item{}, nil, err
	}
	return updated, nil, nil
}

func inferMimeTypeByPath(filePath string) string {
	ext := strings.TrimSpace(strings.ToLower(filepath.Ext(filePath)))
	if ext != "" {
		if mimeType := strings.TrimSpace(mime.TypeByExtension(ext)); mimeType != "" {
			if idx := strings.Index(mimeType, ";"); idx >= 0 {
				return strings.TrimSpace(mimeType[:idx])
			}
			return mimeType
		}
	}

	f, err := os.Open(filePath)
	if err != nil {
		return ""
	}
	defer f.Close()

	buf := make([]byte, 512)
	n, err := io.ReadFull(f, buf)
	if err != nil && !errors.Is(err, io.EOF) && !errors.Is(err, io.ErrUnexpectedEOF) {
		return ""
	}
	if n <= 0 {
		return ""
	}
	return strings.TrimSpace(http.DetectContentType(buf[:n]))
}

func (s *Server) recordTorrentTransferHistory(
	ctx context.Context,
	task store.TorrentTask,
	file store.TorrentTaskFile,
	itemID *uuid.UUID,
	processMeta *videoUploadProcessMeta,
	startedAt time.Time,
	finishedAt time.Time,
	status store.TransferStatus,
	errMsg string,
) {
	var (
		errPtr            *string
		faststartApplied  *bool
		faststartFallback *bool
		previewAttached   *bool
		previewFallback   *bool
	)
	if trimmed := strings.TrimSpace(errMsg); trimmed != "" {
		errPtr = &trimmed
	}
	if processMeta != nil {
		faststartApplied = boolPtr(processMeta.FaststartApplied)
		faststartFallback = boolPtr(processMeta.FaststartFallback)
		previewAttached = boolPtr(processMeta.PreviewAttached)
		previewFallback = boolPtr(processMeta.PreviewFallback)
	}

	sourceTaskID := fmt.Sprintf("torrent:%s:%d", task.ID.String(), file.FileIndex)
	entry := store.TransferHistory{
		ID:                           uuid.New(),
		SourceTaskID:                 sourceTaskID,
		Direction:                    store.TransferDirectionUpload,
		FileID:                       itemID,
		FileName:                     file.FileName,
		Size:                         file.FileSize,
		Status:                       status,
		Error:                        errPtr,
		UploadVideoFaststartApplied:  faststartApplied,
		UploadVideoFaststartFallback: faststartFallback,
		UploadVideoPreviewAttached:   previewAttached,
		UploadVideoPreviewFallback:   previewFallback,
		StartedAt:                    startedAt,
		FinishedAt:                   finishedAt,
		CreatedAt:                    finishedAt,
		UpdatedAt:                    finishedAt,
	}
	if _, err := store.New(s.db).UpsertTransferHistory(ctx, entry); err != nil {
		s.logger.Warn("upsert torrent transfer history failed", "error", err.Error(), "task_id", task.ID.String(), "file_index", file.FileIndex)
	}
}

func boolPtr(v bool) *bool {
	b := v
	return &b
}

func (s *Server) newQBittorrentClient(ctx context.Context) (*itorrent.QBittorrentClient, error) {
	password := strings.TrimSpace(s.cfg.TorrentQBTPassword)
	if s.db != nil && s.isSystemInitialized() {
		settings, err := s.getRuntimeSettings(ctx)
		if err == nil {
			runtimePassword := strings.TrimSpace(settings.TorrentQBTPassword)
			if runtimePassword != "" {
				password = runtimePassword
			}
		} else {
			s.logger.Warn("read runtime qBittorrent password failed, fallback to env", "error", err.Error())
		}
	}

	return itorrent.NewQBittorrentClient(
		s.cfg.TorrentQBTBaseURL,
		s.cfg.TorrentQBTUsername,
		password,
		s.cfg.TorrentQBTTimeout,
	)
}
