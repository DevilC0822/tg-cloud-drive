import { useAtom, useAtomValue } from 'jotai';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { uploadTasksAtom } from '@/stores/uploadAtoms';
import { downloadTasksAtom, transferHistoryAtom } from '@/stores/transferAtoms';
import type { DownloadTask, FileItem, TransferHistoryItem, UploadTask } from '@/types';
import { generateId } from '@/utils/fileUtils';
import { apiFetchJson } from '@/utils/api';

type DownloadStartResult =
  | { ok: true }
  | { ok: false; reason: string };

export type HistoryFilter = 'all' | 'upload' | 'download';

export interface HistoryPagination {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

interface UseTransferCenterOptions {
  enabled?: boolean;
}

type TransferHistoryDTO = {
  id: string;
  sourceTaskId: string;
  direction: 'upload' | 'download';
  fileId?: string | null;
  fileName: string;
  size: number;
  status: 'completed' | 'error' | 'canceled';
  startedAt: string;
  finishedAt: string;
  error?: string | null;
  uploadVideoFaststartApplied?: boolean | null;
  uploadVideoFaststartFallback?: boolean | null;
  uploadVideoPreviewAttached?: boolean | null;
  uploadVideoPreviewFallback?: boolean | null;
};

type TransferHistoryListResponse = {
  items: TransferHistoryDTO[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
};

type DownloadSource = Pick<FileItem, 'id' | 'name' | 'size' | 'type'>;

function fromTransferHistoryDTO(dto: TransferHistoryDTO): TransferHistoryItem {
  const startedAt = Date.parse(dto.startedAt);
  const finishedAt = Date.parse(dto.finishedAt);
  return {
    id: dto.id,
    sourceTaskId: dto.sourceTaskId,
    direction: dto.direction,
    fileId: dto.fileId ?? null,
    fileName: dto.fileName,
    size: dto.size,
    status: dto.status,
    startedAt: Number.isNaN(startedAt) ? Date.now() : startedAt,
    finishedAt: Number.isNaN(finishedAt) ? Date.now() : finishedAt,
    error: dto.error ?? undefined,
    uploadVideoFaststartApplied: dto.uploadVideoFaststartApplied ?? undefined,
    uploadVideoFaststartFallback: dto.uploadVideoFaststartFallback ?? undefined,
    uploadVideoPreviewAttached: dto.uploadVideoPreviewAttached ?? undefined,
    uploadVideoPreviewFallback: dto.uploadVideoPreviewFallback ?? undefined,
  };
}

function toUploadHistory(task: UploadTask): TransferHistoryItem {
  const terminalStatus = task.status === 'completed' ? 'completed' : 'error';
  const finishedAt = task.finishedAt ?? task.updatedAt ?? task.startedAt ?? Date.now();
  const startedAt = task.startedAt ?? finishedAt;
  return {
    id: `upload:${task.id}`,
    sourceTaskId: `upload:${task.id}`,
    direction: 'upload',
    fileId: null,
    fileName: task.file.name,
    size: task.file.size,
    status: terminalStatus,
    startedAt,
    finishedAt,
    error: terminalStatus === 'error' ? task.error : undefined,
    uploadVideoFaststartApplied: task.uploadVideoFaststartApplied,
    uploadVideoFaststartFallback: task.uploadVideoFaststartFallback,
    uploadVideoPreviewAttached: task.uploadVideoPreviewAttached,
    uploadVideoPreviewFallback: task.uploadVideoPreviewFallback,
  };
}

function toDownloadHistory(
  taskId: string,
  file: DownloadSource,
  status: TransferHistoryItem['status'],
  startedAt: number,
  finishedAt: number,
  error?: string
): TransferHistoryItem {
  return {
    id: `download:${taskId}`,
    sourceTaskId: `download:${taskId}`,
    direction: 'download',
    fileId: file.id,
    fileName: file.name,
    size: file.size,
    status,
    startedAt,
    finishedAt,
    error,
  };
}

function isUUID(raw: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw);
}

export function useTransferCenter(options: UseTransferCenterOptions = {}) {
  const enabled = options.enabled ?? true;
  const uploadTasks = useAtomValue(uploadTasksAtom);
  const [downloadTasks, setDownloadTasks] = useAtom(downloadTasksAtom);
  const [history, setHistory] = useAtom(transferHistoryAtom);
  const [historyFilter, setHistoryFilterState] = useState<HistoryFilter>('all');
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(20);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPagination, setHistoryPagination] = useState<HistoryPagination>({
    page: 1,
    pageSize: 20,
    totalCount: 0,
    totalPages: 1,
  });

