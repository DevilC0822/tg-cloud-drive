import { ArrowDownToLine, ArrowUpFromLine, Magnet, X, FileText } from 'lucide-react';
import type { DownloadTask, TorrentTask, UploadTask } from '@/types';
import { formatFileSize } from '@/utils/formatters';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { motion, AnimatePresence } from 'framer-motion';
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

function taskStatus(row: ActiveTaskRow): { label: string; tone: 'brand' | 'success' | 'warning' | 'default'; subLabel: string } {
  if (row.kind === 'upload') {
    const label = uploadTaskStatusLabel(row.task.status);
    return { label, tone: 'brand', subLabel: 'UPLOADING' };
  }
  if (row.kind === 'download') {
    const label = downloadTaskStatusLabel(row.task.status);
    return { label, tone: 'success', subLabel: 'DOWNLOADING' };
  }
  const label = torrentStatusLabel(row.task.status);
  const subLabel = 'TORRENT';
  if (row.task.status === 'error') return { label, tone: 'default', subLabel };
  if (isActiveTorrentTask(row.task)) return { label, tone: 'warning', subLabel };
  return { label, tone: 'default', subLabel };
}

function leadingIcon(row: ActiveTaskRow) {
  if (row.kind === 'upload')
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
        <ArrowUpFromLine className="h-5 w-5" />
      </div>
    );
  if (row.kind === 'download')
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        <ArrowDownToLine className="h-5 w-5" />
      </div>
    );
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
      <Magnet className="h-5 w-5" />
    </div>
  );
}

export function ActiveTaskItem({ row, onCancelDownload }: ActiveTaskItemProps) {
  const title = taskTitle(row);
  const size = taskSize(row);
  const percent = taskPercent(row);
  const status = taskStatus(row);
  const showCancel = row.kind === 'download' && (row.task.status === 'pending' || row.task.status === 'downloading');

  const isTransferring = 
    (row.kind === 'upload' && row.task.status === 'uploading') ||
    (row.kind === 'download' && row.task.status === 'downloading') ||
    (row.kind === 'torrent' && (row.task.status === 'downloading' || row.task.status === 'uploading'));

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      whileHover={{ scale: 1.005, backgroundColor: 'rgba(255, 255, 255, 0.6)' }}
      className="group relative overflow-hidden rounded-2xl border border-neutral-200/60 bg-white/40 p-3.5 sm:p-4 dark:border-white/5 dark:bg-white/5 dark:hover:bg-white/10"
    >
      {isTransferring && (
        <motion.div 
          initial={{ opacity: 0.2 }}
          whileHover={{ opacity: 1 }}
          className="absolute top-0 right-0 p-2"
        >
          <motion.div 
            animate={{ scale: [1, 1.2, 1], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            className="flex h-1 w-1 rounded-full bg-brand-500 shadow-[0_0_8px_var(--theme-primary)]" 
          />
        </motion.div>
      )}

      <div className="flex items-start gap-3 sm:gap-4">
        <div className="shrink-0">
          <div className="sm:scale-100 scale-90 origin-top-left">
            {leadingIcon(row)}
          </div>
        </div>
        
        <div className="min-w-0 flex-1 space-y-2.5 sm:space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                {title}
              </h3>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-black uppercase tracking-wider text-neutral-400">
                <span className="flex items-center gap-1">
                  <FileText className="h-2.5 w-2.5" />
                  {formatFileSize(size)}
                </span>
                <span className="h-0.5 w-0.5 rounded-full bg-neutral-300 dark:bg-neutral-700" />
                <span className={status.tone === 'brand' ? 'text-brand-600 dark:text-brand-400' :
                  status.tone === 'success' ? 'text-emerald-600 dark:text-emerald-400' :
                  status.tone === 'warning' ? 'text-amber-600 dark:text-amber-400' :
                  ''
                }>
                  {status.label}
                </span>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <span className="font-mono text-base font-bold tabular-nums tracking-tighter text-neutral-900 sm:text-lg dark:text-neutral-100">
                {percent}<span className="text-[10px] ml-0.5 opacity-40">%</span>
              </span>
              <AnimatePresence>
                {showCancel && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    onClick={() => onCancelDownload(row.task.id)}
                    className="flex h-6 w-6 items-center justify-center rounded-lg border border-neutral-200/60 text-neutral-400 hover:text-amber-500 dark:border-white/5"
                  >
                    <X className="h-3 w-3" />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="relative">
            <ProgressBar 
              className="h-1 rounded-full overflow-hidden bg-neutral-200/50 dark:bg-white/5" 
              value={percent} 
              size="sm" 
              color={status.tone === 'brand' ? 'gold' : status.tone} 
            />
            {isTransferring && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-full">
                <motion.div 
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                  className="absolute inset-y-0 w-16 bg-gradient-to-r from-transparent via-white/30 to-transparent" 
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}


