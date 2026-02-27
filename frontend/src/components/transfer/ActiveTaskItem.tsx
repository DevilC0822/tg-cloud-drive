import { ArrowDownToLine, ArrowUpFromLine, Magnet, X } from 'lucide-react';
import type { DownloadTask, TorrentTask, UploadTask } from '@/types';
import { formatFileSize } from '@/utils/formatters';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ActionTextButton } from '@/components/ui/HeroActionPrimitives';
import {
  downloadTaskStatusLabel,
  isActiveTorrentTask,
  torrentStatusLabel,
  uploadTaskStatusLabel,
} from './transferUtils';

export type ActiveTaskRow =
  | { kind: 'upload'; task: UploadTask }
  | { kind: 'download'; task: DownloadTask }
  | { kind: 'torrent'; task: TorrentTask };

export interface ActiveTaskItemProps {
  row: ActiveTaskRow;
  onCancelDownload: (taskId: string) => void;
}

function taskTitle(row: ActiveTaskRow): string {
  if (row.kind === 'upload') return row.task.file.name;
  if (row.kind === 'download') return row.task.fileName;
  return row.task.torrentName || row.task.infoHash;
}

function taskSize(row: ActiveTaskRow): number {
  if (row.kind === 'upload') return row.task.file.size;
  if (row.kind === 'download') return row.task.size;
  return row.task.estimatedSize || 0;
}

function taskPercent(row: ActiveTaskRow): number {
  if (row.kind === 'upload') return Math.min(100, Math.max(0, Math.round(row.task.progress || 0)));
  if (row.kind === 'download') return Math.min(100, Math.max(0, Math.round(row.task.progress || 0)));
  const raw = row.task.status === 'completed' ? 1 : row.task.progress;
  return Math.min(100, Math.max(0, Math.round(((raw || 0) as number) * 100)));
}

function taskStatus(row: ActiveTaskRow): { label: string; tone: 'gold' | 'success' | 'warning' | 'default' } {
  if (row.kind === 'upload') {
    const label = uploadTaskStatusLabel(row.task.status);
    return { label, tone: 'gold' };
  }
  if (row.kind === 'download') {
    const label = downloadTaskStatusLabel(row.task.status);
    return { label, tone: 'success' };
  }
  const label = torrentStatusLabel(row.task.status);
  if (row.task.status === 'error') return { label, tone: 'default' };
  if (isActiveTorrentTask(row.task)) return { label, tone: 'warning' };
  return { label, tone: 'default' };
}

function leadingIcon(row: ActiveTaskRow) {
  if (row.kind === 'upload')
    return (
      <ArrowUpFromLine className="h-4 w-4 text-[var(--theme-primary-ink)] dark:text-[var(--theme-primary-soft)]" />
    );
  if (row.kind === 'download') return <ArrowDownToLine className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />;
  return <Magnet className="h-4 w-4 text-orange-600 dark:text-orange-300" />;
}

export function ActiveTaskItem({ row, onCancelDownload }: ActiveTaskItemProps) {
  const title = taskTitle(row);
  const size = taskSize(row);
  const percent = taskPercent(row);
  const status = taskStatus(row);
  const showCancel = row.kind === 'download' && (row.task.status === 'pending' || row.task.status === 'downloading');

  return (
    <div className="rounded-2xl border border-neutral-200/80 bg-white/70 px-4 py-3 shadow-sm dark:border-neutral-700/80 dark:bg-neutral-900/55">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="shrink-0">{leadingIcon(row)}</span>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">{title}</div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                <span>{formatFileSize(size)}</span>
                <span>{status.label}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-neutral-200/80 bg-white px-2 py-1 text-[11px] text-neutral-700 dark:border-neutral-700/80 dark:bg-neutral-900/70 dark:text-neutral-200">
            {percent}%
          </span>
          {showCancel ? (
            <ActionTextButton
              tone="warning"
              onPress={() => onCancelDownload(row.task.id)}
              leadingIcon={<X className="h-3.5 w-3.5" />}
              className="h-8! px-2.5! py-0! text-[11px]"
            >
              取消
            </ActionTextButton>
          ) : null}
        </div>
      </div>

      <ProgressBar className="mt-2.5" value={percent} size="sm" color={status.tone} />
    </div>
  );
}
