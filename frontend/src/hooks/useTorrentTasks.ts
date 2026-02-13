import { useCallback, useEffect, useState } from 'react';
import { ApiError, apiFetchJson } from '@/utils/api';
import type { TorrentMetaPreview, TorrentTask } from '@/types';

type TorrentTaskListResponse = {
  items: TorrentTask[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
};

type TorrentTaskDetailResponse = {
  task: TorrentTask;
};

type DeleteTorrentTaskResponse = {
  deleted: boolean;
  taskId: string;
  cleanupWarnings?: string[];
};

type RetryTorrentTaskResponse = {
  task: TorrentTask;
  cleanupWarnings?: string[];
};

type PreviewTorrentResponse = {
  preview: TorrentMetaPreview;
};

type UseTorrentTasksOptions = {
  enabled?: boolean;
  pollIntervalMs?: number;
};

type CreateTorrentTaskInput = {
  parentId?: string | null;
  torrentUrl?: string;
  torrentFile?: File | null;
  selectedFileIndexes?: number[];
  submittedBy?: string;
};

type PreviewTorrentInput = {
  torrentUrl?: string;
  torrentFile?: File | null;
};

function normalizeTask(task: TorrentTask): TorrentTask {
  return {
    ...task,
    progress: Number.isFinite(task.progress) ? Math.min(1, Math.max(0, task.progress)) : 0,
    trackerHosts: Array.isArray(task.trackerHosts) ? task.trackerHosts : [],
    dueAt: task.dueAt ? String(task.dueAt) : null,
    files: Array.isArray(task.files) ? task.files : undefined,
  };
}

function isActiveTorrentTask(task: TorrentTask): boolean {
  switch (task.status) {
    case 'queued':
    case 'downloading':
    case 'awaiting_selection':
    case 'uploading':
      return true;
    default:
      return false;
  }
}

export function useTorrentTasks(options: UseTorrentTasksOptions = {}) {
  const enabled = options.enabled ?? true;
  const pollIntervalMs = options.pollIntervalMs ?? 4000;

  const [tasks, setTasks] = useState<TorrentTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const hasActiveTasks = tasks.some(isActiveTorrentTask);

  const loadTasks = useCallback(async () => {
    if (!enabled) {
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', '1');
      params.set('pageSize', '50');
      const res = await apiFetchJson<TorrentTaskListResponse>(`/api/torrents/tasks?${params.toString()}`);
      setTasks((res.items || []).map(normalizeTask));
    } catch {
      // 保持已有列表，避免瞬时网络波动导致界面闪断
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setTasks([]);
      return;
    }

    // 进入传输中心后先拉取一次快照，后续是否轮询取决于是否存在进行中任务。
    void loadTasks();
  }, [enabled, loadTasks]);

  useEffect(() => {
    if (!enabled || !hasActiveTasks) {
      return;
    }

    const timer = window.setInterval(
      () => {
        void loadTasks();
      },
      Math.max(2000, pollIntervalMs),
    );
    return () => {
      window.clearInterval(timer);
    };
  }, [enabled, hasActiveTasks, loadTasks, pollIntervalMs]);

  const createTask = useCallback(async (input: CreateTorrentTaskInput) => {
    const torrentUrl = input.torrentUrl?.trim() || '';
    const torrentFile = input.torrentFile || null;
    const selectedFileIndexes = Array.from(
      new Set((input.selectedFileIndexes || []).filter((idx) => Number.isInteger(idx) && idx >= 0)),
    ).sort((a, b) => a - b);
    if (!torrentUrl && !torrentFile) {
      return { ok: false as const, reason: '请填写 Torrent URL 或选择种子文件' };
    }
    if (input.selectedFileIndexes && selectedFileIndexes.length === 0) {
      return { ok: false as const, reason: '请至少选择一个种子文件' };
    }

    const form = new FormData();
    if (input.parentId) {
      form.append('parentId', input.parentId);
    }
    if (torrentUrl) {
      form.append('torrentUrl', torrentUrl);
    }
    if (torrentFile) {
      form.append('torrentFile', torrentFile, torrentFile.name);
    }
    if (input.submittedBy?.trim()) {
      form.append('submittedBy', input.submittedBy.trim());
    }
    if (selectedFileIndexes.length > 0) {
      form.append('selectedFileIndexes', JSON.stringify(selectedFileIndexes));
    }

    setSubmitting(true);
    try {
      const res = await apiFetchJson<{ task: TorrentTask }>('/api/torrents/tasks', {
        method: 'POST',
        body: form,
      });
      const task = normalizeTask(res.task);
      setTasks((prev) => [task, ...prev.filter((it) => it.id !== task.id)]);
      return { ok: true as const, task };
    } catch (err: unknown) {
      const e = err as ApiError;
      return { ok: false as const, reason: e?.message || '创建 Torrent 任务失败' };
    } finally {
      setSubmitting(false);
    }
  }, []);

  const previewTorrent = useCallback(async (input: PreviewTorrentInput) => {
    const torrentUrl = input.torrentUrl?.trim() || '';
    const torrentFile = input.torrentFile || null;
    if (!torrentUrl && !torrentFile) {
      return { ok: false as const, reason: '请填写 Torrent URL 或选择种子文件' };
    }

    const form = new FormData();
    if (torrentUrl) {
      form.append('torrentUrl', torrentUrl);
    }
    if (torrentFile) {
      form.append('torrentFile', torrentFile, torrentFile.name);
    }

    try {
      const res = await apiFetchJson<PreviewTorrentResponse>('/api/torrents/preview', {
        method: 'POST',
        body: form,
      });
      return { ok: true as const, preview: res.preview };
    } catch (err: unknown) {
      const e = err as ApiError;
      return { ok: false as const, reason: e?.message || '解析 Torrent 文件失败' };
    }
  }, []);

  const getTaskDetail = useCallback(async (taskID: string) => {
    try {
      const res = await apiFetchJson<TorrentTaskDetailResponse>(`/api/torrents/tasks/${taskID}`);
      return { ok: true as const, task: normalizeTask(res.task) };
    } catch (err: unknown) {
      const e = err as ApiError;
      return { ok: false as const, reason: e?.message || '读取 Torrent 任务失败' };
    }
  }, []);

  const dispatchTask = useCallback(async (taskID: string, fileIndexes: number[]) => {
    if (!Array.isArray(fileIndexes) || fileIndexes.length === 0) {
      return { ok: false as const, reason: '请至少选择一个文件' };
    }
    try {
      const res = await apiFetchJson<TorrentTaskDetailResponse>(`/api/torrents/tasks/${taskID}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileIndexes }),
      });
      const task = normalizeTask(res.task);
      setTasks((prev) => prev.map((it) => (it.id === task.id ? task : it)));
      return { ok: true as const, task };
    } catch (err: unknown) {
      const e = err as ApiError;
      return { ok: false as const, reason: e?.message || '提交文件选择失败' };
    }
  }, []);

  const deleteTask = useCallback(async (taskID: string) => {
    const id = taskID.trim();
    if (!id) {
      return { ok: false as const, reason: '任务 ID 不能为空', cleanupWarnings: [] as string[] };
    }
    try {
      const res = await apiFetchJson<DeleteTorrentTaskResponse>(`/api/torrents/tasks/${id}`, {
        method: 'DELETE',
      });
      setTasks((prev) => prev.filter((it) => it.id !== id));
      return {
        ok: true as const,
        cleanupWarnings: Array.isArray(res.cleanupWarnings) ? res.cleanupWarnings : ([] as string[]),
      };
    } catch (err: unknown) {
      const e = err as ApiError;
      return {
        ok: false as const,
        reason: e?.message || '删除 Torrent 任务失败',
        cleanupWarnings: [] as string[],
      };
    }
  }, []);

  const retryTask = useCallback(async (taskID: string) => {
    const id = taskID.trim();
    if (!id) {
      return { ok: false as const, reason: '任务 ID 不能为空', cleanupWarnings: [] as string[] };
    }
    try {
      const res = await apiFetchJson<RetryTorrentTaskResponse>(`/api/torrents/tasks/${id}/retry`, {
        method: 'POST',
      });
      const task = normalizeTask(res.task);
      setTasks((prev) => {
        const next = prev.map((it) => (it.id === task.id ? task : it));
        if (!next.some((it) => it.id === task.id)) {
          next.unshift(task);
        }
        return next;
      });
      return {
        ok: true as const,
        task,
        cleanupWarnings: Array.isArray(res.cleanupWarnings) ? res.cleanupWarnings : ([] as string[]),
      };
    } catch (err: unknown) {
      const e = err as ApiError;
      return {
        ok: false as const,
        reason: e?.message || '重试 Torrent 任务失败',
        cleanupWarnings: [] as string[],
      };
    }
  }, []);

  return {
    tasks,
    loading,
    submitting,
    previewTorrent,
    createTask,
    getTaskDetail,
    dispatchTask,
    deleteTask,
    retryTask,
  };
}
