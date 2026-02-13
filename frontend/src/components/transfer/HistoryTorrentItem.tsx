import { useMemo } from 'react';
import { Clock3, Magnet, RotateCcw, Send, Trash2 } from 'lucide-react';
import type { TorrentTask } from '@/types';
import { formatFileSize } from '@/utils/formatters';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ActionIconButton, ActionTextButton } from '@/components/ui/HeroActionPrimitives';
import {
  formatCleanupCountdown,
  formatInfoHashShort,
  includesQuery,
  isActiveTorrentTask,
  torrentCleanupStatus,
  torrentStatusColor,
  torrentStatusLabel,
} from '@/components/transfer/transferUtils';

export interface HistoryTorrentItemProps {
  task: TorrentTask;
  nowMs: number;
  queryNorm: string;
  onCopyInfoHash: (infoHash: string) => void;
  onOpenSelection: (taskId: string) => void;
  onRetryTask: (taskId: string) => void | Promise<void>;
  onRequestDelete: (task: TorrentTask) => void;
}

export function HistoryTorrentItem({
  task,
  nowMs,
  queryNorm,
  onCopyInfoHash,
  onOpenSelection,
  onRetryTask,
  onRequestDelete,
}: HistoryTorrentItemProps) {
  const title = task.torrentName || task.infoHash;
  const progressPct = Math.min(100, Math.max(0, Math.round(((task.status === 'completed' ? 1 : task.progress) || 0) * 100)));

  const cleanup = useMemo(() => torrentCleanupStatus(task), [task]);
  const cleanupDueLabel = useMemo(() => {
    if (cleanup.dueAt) return formatCleanupCountdown(cleanup.dueAt, nowMs);
    if (task.status === 'completed') return '已清理';
    return '未进入清理';
  }, [cleanup.dueAt, nowMs, task.status]);

  const infoHashShort = useMemo(() => formatInfoHashShort(task.infoHash), [task.infoHash]);

  const showSelectAction = task.status === 'awaiting_selection';
  const showRetryAction = task.status === 'error';

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-t border-neutral-200/80 px-4 py-3 first:border-t-0 dark:border-neutral-700/80 md:grid-cols-[minmax(0,1fr)_160px_150px_150px_auto] md:items-center">
      <div className="min-w-0">
        <div className="flex items-start gap-2">
          <Magnet className="mt-0.5 h-4 w-4 shrink-0 text-orange-600 dark:text-orange-300" />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">{title}</div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">
              <button
                type="button"
                onClick={() => onCopyInfoHash(task.infoHash)}
                title="点击复制 InfoHash"
                className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-700 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
              >
                {infoHashShort}
              </button>
              <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                {task.sourceType === 'url' ? 'URL' : '文件'}
              </span>
              {queryNorm ? (
                <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                  {includesQuery(`${task.torrentName || ''} ${task.infoHash || ''}`, queryNorm) ? '匹配' : '不匹配'}
                </span>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 md:hidden">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${torrentStatusColor(task.status)}`}>
                {torrentStatusLabel(task.status)}
              </span>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${cleanup.className}`}>
                {cleanup.label}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                <Clock3 className="h-3.5 w-3.5" />
                {cleanupDueLabel}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="hidden md:block">
        <div className="text-xs text-neutral-700 dark:text-neutral-200">{formatFileSize(task.estimatedSize || 0)}</div>
        <div className="mt-1.5 max-w-[140px]">
          <ProgressBar value={progressPct} size="sm" color={isActiveTorrentTask(task) ? 'warning' : 'default'} />
        </div>
      </div>

      <div className="hidden md:block">
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${torrentStatusColor(task.status)}`}>
          {torrentStatusLabel(task.status)}
        </span>
        <div className="mt-1.5 flex flex-col gap-1">
          <span className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${cleanup.className}`}>
            {cleanup.label}
          </span>
          <span className="text-[11px] leading-4 text-neutral-500 dark:text-neutral-400">{cleanupDueLabel}</span>
        </div>
      </div>

      <div className="hidden text-xs text-neutral-700 dark:text-neutral-200 md:block">{formatFileSize(task.downloadedBytes || 0)}</div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {showRetryAction ? (
          <ActionTextButton
            tone="brand"
            leadingIcon={<RotateCcw className="h-3.5 w-3.5" />}
            onPress={() => void onRetryTask(task.id)}
            className="h-8! px-2.5! py-0! text-[11px]"
          >
            重试
          </ActionTextButton>
        ) : null}
        {showSelectAction ? (
          <ActionTextButton
            tone="brand"
            leadingIcon={<Send className="h-3.5 w-3.5" />}
            onPress={() => onOpenSelection(task.id)}
            className="h-8! px-2.5! py-0! text-[11px]"
          >
            选择文件
          </ActionTextButton>
        ) : null}
        <ActionIconButton
          icon={<Trash2 className="h-4 w-4" />}
          label="删除任务并清理临时文件"
          tone="danger"
          onPress={() => onRequestDelete(task)}
          className="border border-neutral-200/80 dark:border-neutral-700/80"
        />
      </div>
    </div>
  );
}

