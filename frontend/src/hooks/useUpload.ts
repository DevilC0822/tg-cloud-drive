import { useCallback } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { uploadTasksAtom, isDragActiveAtom } from '@/stores/uploadAtoms';
import { currentFolderIdAtom } from '@/stores/fileAtoms';
import { uploadConcurrencyAtom } from '@/stores/uiAtoms';
import type { UploadTask, FileItem } from '@/types';
import { generateId } from '@/utils/fileUtils';
import { apiFetchJson, dtoToFileItem, type ItemDTO } from '@/utils/api';

type UploadHookOptions = {
  onUploaded?: (item: FileItem) => void;
};

type UploadSessionDTO = {
  id: string;
  itemId: string;
  fileName: string;
  fileSize: number;
  chunkSize: number;
  totalChunks: number;
  status: string;
  uploadedChunks: number[];
  uploadedCount: number;
};

type UploadProcessDTO = {
  videoFaststartApplied: boolean;
  videoFaststartFallback: boolean;
  videoPreviewAttached: boolean;
  videoPreviewFallback: boolean;
};

type UploadResult = {
  item: FileItem;
  uploadProcess?: UploadProcessDTO;
};

type UploadResultDTO = {
  item: ItemDTO;
  uploadProcess?: UploadProcessDTO | null;
};

type UploadSessionChunkResult = UploadSessionDTO & {
  uploadProcess?: UploadProcessDTO;
};

function normalizeUploadProcess(input?: UploadProcessDTO | null): UploadProcessDTO | undefined {
  if (!input) return undefined;
  return {
    videoFaststartApplied: !!input.videoFaststartApplied,
    videoFaststartFallback: !!input.videoFaststartFallback,
    videoPreviewAttached: !!input.videoPreviewAttached,
    videoPreviewFallback: !!input.videoPreviewFallback,
  };
}

function uploadFileXHR(file: File, parentId: string | null, chunked: boolean): {
  promise: Promise<UploadResult>;
  cancel: () => void;
  onProgress: (cb: (pct: number) => void) => void;
} {
  const xhr = new XMLHttpRequest();

  let progressCb: ((pct: number) => void) | null = null;

  const promise = new Promise<UploadResult>((resolve, reject) => {
    xhr.open('POST', '/api/files/upload');
    xhr.withCredentials = true;
    xhr.setRequestHeader('X-TGCD-Chunked', chunked ? '1' : '0');
    if (parentId) {
      xhr.setRequestHeader('X-TGCD-Parent-Id', parentId);
    }

    xhr.upload.onprogress = (evt) => {
      if (!evt.lengthComputable) return;
      const pct = Math.round((evt.loaded / evt.total) * 100);
      progressCb?.(Math.min(99, Math.max(0, pct)));
    };

    xhr.onload = () => {
      try {
        const text = xhr.responseText || '';
        const data = text ? (JSON.parse(text) as UploadResultDTO & { message?: string }) : null;
        if (xhr.status >= 200 && xhr.status < 300 && data?.item) {
          progressCb?.(100);
          resolve({
            item: dtoToFileItem(data.item),
            uploadProcess: normalizeUploadProcess(data.uploadProcess),
          });
          return;
        }

        const message = data?.message || `上传失败（${xhr.status}）`;
        reject(new Error(message));
      } catch {
        reject(new Error(`上传失败（${xhr.status}）`));
      }
    };

    xhr.onerror = () => reject(new Error('网络错误'));
    xhr.onabort = () => reject(new Error('已取消'));

    const form = new FormData();
    if (parentId) {
      form.append('parentId', parentId);
    }
    form.append('chunked', chunked ? '1' : '0');
    form.append('file', file, file.name);

    xhr.send(form);
  });

  return {
    promise,
    cancel: () => xhr.abort(),
    onProgress: (cb) => {
      progressCb = cb;
    },
  };
}

async function createUploadSession(file: File, parentId: string | null): Promise<UploadSessionDTO> {
  const res = await apiFetchJson<{ session: UploadSessionDTO }>('/api/uploads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      parentId,
      name: file.name,
      mimeType: file.type || null,
      size: file.size,
    }),
  });
  return res.session;
}

async function getUploadSession(sessionId: string): Promise<UploadSessionDTO> {
  const res = await apiFetchJson<{ session: UploadSessionDTO }>(`/api/uploads/${sessionId}`);
  return res.session;
}

