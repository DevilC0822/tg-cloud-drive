import { useMemo } from 'react';
import type { TorrentTask } from '@/types';
import type { TorrentCleanupFilter, TorrentStatusFilter } from '@/components/transfer/transferHistoryTypes';
import { ActionStatusPill, ActionTextButton } from '@/components/ui/HeroActionPrimitives';
import { HistoryTorrentItem } from '@/components/transfer/HistoryTorrentItem';
import { includesQuery, isActiveTorrentTask, normalizeQuery, parseDateMs, parseDueAt } from '@/components/transfer/transferUtils';

export interface HistoryTorrentListProps {
  tasks: TorrentTask[];
  loading: boolean;
  query: string;
  statusFilter: TorrentStatusFilter;
  onStatusFilterChange: (next: TorrentStatusFilter) => void;
  cleanupFilter: TorrentCleanupFilter;
  onCleanupFilterChange: (next: TorrentCleanupFilter) => void;
  nowMs: number;
  onCopyInfoHash: (infoHash: string) => void;
  onOpenSelection: (taskId: string) => void;
  onRetryTask: (taskId: string) => void | Promise<void>;
  onRequestDelete: (task: TorrentTask) => void;
}

export function HistoryTorrentList({
  tasks,
  loading,
  query,
  statusFilter,
  onStatusFilterChange,
  cleanupFilter,
  onCleanupFilterChange,
  nowMs,
  onCopyInfoHash,
  onOpenSelection,
  onRetryTask,
  onRequestDelete,
}: HistoryTorrentListProps) {
  const queryNorm = useMemo(() => normalizeQuery(query), [query]);

  const filtered = useMemo(() => {
    const byStatus = (task: TorrentTask) => {
      if (statusFilter === 'all') return true;
      if (statusFilter === 'active') return isActiveTorrentTask(task);
      return task.status === statusFilter;
    };
    const byCleanup = (task: TorrentTask) => {
      if (cleanupFilter === 'all') return true;
      const dueAt = parseDueAt(task.dueAt);
      if (cleanupFilter === 'pending') return task.status === 'completed' && !!dueAt;
      return task.status === 'completed' && !dueAt;
    };
    const byQuery = (task: TorrentTask) => {
      if (!queryNorm) return true;
      return includesQuery(`${task.torrentName || ''} ${task.infoHash || ''}`, queryNorm);
    };

    return tasks
      .filter(byStatus)
      .filter(byCleanup)
      .filter(byQuery)
      .slice()
      .sort((a, b) => {
        const aMs = parseDateMs(a.updatedAt) ?? parseDateMs(a.createdAt) ?? 0;
        const bMs = parseDateMs(b.updatedAt) ?? parseDateMs(b.createdAt) ?? 0;
        return bMs - aMs;
      });
  }, [cleanupFilter, queryNorm, statusFilter, tasks]);

  const emptyText = useMemo(() => {
    if (loading && tasks.length === 0) return '正在同步 Torrent 任务...';
    if (tasks.length === 0) return '暂无 Torrent 任务。';
    if (filtered.length === 0) return '当前筛选条件下没有匹配结果。';
    return '';
  }, [filtered.length, loading, tasks.length]);

  return (
    <div className="mt-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-neutral-200/80 bg-white/70 p-1.5 dark:border-neutral-700/80 dark:bg-neutral-900/50">
            <ActionTextButton active={statusFilter === 'all'} onPress={() => onStatusFilterChange('all')} className="justify-center">
              全部
            </ActionTextButton>
            <ActionTextButton active={statusFilter === 'active'} onPress={() => onStatusFilterChange('active')} className="justify-center">
              进行中
            </ActionTextButton>
            <ActionTextButton active={statusFilter === 'awaiting_selection'} onPress={() => onStatusFilterChange('awaiting_selection')} className="justify-center">
              待选择
            </ActionTextButton>
            <ActionTextButton active={statusFilter === 'error'} onPress={() => onStatusFilterChange('error')} className="justify-center">
              失败
            </ActionTextButton>
            <ActionTextButton active={statusFilter === 'completed'} onPress={() => onStatusFilterChange('completed')} className="justify-center">
              已完成
            </ActionTextButton>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-neutral-200/80 bg-white/70 p-1.5 dark:border-neutral-700/80 dark:bg-neutral-900/50">
            <ActionTextButton active={cleanupFilter === 'all'} onPress={() => onCleanupFilterChange('all')} className="justify-center">
              全部
            </ActionTextButton>
            <ActionTextButton active={cleanupFilter === 'pending'} onPress={() => onCleanupFilterChange('pending')} className="justify-center">
              待清理
            </ActionTextButton>
            <ActionTextButton active={cleanupFilter === 'cleaned'} onPress={() => onCleanupFilterChange('cleaned')} className="justify-center">
              已清理
            </ActionTextButton>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
          <ActionStatusPill>筛选后 {filtered.length}</ActionStatusPill>
          {loading ? <span>同步中...</span> : null}
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-3xl border border-neutral-200/80 bg-white/70 dark:border-neutral-700/80 dark:bg-neutral-900/50">
        {emptyText ? (
          <div className="px-4 py-8 text-sm text-neutral-500 dark:text-neutral-400">{emptyText}</div>
        ) : (
          <>
            <div className="hidden border-b border-neutral-200/80 px-4 py-2.5 text-[11px] font-medium text-neutral-500 dark:border-neutral-700/80 dark:text-neutral-400 md:grid md:grid-cols-[minmax(0,1fr)_160px_150px_150px_auto] md:items-center">
              <span>任务</span>
              <span>大小 / 进度</span>
              <span>状态 / 清理</span>
              <span>下载量</span>
              <span className="text-right">操作</span>
            </div>
            {filtered.map((task) => (
              <HistoryTorrentItem
                key={task.id}
                task={task}
                nowMs={nowMs}
                queryNorm={queryNorm}
                onCopyInfoHash={onCopyInfoHash}
                onOpenSelection={onOpenSelection}
                onRetryTask={onRetryTask}
                onRequestDelete={onRequestDelete}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

