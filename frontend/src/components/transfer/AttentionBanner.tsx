import { useMemo } from 'react';
import {
  AlertTriangle,
  ChevronUp,
  Download,
  Magnet,
  RotateCcw,
  Send,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { DownloadTask, TorrentTask, UploadTask } from '@/types';
import { includesQuery, normalizeQuery } from '@/components/transfer/transferUtils';
import { motion, AnimatePresence } from 'framer-motion';
import { springTransition, staggerContainer } from '@/utils/animations';

export interface AttentionBannerProps {
  failedUploads: UploadTask[];
  failedDownloads: DownloadTask[];
  awaitingSelectionTasks: TorrentTask[];
  failedTorrentTasks: TorrentTask[];
  query: string;
  open: boolean;
  onToggle: () => void;
  onRetryUpload: (taskId: string) => void | Promise<unknown>;
  onRemoveUploadTask: (taskId: string) => void;
  onRetryDownload: (taskId: string) => void;
  onOpenTorrentSelection: (taskId: string) => void;
  onRetryTorrentTask: (taskId: string) => void | Promise<void>;
  onRequestDeleteTorrentTask: (task: TorrentTask) => void;
}

function buildSummaryParts(params: {
  failedUploads: number;
  failedDownloads: number;
  awaitingSelection: number;
  failedTorrents: number;
}): string[] {
  const parts: string[] = [];
  if (params.failedUploads > 0) parts.push(`${params.failedUploads} 个上传失败`);
  if (params.failedDownloads > 0) parts.push(`${params.failedDownloads} 个下载失败/取消`);
  if (params.awaitingSelection > 0) parts.push(`${params.awaitingSelection} 个种子待选择`);
  if (params.failedTorrents > 0) parts.push(`${params.failedTorrents} 个种子失败`);
  return parts;
}

/**
 * 待处理横幅：仅在存在失败/待选择任务时出现，默认折叠。
 */
export function AttentionBanner({
  failedUploads,
  failedDownloads,
  awaitingSelectionTasks,
  failedTorrentTasks,
  query,
  open,
  onToggle,
  onRetryUpload,
  onRemoveUploadTask,
  onRetryDownload,
  onOpenTorrentSelection,
  onRetryTorrentTask,
  onRequestDeleteTorrentTask,
}: AttentionBannerProps) {
  const totalCount =
    failedUploads.length + failedDownloads.length + awaitingSelectionTasks.length + failedTorrentTasks.length;
  const errorCount = failedUploads.length + failedDownloads.length + failedTorrentTasks.length;
  const queryNorm = useMemo(() => normalizeQuery(query), [query]);

  const summaryParts = useMemo(() => {
    return buildSummaryParts({
      failedUploads: failedUploads.length,
      failedDownloads: failedDownloads.length,
      awaitingSelection: awaitingSelectionTasks.length,
      failedTorrents: failedTorrentTasks.length,
    });
  }, [awaitingSelectionTasks.length, failedDownloads.length, failedTorrentTasks.length, failedUploads.length]);

  const filtered = useMemo(() => {
    const byTorrentQuery = (task: TorrentTask) =>
      includesQuery(`${task.torrentName || ''} ${task.infoHash || ''}`, queryNorm);
    return {
      failedUploads: failedUploads.filter((task) => includesQuery(task.file.name, queryNorm)),
      failedDownloads: failedDownloads.filter((task) => includesQuery(task.fileName, queryNorm)),
      awaitingSelectionTasks: awaitingSelectionTasks.filter(byTorrentQuery),
      failedTorrentTasks: failedTorrentTasks.filter(byTorrentQuery),
    };
  }, [awaitingSelectionTasks, failedDownloads, failedTorrentTasks, failedUploads, queryNorm]);

  const filteredCount =
    filtered.failedUploads.length +
    filtered.failedDownloads.length +
    filtered.awaitingSelectionTasks.length +
    filtered.failedTorrentTasks.length;

  if (totalCount === 0) return null;

  const toneClasses =
    errorCount > 0
      ? 'border-red-500/20 bg-gradient-to-br from-red-500/10 via-red-500/5 to-transparent dark:from-red-500/20 dark:via-red-500/10'
      : 'border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-500/20 dark:via-amber-500/10';

  return (
    <motion.section
      layout
      id="transfer-attention"
      className={`relative scroll-mt-[var(--transfer-sticky-offset)] overflow-hidden rounded-[2rem] border p-5 md:scroll-mt-24 md:p-6 ${toneClasses}`}
    >
      <motion.div 
        animate={{ opacity: [0.05, 0.15, 0.05], scale: [1, 1.05, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-0 right-0 p-4"
      >
        <AlertTriangle className={`h-24 w-24 ${errorCount > 0 ? 'text-red-500' : 'text-amber-500'}`} />
      </motion.div>

      <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <motion.div 
            initial={{ rotate: -10 }}
            animate={{ rotate: 0 }}
            className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${
            errorCount > 0 
              ? 'border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400' 
              : 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400'
          }`}>
            <AlertTriangle className="h-6 w-6" />
          </motion.div>
          <div className="min-w-0">
            <h2 className="text-base font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
              <span className="font-mono text-xl mr-2">{totalCount}</span> 个任务需要干预
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                errorCount > 0 ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
              }`}>
                {summaryParts.length > 0 ? summaryParts.join(' · ') : 'Attention Required'}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={onToggle}
          className="flex items-center gap-2 self-start rounded-xl border border-neutral-200/60 bg-white/50 px-4 py-2 text-xs font-bold transition-all hover:bg-white dark:border-white/5 dark:bg-white/5 dark:hover:bg-white/10"
        >
          {open ? '收起详情' : '查看详情'}
          <motion.div animate={{ rotate: open ? 0 : 180 }}>
            <ChevronUp className="h-3.5 w-3.5" />
          </motion.div>
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={springTransition}
            className="overflow-hidden"
          >
            <motion.div 
              variants={staggerContainer}
              initial="initial"
              animate="animate"
              className="relative z-10 mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
            >
              {filteredCount === 0 && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="col-span-full rounded-2xl border border-dashed border-neutral-200/80 bg-white/40 px-4 py-8 text-center text-sm text-neutral-500 dark:border-white/10 dark:bg-white/5"
                >
                  没有匹配当前搜索条件的待处理任务
                </motion.div>
              )}

              {filtered.failedUploads.map((task) => (
                <motion.div
                  layout
                  key={`attention-upload-${task.id}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="group flex flex-col justify-between gap-4 rounded-2xl border border-neutral-200/60 bg-white/60 p-4 transition-all hover:border-red-500/30 dark:border-white/5 dark:bg-white/5"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs font-bold text-neutral-900 dark:text-neutral-100">
                      <Upload className="h-3.5 w-3.5 text-neutral-400" />
                      <span className="truncate">{task.file.name}</span>
                    </div>
                    <div className="mt-2 text-[10px] font-medium leading-relaxed text-red-600 dark:text-red-400">
                      {task.error || 'UPLOAD_FAILED'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => void onRetryUpload(task.id)}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-neutral-900 px-3 py-2 text-[10px] font-bold text-white transition-all hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
                    >
                      <RotateCcw className="h-3 w-3" />
                      重试上传
                    </button>
                    <button
                      onClick={() => onRemoveUploadTask(task.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-400 hover:border-red-500/40 hover:text-red-500 dark:border-white/10"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </motion.div>
              ))}

              {filtered.failedDownloads.map((task) => (
                <motion.div
                  layout
                  key={`attention-download-${task.id}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col justify-between gap-4 rounded-2xl border border-neutral-200/60 bg-white/60 p-4 transition-all hover:border-red-500/30 dark:border-white/5 dark:bg-white/5"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs font-bold text-neutral-900 dark:text-neutral-100">
                      <Download className="h-3.5 w-3.5 text-neutral-400" />
                      <span className="truncate">{task.fileName}</span>
                    </div>
                    <div className="mt-2 text-[10px] font-medium leading-relaxed text-red-600 dark:text-red-400">
                      {task.error || 'DOWNLOAD_FAILED'}
                    </div>
                  </div>
                  <button
                    onClick={() => onRetryDownload(task.id)}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 px-3 py-2 text-[10px] font-bold text-white transition-all dark:bg-white dark:text-neutral-900"
                  >
                    <RotateCcw className="h-3 w-3" />
                    重新下载
                  </button>
                </motion.div>
              ))}

              {filtered.awaitingSelectionTasks.map((task) => (
                <motion.div
                  layout
                  key={`attention-torrent-awaiting-${task.id}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col justify-between gap-4 rounded-2xl border border-neutral-200/60 bg-white/60 p-4 transition-all hover:border-sky-500/30 dark:border-white/5 dark:bg-white/5"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs font-bold text-neutral-900 dark:text-neutral-100">
                      <Magnet className="h-3.5 w-3.5 text-neutral-400" />
                      <span className="truncate">{task.torrentName || task.infoHash}</span>
                    </div>
                    <div className="mt-2 text-[10px] font-medium leading-relaxed text-sky-600 dark:text-sky-400 uppercase tracking-wider">
                      Awaiting File Selection
                    </div>
                  </div>
                  <button
                    onClick={() => onOpenTorrentSelection(task.id)}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-[10px] font-bold text-white transition-all hover:bg-sky-500"
                  >
                    <Send className="h-3 w-3" />
                    配置种子
                  </button>
                </motion.div>
              ))}

              {filtered.failedTorrentTasks.map((task) => (
                <motion.div
                  layout
                  key={`attention-torrent-failed-${task.id}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col justify-between gap-4 rounded-2xl border border-neutral-200/60 bg-white/60 p-4 transition-all hover:border-red-500/30 dark:border-white/5 dark:bg-white/5"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs font-bold text-neutral-900 dark:text-neutral-100">
                      <Magnet className="h-3.5 w-3.5 text-neutral-400" />
                      <span className="truncate">{task.torrentName || task.infoHash}</span>
                    </div>
                    <div className="mt-2 text-[10px] font-medium leading-relaxed text-red-600 dark:text-red-400">
                      {task.error || 'TORRENT_FAILED'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => void onRetryTorrentTask(task.id)}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-neutral-900 px-3 py-2 text-[10px] font-bold text-white transition-all dark:bg-white dark:text-neutral-900"
                    >
                      <RotateCcw className="h-3 w-3" />
                      重试
                    </button>
                    <button
                      onClick={() => onRequestDeleteTorrentTask(task)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-400 hover:border-red-500/40 hover:text-red-500 dark:border-white/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