async function uploadSessionChunk(sessionId: string, chunkIndex: number, chunk: Blob, fileName: string): Promise<UploadSessionChunkResult> {
  const form = new FormData();
  form.append('chunk', chunk, `${fileName}.part${String(chunkIndex).padStart(5, '0')}`);

  const res = await apiFetchJson<{ session: UploadSessionDTO; uploadProcess?: UploadProcessDTO | null }>(`/api/uploads/${sessionId}/chunks/${chunkIndex}`, {
    method: 'POST',
    body: form,
  });
  return {
    ...res.session,
    uploadProcess: normalizeUploadProcess(res.uploadProcess),
  };
}

async function completeUploadSession(sessionId: string): Promise<UploadResult> {
  const res = await apiFetchJson<UploadResultDTO>(`/api/uploads/${sessionId}/complete`, {
    method: 'POST',
  });
  return {
    item: dtoToFileItem(res.item),
    uploadProcess: normalizeUploadProcess(res.uploadProcess),
  };
}

/**
 * 上传逻辑 Hook（真实后端上传）
 */
export function useUpload(options?: UploadHookOptions) {
  const [uploadTasks, setUploadTasks] = useAtom(uploadTasksAtom);
  const [isDragActive, setIsDragActive] = useAtom(isDragActiveAtom);
  const currentFolderId = useAtomValue(currentFolderIdAtom);
  const uploadConcurrency = useAtomValue(uploadConcurrencyAtom);

  const addUploadTask = useCallback(
    (file: File): UploadTask => {
      const now = Date.now();
      const task: UploadTask = {
        id: generateId(),
        file,
        progress: 0,
        status: 'pending',
        startedAt: now,
        updatedAt: now,
      };

      setUploadTasks((prev) => [...prev, task]);
      return task;
    },
    [setUploadTasks]
  );

  const updateTask = useCallback(
    (taskId: string, patch: Partial<UploadTask>) => {
      const now = Date.now();
      setUploadTasks((prev) =>
        prev.map((task) => {
          if (task.id !== taskId) return task;

          const nextStatus = patch.status ?? task.status;
          const next: UploadTask = {
            ...task,
            ...patch,
            updatedAt: now,
          };

          if (patch.status === 'uploading' && task.status !== 'uploading') {
            next.startedAt = now;
            next.finishedAt = undefined;
          }

          if (nextStatus === 'completed' || nextStatus === 'error') {
            next.finishedAt = now;
            if (!next.startedAt) next.startedAt = now;
          }

          return next;
        })
      );
    },
    [setUploadTasks]
  );

  const removeTask = useCallback(
    (taskId: string) => {
      setUploadTasks((prev) => prev.filter((task) => task.id !== taskId));
    },
    [setUploadTasks]
  );

  const clearCompletedTasks = useCallback(() => {
    setUploadTasks((prev) => prev.filter((task) => task.status !== 'completed'));
  }, [setUploadTasks]);

  const clearAllTasks = useCallback(() => {
    setUploadTasks([]);
  }, [setUploadTasks]);

  const runStandardUpload = useCallback(
    async (taskId: string, file: File, parentId: string | null) => {
      updateTask(taskId, {
        status: 'uploading',
        progress: 0,
        error: undefined,
        resumable: false,
        targetParentId: parentId,
        uploadVideoFaststartApplied: undefined,
        uploadVideoFaststartFallback: undefined,
        uploadVideoPreviewAttached: undefined,
        uploadVideoPreviewFallback: undefined,
      });

      const { promise, onProgress } = uploadFileXHR(file, parentId, false);
      onProgress((pct) => {
        updateTask(taskId, { progress: pct, status: pct >= 100 ? 'completed' : 'uploading' });
      });

      try {
        const result = await promise;
        updateTask(taskId, {
          progress: 100,
          status: 'completed',
          error: undefined,
          uploadVideoFaststartApplied: result.uploadProcess?.videoFaststartApplied,
          uploadVideoFaststartFallback: result.uploadProcess?.videoFaststartFallback,
          uploadVideoPreviewAttached: result.uploadProcess?.videoPreviewAttached,
          uploadVideoPreviewFallback: result.uploadProcess?.videoPreviewFallback,
        });
        const item = result.item;
        options?.onUploaded?.(item);
        return item;
      } catch (err: unknown) {
        updateTask(taskId, {
          status: 'error',
          error: err instanceof Error ? err.message : '上传失败',
          resumable: false,
        });
        return null;
      }
    },
    [options, updateTask]
  );

  const runResumableUpload = useCallback(
    async (taskId: string, file: File, parentId: string | null, existingSessionId?: string) => {
      try {
        updateTask(taskId, {
          status: 'uploading',
          error: undefined,
          resumable: true,
          targetParentId: parentId,
          uploadVideoFaststartApplied: undefined,
          uploadVideoFaststartFallback: undefined,
          uploadVideoPreviewAttached: undefined,
          uploadVideoPreviewFallback: undefined,
        });

        const session = existingSessionId
          ? await getUploadSession(existingSessionId)
          : await createUploadSession(file, parentId);

        const uploadedSet = new Set<number>(session.uploadedChunks || []);
        updateTask(taskId, {
          uploadSessionId: session.id,
          totalChunkCount: session.totalChunks,
          uploadedChunkCount: uploadedSet.size,
          progress: Math.min(99, Math.round((uploadedSet.size / Math.max(session.totalChunks, 1)) * 100)),
        });

        let detectedUploadProcess: UploadProcessDTO | undefined;
        for (let idx = 0; idx < session.totalChunks; idx += 1) {
          if (uploadedSet.has(idx)) continue;

          const start = idx * session.chunkSize;
          const end = Math.min(file.size, start + session.chunkSize);
          const chunk = file.slice(start, end);
          const uploadedSession = await uploadSessionChunk(session.id, idx, chunk, file.name);
          if (uploadedSession.uploadProcess) {
            detectedUploadProcess = uploadedSession.uploadProcess;
          }

          uploadedSet.add(idx);
          updateTask(taskId, {
            uploadedChunkCount: uploadedSet.size,
            totalChunkCount: session.totalChunks,
            progress: Math.min(99, Math.round((uploadedSet.size / Math.max(session.totalChunks, 1)) * 100)),
          });
        }

        const completed = await completeUploadSession(session.id);
        const finalUploadProcess = completed.uploadProcess ?? detectedUploadProcess;
        updateTask(taskId, {
          progress: 100,
          status: 'completed',
          error: undefined,
          uploadedChunkCount: session.totalChunks,
          totalChunkCount: session.totalChunks,
          uploadVideoFaststartApplied: finalUploadProcess?.videoFaststartApplied,
          uploadVideoFaststartFallback: finalUploadProcess?.videoFaststartFallback,
          uploadVideoPreviewAttached: finalUploadProcess?.videoPreviewAttached,
          uploadVideoPreviewFallback: finalUploadProcess?.videoPreviewFallback,
        });
        const item = completed.item;
        options?.onUploaded?.(item);
        return item;
      } catch (err: unknown) {
        updateTask(taskId, {
          status: 'error',
          error: err instanceof Error ? err.message : '上传失败',
          resumable: true,
        });
        return null;
      }
    },
    [options, updateTask]
  );

  const uploadFile = useCallback(
    async (file: File, parentId?: string | null) => {
      const task = addUploadTask(file);
      const resolvedParentId = parentId === undefined ? currentFolderId : parentId;
      // 上传统一走会话分片路径，接入模式差异由后端在 complete 阶段处理。
      return runResumableUpload(task.id, file, resolvedParentId ?? null);
    },
    [addUploadTask, currentFolderId, runResumableUpload]
  );

  const retryTask = useCallback(
    async (taskId: string) => {
      const task = uploadTasks.find((it) => it.id === taskId);
      if (!task) return null;

      if (task.resumable) {
        return runResumableUpload(
          task.id,
          task.file,
          task.targetParentId ?? null,
          task.uploadSessionId
        );
      }
      return runStandardUpload(task.id, task.file, task.targetParentId ?? null);
    },
    [runResumableUpload, runStandardUpload, uploadTasks]
  );

  const uploadFiles = useCallback(
    async (files: FileList | File[], parentId?: string | null) => {
      const fileArray = Array.from(files);
      const results: Array<FileItem | null> = new Array(fileArray.length).fill(null);
      const concurrency = Math.max(1, Math.floor(uploadConcurrency || 1));
      let nextIndex = 0;

      const worker = async () => {
        while (nextIndex < fileArray.length) {
          const currentIndex = nextIndex;
          nextIndex += 1;
          // eslint-disable-next-line no-await-in-loop
          const item = await uploadFile(fileArray[currentIndex], parentId);
          results[currentIndex] = item;
        }
      };

      const workerCount = Math.min(concurrency, fileArray.length);
      const workers = Array.from({ length: workerCount }, () => worker());
      for (const task of workers) {
        // eslint-disable-next-line no-await-in-loop
        await task;
      }
      return results;
    },
    [uploadConcurrency, uploadFile]
  );

  // 拖拽事件处理
  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(true);
    },
    [setIsDragActive]
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(false);
    },
    [setIsDragActive]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, parentId?: string | null) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        uploadFiles(files, parentId);
      }
    },
    [setIsDragActive, uploadFiles]
  );

  return {
    uploadTasks,
    isDragActive,
    uploadFile,
    uploadFiles,
    retryTask,
    addUploadTask,
    removeTask,
    clearCompletedTasks,
    clearAllTasks,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
  };
}
