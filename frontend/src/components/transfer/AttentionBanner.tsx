import { useMemo } from 'react';
import {
  AlertTriangle,
  ChevronDown,
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
import { ActionIconButton, ActionStatusPill, ActionTextButton } from '@/components/ui/HeroActionPrimitives';
import { includesQuery, normalizeQuery } from '@/components/transfer/transferUtils';

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
      ? 'border-red-200/70 bg-gradient-to-r from-red-50/80 via-orange-50/70 to-white/70 dark:border-red-500/20 dark:from-red-950/30 dark:via-orange-950/20 dark:to-neutral-950/20'
      : 'border-amber-200/70 bg-gradient-to-r from-amber-50/85 via-orange-50/65 to-white/70 dark:border-amber-500/20 dark:from-amber-950/30 dark:via-orange-950/18 dark:to-neutral-950/20';

  return (
    <section
      id="transfer-attention"
      className={`scroll-mt-[var(--transfer-sticky-offset)] overflow-hidden rounded-3xl border p-4 shadow-[0_22px_46px_-40px_rgba(15,23,42,0.65)] md:scroll-mt-24 md:p-5 ${toneClasses}`}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-2xl border border-neutral-200/70 bg-white/70 p-2 text-neutral-700 shadow-sm dark:border-neutral-700/70 dark:bg-neutral-900/50 dark:text-neutral-200">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                {totalCount} 个任务需要处理
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <ActionStatusPill tone={errorCount > 0 ? 'warning' : 'brand'}>
                  {summaryParts.length > 0 ? summaryParts.join(' · ') : '待处理'}
                </ActionStatusPill>
                {queryNorm ? (
                  <ActionStatusPill>
                    匹配 {filteredCount} / {totalCount}
                  </ActionStatusPill>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ActionTextButton
            tone="neutral"
            density="cozy"
            onPress={onToggle}
            trailingIcon={open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            className="h-10! px-3! py-0! text-sm"
          >
            {open ? '收起' : '展开'}
          </ActionTextButton>
        </div>
      </div>

      {open ? (
        <div className="mt-4 space-y-2">
          {filteredCount === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-200/80 bg-white/60 px-4 py-5 text-sm text-neutral-600 dark:border-neutral-700/80 dark:bg-neutral-900/40 dark:text-neutral-300">
              当前搜索条件下没有匹配的待处理任务。
            </div>
          ) : null}

          {filtered.failedUploads.map((task) => (
            <div
              key={`attention-upload-${task.id}`}
              className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-orange-200/70 bg-white/70 px-4 py-3 dark:border-orange-500/20 dark:bg-neutral-900/55"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  <Upload className="h-4 w-4 text-current" />
                  <span className="truncate">{task.file.name}</span>
                </div>
                <div className="mt-1 truncate text-xs text-red-600 dark:text-red-300">{task.error || '上传失败'}</div>
              </div>
              <div className="flex items-center gap-2">
                <ActionTextButton
                  tone="brand"
                  onPress={() => void onRetryUpload(task.id)}
                  leadingIcon={<RotateCcw className="h-3.5 w-3.5" />}
                  className="h-8! px-2.5! py-0! text-[11px]"
                >
                  重试
                </ActionTextButton>
                <ActionIconButton
                  icon={<X className="h-4 w-4" />}
                  label="从列表移除"
                  tone="neutral"
                  onPress={() => onRemoveUploadTask(task.id)}
                  className="border border-neutral-200/80 dark:border-neutral-700/80"
                />
              </div>
            </div>
          ))}

          {filtered.failedDownloads.map((task) => (
            <div
              key={`attention-download-${task.id}`}
              className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-orange-200/70 bg-white/70 px-4 py-3 dark:border-orange-500/20 dark:bg-neutral-900/55"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  <Download className="h-4 w-4 text-current" />
                  <span className="truncate">{task.fileName}</span>
                </div>
                <div className="mt-1 truncate text-xs text-red-600 dark:text-red-300">{task.error || '下载失败'}</div>
              </div>
              <ActionTextButton
                tone="brand"
                onPress={() => onRetryDownload(task.id)}
                leadingIcon={<RotateCcw className="h-3.5 w-3.5" />}
                className="h-8! px-2.5! py-0! text-[11px]"
              >
                重试
              </ActionTextButton>
            </div>
          ))}

          {filtered.awaitingSelectionTasks.map((task) => (
            <div
              key={`attention-torrent-awaiting-${task.id}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-200/70 bg-white/70 px-4 py-3 dark:border-sky-500/20 dark:bg-neutral-900/55"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  <Magnet className="h-4 w-4 text-current" />
                  <span className="truncate">{task.torrentName || task.infoHash}</span>
                </div>
                <div className="mt-1 text-xs text-neutral-600 dark:text-neutral-300">待选择文件</div>
              </div>
              <ActionTextButton
                tone="brand"
                onPress={() => onOpenTorrentSelection(task.id)}
                leadingIcon={<Send className="h-3.5 w-3.5" />}
                className="h-8! px-2.5! py-0! text-[11px]"
              >
                选择文件
              </ActionTextButton>
            </div>
          ))}

          {filtered.failedTorrentTasks.map((task) => (
            <div
              key={`attention-torrent-failed-${task.id}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200/70 bg-white/70 px-4 py-3 dark:border-red-500/20 dark:bg-neutral-900/55"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  <Magnet className="h-4 w-4 text-current" />
                  <span className="truncate">{task.torrentName || task.infoHash}</span>
                </div>
                <div className="mt-1 truncate text-xs text-red-600 dark:text-red-300">{task.error || '任务失败'}</div>
              </div>
              <div className="flex items-center gap-2">
                <ActionTextButton
                  tone="brand"
                  onPress={() => void onRetryTorrentTask(task.id)}
                  leadingIcon={<RotateCcw className="h-3.5 w-3.5" />}
                  className="h-8! px-2.5! py-0! text-[11px]"
                >
                  重试
                </ActionTextButton>
                <ActionIconButton
                  icon={<Trash2 className="h-4 w-4" />}
                  label="删除任务并清理临时文件"
                  tone="danger"
                  onPress={() => onRequestDeleteTorrentTask(task)}
                  className="border border-neutral-200/80 dark:border-neutral-700/80"
                />
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