  const xhrMapRef = useRef<Map<string, XMLHttpRequest>>(new Map());
  const syncedUploadRef = useRef<Map<string, string>>(new Map());

  const loadHistory = useCallback(async () => {
    if (!enabled) {
      return;
    }
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(historyPage));
      params.set('pageSize', String(historyPageSize));
      if (historyFilter !== 'all') {
        params.set('direction', historyFilter);
      }

      const res = await apiFetchJson<TransferHistoryListResponse>(
        `/api/transfers/history?${params.toString()}`
      );

      const next = (res.items || []).map(fromTransferHistoryDTO);
      const nextPagination: HistoryPagination = {
        page: Math.max(1, res.pagination?.page || historyPage),
        pageSize: Math.max(1, res.pagination?.pageSize || historyPageSize),
        totalCount: Math.max(0, res.pagination?.totalCount || 0),
        totalPages: Math.max(1, res.pagination?.totalPages || 1),
      };
      setHistoryPagination(nextPagination);
      setHistory(next);

      if (nextPagination.totalPages > 0 && historyPage > nextPagination.totalPages) {
        setHistoryPage(nextPagination.totalPages);
      }
    } catch {
      // 保持已有状态，避免瞬时网络波动导致页面被清空
    } finally {
      setHistoryLoading(false);
    }
  }, [enabled, historyFilter, historyPage, historyPageSize, setHistory]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    void loadHistory();
  }, [enabled, loadHistory]);

  useEffect(() => {
    return () => {
      for (const xhr of xhrMapRef.current.values()) {
        xhr.abort();
      }
      xhrMapRef.current.clear();
    };
  }, []);

  const persistHistory = useCallback(
    async (entry: TransferHistoryItem) => {
      if (!enabled) {
        return;
      }
      try {
        await apiFetchJson<{ item: TransferHistoryDTO }>('/api/transfers/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceTaskId: entry.sourceTaskId,
            direction: entry.direction,
            fileId: entry.fileId ?? null,
            fileName: entry.fileName,
            size: entry.size,
            status: entry.status,
            startedAt: new Date(entry.startedAt).toISOString(),
            finishedAt: new Date(entry.finishedAt).toISOString(),
            error: entry.error ?? null,
            uploadVideoFaststartApplied: entry.uploadVideoFaststartApplied ?? null,
            uploadVideoFaststartFallback: entry.uploadVideoFaststartFallback ?? null,
            uploadVideoPreviewAttached: entry.uploadVideoPreviewAttached ?? null,
            uploadVideoPreviewFallback: entry.uploadVideoPreviewFallback ?? null,
          }),
        });
        await loadHistory();
      } catch {
        // 保存失败不影响主流程
      }
    },
    [enabled, loadHistory]
  );

  useEffect(() => {
    for (const task of uploadTasks) {
      if (task.status !== 'completed' && task.status !== 'error') {
        continue;
      }
      const signature = `${task.status}:${task.finishedAt ?? task.updatedAt ?? 0}`;
      const last = syncedUploadRef.current.get(task.id);
      if (last === signature) {
        continue;
      }
      syncedUploadRef.current.set(task.id, signature);
      void persistHistory(toUploadHistory(task));
    }
  }, [persistHistory, uploadTasks]);

  const updateDownloadTask = useCallback(
    (taskId: string, patch: Partial<DownloadTask>) => {
      const now = Date.now();
      setDownloadTasks((prev) =>
        prev.map((task) => {
          if (task.id !== taskId) return task;
          return {
            ...task,
            ...patch,
            updatedAt: now,
          };
        })
      );
    },
    [setDownloadTasks]
  );

  const startDownload = useCallback(
    (file: DownloadSource, url: string): DownloadStartResult => {
      if (file.type === 'folder') {
        return { ok: false, reason: '文件夹暂不支持下载' };
      }
      const now = Date.now();
      const taskId = generateId();
      const initialTask: DownloadTask = {
        id: taskId,
        fileId: file.id,
        fileName: file.name,
        size: file.size,
        progress: 0,
        status: 'pending',
        startedAt: now,
        updatedAt: now,
      };

      setDownloadTasks((prev) => [initialTask, ...prev]);

      const xhr = new XMLHttpRequest();
      xhrMapRef.current.set(taskId, xhr);
      xhr.open('GET', url, true);
      xhr.responseType = 'blob';
      xhr.withCredentials = true;

      xhr.onprogress = (evt) => {
        if (evt.loaded <= 0) return;
        let pct = 0;
        if (evt.lengthComputable && evt.total > 0) {
          pct = Math.round((evt.loaded / evt.total) * 100);
        } else if (file.size > 0) {
          pct = Math.round((evt.loaded / file.size) * 100);
        } else {
          pct = 0;
        }

        updateDownloadTask(taskId, {
          status: 'downloading',
          progress: Math.min(99, Math.max(0, pct)),
        });
      };

      xhr.onerror = () => {
        xhrMapRef.current.delete(taskId);
        const finishedAt = Date.now();
        updateDownloadTask(taskId, {
          status: 'error',
          progress: 0,
          finishedAt,
          error: '网络错误',
        });
        void persistHistory(
          toDownloadHistory(taskId, file, 'error', now, finishedAt, '网络错误')
        );
      };

      xhr.onabort = () => {
        xhrMapRef.current.delete(taskId);
        const finishedAt = Date.now();
        updateDownloadTask(taskId, {
          status: 'canceled',
          progress: 0,
          finishedAt,
          error: '已取消',
        });
        void persistHistory(
          toDownloadHistory(taskId, file, 'canceled', now, finishedAt, '已取消')
        );
      };

      xhr.onload = () => {
        xhrMapRef.current.delete(taskId);
        const finishedAt = Date.now();
        if (xhr.status < 200 || xhr.status >= 300) {
          const reason = `下载失败（${xhr.status}）`;
          updateDownloadTask(taskId, {
            status: 'error',
            progress: 0,
            finishedAt,
            error: reason,
          });
          void persistHistory(
            toDownloadHistory(taskId, file, 'error', now, finishedAt, reason)
          );
          return;
        }

        const blob = xhr.response as Blob;
        const blobURL = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = blobURL;
        anchor.download = file.name;
        anchor.rel = 'noopener';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        window.setTimeout(() => URL.revokeObjectURL(blobURL), 30_000);

        updateDownloadTask(taskId, {
          status: 'completed',
          progress: 100,
          finishedAt,
          error: undefined,
        });
        void persistHistory(
          toDownloadHistory(taskId, file, 'completed', now, finishedAt)
        );
      };

      updateDownloadTask(taskId, { status: 'downloading' });
      xhr.send();

      return { ok: true };
    },
    [persistHistory, setDownloadTasks, updateDownloadTask]
  );

  const retryDownload = useCallback(
    (taskId: string): DownloadStartResult => {
      const task = downloadTasks.find((it) => it.id === taskId);
      if (!task) {
        return { ok: false, reason: '下载任务不存在' };
      }
      if (task.status === 'pending' || task.status === 'downloading') {
        return { ok: false, reason: '下载任务正在进行中' };
      }

      return startDownload(
        {
          id: task.fileId,
          name: task.fileName,
          size: task.size,
          type: 'document',
        },
        `/api/items/${task.fileId}/content?download=1`
      );
    },
    [downloadTasks, startDownload]
  );

  const cancelDownload = useCallback((taskId: string) => {
    const xhr = xhrMapRef.current.get(taskId);
    if (xhr) xhr.abort();
  }, []);

  const clearFinishedDownloads = useCallback(() => {
    setDownloadTasks((prev) =>
      prev.filter((task) => task.status === 'pending' || task.status === 'downloading')
    );
  }, [setDownloadTasks]);

  const clearHistory = useCallback(async () => {
    try {
      await apiFetchJson<{ deleted: number }>('/api/transfers/history', { method: 'DELETE' });
      if (historyPage !== 1) {
        setHistoryPage(1);
      } else {
        await loadHistory();
      }
      return { ok: true as const };
    } catch {
      return { ok: false as const, reason: '清空历史失败' };
    }
  }, [historyPage, loadHistory]);

  const clearHistoryByDays = useCallback(
    async (days: number) => {
      if (!Number.isFinite(days) || days < 1 || days > 3650) {
        return { ok: false as const, reason: '天数范围应为 1~3650' };
      }
      try {
        await apiFetchJson<{ deleted: number }>(
          `/api/transfers/history?olderThanDays=${Math.floor(days)}`,
          { method: 'DELETE' }
        );
        if (historyPage !== 1) {
          setHistoryPage(1);
        } else {
          await loadHistory();
        }
        return { ok: true as const };
      } catch {
        return { ok: false as const, reason: '按天清理失败' };
      }
    },
    [historyPage, loadHistory]
  );

  const removeHistoryItem = useCallback(
    async (id: string) => {
      if (!isUUID(id)) {
        setHistory((prev) => prev.filter((item) => item.id !== id));
        return { ok: true as const };
      }
      try {
        await apiFetchJson<{ ok: boolean }>(`/api/transfers/history/${id}`, {
          method: 'DELETE',
        });
        await loadHistory();
        return { ok: true as const };
      } catch {
        return { ok: false as const, reason: '删除历史记录失败' };
      }
    },
    [loadHistory, setHistory]
  );

  const changeHistoryFilter = useCallback((filter: HistoryFilter) => {
    setHistoryFilterState(filter);
    setHistoryPage(1);
  }, []);

  const changeHistoryPage = useCallback((page: number) => {
    if (!Number.isFinite(page) || page < 1) return;
    setHistoryPage(Math.floor(page));
  }, []);

  const changeHistoryPageSize = useCallback((pageSize: number) => {
    if (!Number.isFinite(pageSize) || pageSize < 1 || pageSize > 200) return;
    setHistoryPageSize(Math.floor(pageSize));
    setHistoryPage(1);
  }, []);

  const activeUploadTasks = useMemo(
    () =>
      uploadTasks.filter(
        (task) => task.status === 'pending' || task.status === 'uploading'
      ),
    [uploadTasks]
  );

  const activeDownloadTasks = useMemo(
    () =>
      downloadTasks.filter(
        (task) => task.status === 'pending' || task.status === 'downloading'
      ),
    [downloadTasks]
  );

  return {
    uploadTasks,
    downloadTasks,
    history,
    historyFilter,
    historyLoading,
    historyPagination,
    activeUploadTasks,
    activeDownloadTasks,
    startDownload,
    retryDownload,
    cancelDownload,
    clearFinishedDownloads,
    clearHistory,
    clearHistoryByDays,
    removeHistoryItem,
    changeHistoryFilter,
    changeHistoryPage,
    changeHistoryPageSize,
    reloadHistory: loadHistory,
  };
}
