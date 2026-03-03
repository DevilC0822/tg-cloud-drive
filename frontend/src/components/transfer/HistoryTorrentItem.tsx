import { useMemo } from 'react';
import { Magnet, RotateCcw, Send, Trash2 } from 'lucide-react';
import type { TorrentTask } from '@/types';
import { formatFileSize } from '@/utils/formatters';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ActionIconButton, ActionTextButton } from '@/components/ui/HeroActionPrimitives';
import { motion } from 'framer-motion';
import {
  formatCleanupCountdown,
  formatInfoHashShort,
  isActiveTorrentTask,
  torrentCleanupStatus,
  torrentStatusColor,
  torrentStatusLabel,
} from '@/components/transfer/transferUtils';
import { TORRENT_HISTORY_GRID } from './HistoryTorrentList';

export interface HistoryTorrentItemProps {
  task: TorrentTask;
  nowMs: number;
  onCopyInfoHash: (infoHash: string) => void;
  onOpenSelection: (taskId: string) => void;
  onRetryTask: (taskId: string) => void | Promise<void>;
  onRequestDelete: (task: TorrentTask) => void;
}

export function HistoryTorrentItem({
  task,
  nowMs,
  onCopyInfoHash,
  onOpenSelection,
  onRetryTask,
  onRequestDelete,
}: HistoryTorrentItemProps) {
  const title = task.torrentName || task.infoHash;
  const progressPct = Math.min(
    100,
    Math.max(0, Math.round(((task.status === 'completed' ? 1 : task.progress) || 0) * 100)),
  );

  const cleanup = useMemo(() => torrentCleanupStatus(task), [task]);
  const cleanupDueLabel = useMemo(() => {
    if (cleanup.dueAt) return formatCleanupCountdown(cleanup.dueAt, nowMs);
    if (cleanup.state === 'cleaned') return '已清理';
    if (cleanup.state === 'never') return '永不清理';
    return '未清理';
  }, [cleanup.dueAt, cleanup.state, nowMs]);

  const infoHashShort = useMemo(() => formatInfoHashShort(task.infoHash), [task.infoHash]);

  const showSelectAction = task.status === 'awaiting_selection';
  const showRetryAction = task.status === 'error';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`transfer-history-row group relative grid ${TORRENT_HISTORY_GRID} items-center gap-4 border-b border-neutral-200/60 px-4 py-4 md:px-6 dark:border-white/5 dark:bg-transparent`}
    >
      {/* 种子信息 */}
      <div className="flex min-w-0 items-center gap-4">
        <div className="hidden sm:flex mt-0.5 h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-600 shadow-sm dark:text-orange-400">
          <Magnet className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5 md:hidden">
            <span className="text-[9px] font-black tracking-widest text-orange-600/80 uppercase">
              TORRENT
            </span>
          </div>
          <h3 className="truncate text-sm font-bold tracking-tight text-neutral-900 dark:text-neutral-100" title={title}>
            {title}
          </h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onCopyInfoHash(task.infoHash)}
              className="inline-flex items-center rounded-lg bg-neutral-100 px-2 py-0.5 font-mono text-[10px] font-bold text-neutral-500 transition-colors hover:bg-neutral-200 dark:bg-white/5 dark:text-neutral-400"
            >
              {infoHashShort}
            </button>
            <span className="text-[9px] font-black uppercase tracking-widest text-neutral-400 opacity-60">
              {task.sourceType}
            </span>
          </div>
        </div>
      </div>

      {/* 下载进度 */}
      <div className="hidden md:block">
        <div className="flex items-center justify-between mb-1.5 px-0.5">
          <span className="font-mono text-[10px] font-bold text-neutral-700 dark:text-neutral-300">{progressPct}%</span>
          <span className="font-mono text-[10px] text-neutral-400">{formatFileSize(task.downloadedBytes || 0)}</span>
        </div>
        <ProgressBar value={progressPct} size="sm" color={isActiveTorrentTask(task) ? 'warning' : 'default'} className="h-1" />
      </div>

      {/* 任务状态 */}
      <div className="hidden md:block">
        <span className={`inline-flex items-center text-[10px] font-black uppercase tracking-widest ${torrentStatusColor(task.status)}`}>
          {torrentStatusLabel(task.status)}
        </span>
      </div>

      {/* 清理详情 */}
      <div className="hidden md:block">
        <div className="flex flex-col leading-tight">
          <span className={`text-[10px] font-bold ${cleanup.className}`}>{cleanup.label}</span>
          <span className="text-[10px] font-medium text-neutral-400 opacity-70 mt-0.5">{cleanupDueLabel}</span>
        </div>
      </div>

      {/* 移动端元数据整合 */}
      <div className="flex flex-col items-end gap-1 md:hidden">
        <span className="font-mono text-[11px] font-bold text-neutral-700 dark:text-neutral-300">{progressPct}%</span>
        <span className={`text-[9px] font-black uppercase tracking-widest ${torrentStatusColor(task.status)}`}>
          {torrentStatusLabel(task.status)}
        </span>
      </div>

      {/* 操作 */}
      <div className="flex items-center justify-end gap-2">
        {showRetryAction && (
          <ActionIconButton
            icon={<RotateCcw className="h-3.5 w-3.5" />}
            label="重试任务"
            tone="brand"
            onPress={() => void onRetryTask(task.id)}
            className="h-9 w-9 rounded-xl border-none bg-brand-500/10 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400"
          />
        )}
        {showSelectAction && (
          <ActionTextButton
            tone="brand"
            leadingIcon={<Send className="h-3.5 w-3.5" />}
            onPress={() => onOpenSelection(task.id)}
            className="h-9 rounded-xl px-3 text-[10px] font-black uppercase tracking-widest"
          >
            选择文件
          </ActionTextButton>
        )}
        <ActionIconButton
          icon={<Trash2 className="h-4 w-4" />}
          label="移除任务及临时文件"
          tone="danger"
          onPress={() => onRequestDelete(task)}
          className="h-9 w-9 rounded-xl border-none bg-neutral-100 hover:bg-red-500/10 hover:text-red-600 dark:bg-white/5 dark:hover:bg-red-500/20 shadow-none"
        />
      </div>
    </motion.div>
  );
}
