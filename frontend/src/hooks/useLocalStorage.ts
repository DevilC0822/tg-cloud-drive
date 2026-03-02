import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, apiFetchJson } from '@/utils/api';
import type { ResidualSummary, ResidualTask } from '@/types';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MIN_PAGE_SIZE = 1;
const MAX_PAGE_SIZE = 200;

type LocalResidualPagination = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

type LocalResidualListResponse = {
  items: ResidualTask[];
  summary: ResidualSummary;
  pagination: LocalResidualPagination;
};

type CleanupResidualResponse = {
  ok: boolean;
  cleaned: boolean;
  warnings?: string[];
};

type UseLocalStorageOptions = {
  enabled?: boolean;
};

function normalizePageSize(raw: number): number {
  if (!Number.isFinite(raw)) return DEFAULT_PAGE_SIZE;
  const rounded = Math.floor(raw);
  return Math.max(MIN_PAGE_SIZE, Math.min(MAX_PAGE_SIZE, rounded));
}

function normalizeResidualTask(task: ResidualTask): ResidualTask {
  return {
    ...task,
    finishedAt: task.finishedAt ? String(task.finishedAt) : null,
    residualFiles: Array.isArray(task.residualFiles) ? task.residualFiles : [],
    totalResidualBytes: Number.isFinite(task.totalResidualBytes) ? Math.max(0, task.totalResidualBytes) : 0,
    totalResidualCount: Number.isFinite(task.totalResidualCount) ? Math.max(0, task.totalResidualCount) : 0,
  };
}

function normalizeResidualSummary(summary?: ResidualSummary): ResidualSummary {
  return {
    totalTasks: Number.isFinite(summary?.totalTasks) ? Math.max(0, summary?.totalTasks ?? 0) : 0,
    totalResidualBytes: Number.isFinite(summary?.totalResidualBytes) ? Math.max(0, summary?.totalResidualBytes ?? 0) : 0,
    qbtAvailable: !!summary?.qbtAvailable,
  };
}

function normalizePagination(
  pagination: LocalResidualPagination | undefined,
  fallbackPage: number,
  fallbackPageSize: number,
): LocalResidualPagination {
  return {
    page: Number.isFinite(pagination?.page) ? Math.max(DEFAULT_PAGE, pagination?.page ?? fallbackPage) : fallbackPage,
    pageSize: normalizePageSize(pagination?.pageSize ?? fallbackPageSize),
    totalCount: Number.isFinite(pagination?.totalCount) ? Math.max(0, pagination?.totalCount ?? 0) : 0,
    totalPages: Number.isFinite(pagination?.totalPages) ? Math.max(1, pagination?.totalPages ?? 1) : 1,
  };
}

export function useLocalStorage(options: UseLocalStorageOptions = {}) {
  const enabled = options.enabled ?? true;
  const [items, setItems] = useState<ResidualTask[]>([]);
  const [summary, setSummary] = useState<ResidualSummary>(() => normalizeResidualSummary(undefined));
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState<LocalResidualPagination>({
    page: DEFAULT_PAGE,
    pageSize: DEFAULT_PAGE_SIZE,
    totalCount: 0,
    totalPages: 1,
  });
  const requestSeqRef = useRef(0);
  const pageRef = useRef(DEFAULT_PAGE);
  const pageSizeRef = useRef(DEFAULT_PAGE_SIZE);

  const loadItems = useCallback(
    async (nextPage?: number, nextPageSize?: number) => {
      if (!enabled) {
        return { ok: false as const, reason: '本地存储页未启用' };
      }

      const targetPage = Math.max(DEFAULT_PAGE, Math.floor(nextPage ?? pageRef.current));
      const targetPageSize = normalizePageSize(nextPageSize ?? pageSizeRef.current);
      const requestSeq = requestSeqRef.current + 1;
      requestSeqRef.current = requestSeq;

      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('page', String(targetPage));
        params.set('pageSize', String(targetPageSize));

        const res = await apiFetchJson<LocalResidualListResponse>(`/api/storage/local-residual?${params.toString()}`);
        if (requestSeq !== requestSeqRef.current) {
          return { ok: false as const, reason: '请求已过期' };
        }

        const normalizedPagination = normalizePagination(res.pagination, targetPage, targetPageSize);
        setItems(Array.isArray(res.items) ? res.items.map(normalizeResidualTask) : []);
        setSummary(normalizeResidualSummary(res.summary));
        setPagination(normalizedPagination);
        pageRef.current = normalizedPagination.page;
        pageSizeRef.current = normalizedPagination.pageSize;
        return { ok: true as const };
      } catch (err: unknown) {
        const e = err as ApiError;
        return { ok: false as const, reason: e?.message || '读取本地残留任务失败' };
      } finally {
        if (requestSeq === requestSeqRef.current) {
          setLoading(false);
        }
      }
    },
    [enabled],
  );

  useEffect(() => {
    if (!enabled) {
      requestSeqRef.current += 1;
      setLoading(false);
      setItems([]);
      setSummary(normalizeResidualSummary(undefined));
      setPagination({
        page: DEFAULT_PAGE,
        pageSize: pageSizeRef.current,
        totalCount: 0,
        totalPages: 1,
      });
      return;
    }

    void loadItems(pageRef.current, pageSizeRef.current);
  }, [enabled, loadItems]);

  const setPage = useCallback(
    (nextPage: number) => {
      const targetPage = Math.max(DEFAULT_PAGE, Math.floor(nextPage));
      pageRef.current = targetPage;
      void loadItems(targetPage, pageSizeRef.current);
    },
    [loadItems],
  );

  const setPageSize = useCallback(
    (nextPageSize: number) => {
      const targetPageSize = normalizePageSize(nextPageSize);
      pageRef.current = DEFAULT_PAGE;
      pageSizeRef.current = targetPageSize;
      void loadItems(DEFAULT_PAGE, targetPageSize);
    },
    [loadItems],
  );

  const cleanupTask = useCallback(
    async (taskID: string) => {
      const id = taskID.trim();
      if (!id) {
        return { ok: false as const, reason: '任务 ID 不能为空', cleaned: false, warnings: [] as string[] };
      }

      try {
        const res = await apiFetchJson<CleanupResidualResponse>(`/api/storage/local-residual/${id}/cleanup`, {
          method: 'POST',
        });
        await loadItems(pageRef.current, pageSizeRef.current);
        return {
          ok: true as const,
          cleaned: !!res.cleaned,
          warnings: Array.isArray(res.warnings) ? res.warnings : ([] as string[]),
        };
      } catch (err: unknown) {
        const e = err as ApiError;
        return {
          ok: false as const,
          reason: e?.message || '清理残留任务失败',
          cleaned: false,
          warnings: [] as string[],
        };
      }
    },
    [loadItems],
  );

  return {
    items,
    summary,
    loading,
    pagination,
    loadItems,
    setPage,
    setPageSize,
    cleanupTask,
  };
}
