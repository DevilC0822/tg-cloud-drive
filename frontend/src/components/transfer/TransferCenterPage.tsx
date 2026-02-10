import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronDown,
  ChevronUp,
  Clock3,
  RotateCcw,
  ShieldAlert,
  SlidersHorizontal,
  Trash2,
  Send,
} from 'lucide-react';
import type { DownloadTask, TorrentTask, TransferHistoryItem, UploadTask } from '@/types';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';
import { formatDateTime, formatFileSize } from '@/utils/formatters';
import type { HistoryFilter, HistoryPagination } from '@/hooks/useTransferCenter';

export interface TransferCenterPageProps {
  uploadTasks: UploadTask[];
  downloadTasks: DownloadTask[];
  torrentTasks: TorrentTask[];
  torrentLoading: boolean;
  history: TransferHistoryItem[];
  historyFilter: HistoryFilter;
  historyLoading: boolean;
  historyPagination: HistoryPagination;
  onRetryUpload: (taskId: string) => Promise<unknown>;
  onRetryDownload: (taskId: string) => void;
  onCancelDownload: (taskId: string) => void;
  onClearFinishedDownloads: () => void;
  onClearHistory: () => void;
  onClearHistoryByDays: (days: number) => void;
  onRemoveHistoryItem: (id: string) => void;
  onHistoryFilterChange: (filter: HistoryFilter) => void;
  onHistoryPageChange: (page: number) => void;
  onHistoryPageSizeChange: (pageSize: number) => void;
  onOpenTorrentSelection: (taskId: string) => void;
  onDeleteTorrentTask: (taskId: string) => void | Promise<void>;
  onRetryTorrentTask: (taskId: string) => void | Promise<void>;
}

function taskStatusLabel(status: UploadTask['status'] | DownloadTask['status']): string {
  switch (status) {
    case 'pending':
      return '排队中';
    case 'uploading':
    case 'downloading':
      return '进行中';
    case 'completed':
      return '已完成';
    case 'canceled':
      return '已取消';
    default:
      return '失败';
  }
}

function historyStatusLabel(status: TransferHistoryItem['status']): string {
  switch (status) {
    case 'completed':
      return '完成';
    case 'canceled':
      return '取消';
    default:
      return '失败';
  }
}

function historyStatusColor(status: TransferHistoryItem['status']): string {
  switch (status) {
    case 'completed':
      return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300';
    case 'canceled':
      return 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300';
    default:
      return 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300';
  }
}

function historyFilterLabel(filter: HistoryFilter): string {
  switch (filter) {
    case 'upload':
      return '仅上传';
    case 'download':
      return '仅下载';
    default:
      return '全部';
  }
}

function torrentStatusLabel(status: TorrentTask['status']): string {
  switch (status) {
    case 'queued':
      return '排队中';
    case 'downloading':
      return '下载中';
    case 'awaiting_selection':
      return '待选文件';
    case 'uploading':
      return '发送中';
    case 'completed':
      return '已完成';
    default:
      return '失败';
  }
}

function parseDueAt(raw: string | null | undefined): Date | null {
  if (!raw) {
    return null;
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  return d;
}

function formatCleanupCountdown(dueAt: Date, nowMs: number): string {
  const diffMs = dueAt.getTime() - nowMs;
  if (diffMs <= 0) {
    return '即将清理';
  }

  const totalMinutes = Math.max(1, Math.ceil(diffMs / (60 * 1000)));
  if (totalMinutes < 60) {
    return `距清理还剩 ${totalMinutes} 分钟`;
  }

  const totalHours = Math.floor(totalMinutes / 60);
  const remainMinutes = totalMinutes % 60;
  if (totalHours < 24) {
    if (remainMinutes === 0) {
      return `距清理还剩 ${totalHours} 小时`;
    }
    return `距清理还剩 ${totalHours} 小时 ${remainMinutes} 分钟`;
  }

  const days = Math.floor(totalHours / 24);
  const remainHours = totalHours % 24;
  if (remainHours === 0) {
    return `距清理还剩 ${days} 天`;
  }
  return `距清理还剩 ${days} 天 ${remainHours} 小时`;
}

function uploadProcessTags(item: TransferHistoryItem): Array<{ key: string; label: string; className: string }> {
  if (item.direction !== 'upload') {
    return [];
  }
  const tags: Array<{ key: string; label: string; className: string }> = [];
  if (item.uploadVideoFaststartApplied === true) {
    tags.push({
      key: 'faststart-hit',
      label: 'FastStart 命中',
      className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    });
  }
  if (item.uploadVideoFaststartFallback === true) {
    tags.push({
      key: 'faststart-fallback',
      label: 'FastStart 回退',
      className: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
    });
  }
  if (item.uploadVideoPreviewAttached === true) {
    tags.push({
      key: 'preview-hit',
      label: '封面/缩略图已附加',
      className: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300',
    });
  }
  if (item.uploadVideoPreviewFallback === true) {
    tags.push({
      key: 'preview-fallback',
      label: '封面参数回退',
      className: 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300',
    });
  }
  return tags;
}

export function TransferCenterPage({
  uploadTasks,
  downloadTasks,
  torrentTasks,
  torrentLoading,
  history,
  historyFilter,
  historyLoading,
  historyPagination,
  onRetryUpload,
  onRetryDownload,
  onCancelDownload,
  onClearFinishedDownloads,
  onClearHistory,
  onClearHistoryByDays,
  onRemoveHistoryItem,
  onHistoryFilterChange,
  onHistoryPageChange,
  onHistoryPageSizeChange,
  onOpenTorrentSelection,
  onDeleteTorrentTask,
  onRetryTorrentTask,
}: TransferCenterPageProps) {
  const [cleanupDaysInput, setCleanupDaysInput] = useState('7');
  const [historyAdvancedOpen, setHistoryAdvancedOpen] = useState(false);
  const [cleanupNowMs, setCleanupNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCleanupNowMs(Date.now());
    }, 60 * 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const activeUploads = useMemo(
    () => uploadTasks.filter((task) => task.status === 'pending' || task.status === 'uploading'),
    [uploadTasks]
  );
  const activeDownloads = useMemo(
    () =>
      downloadTasks.filter(
        (task) => task.status === 'pending' || task.status === 'downloading'
      ),
    [downloadTasks]
  );
  const failedUploads = useMemo(
    () => uploadTasks.filter((task) => task.status === 'error'),
    [uploadTasks]
  );
  const failedDownloads = useMemo(
    () => downloadTasks.filter((task) => task.status === 'error' || task.status === 'canceled'),
    [downloadTasks]
  );
  const sortedTorrentTasks = useMemo(() => {
    const list = [...torrentTasks];
    list.sort((a, b) => {
      const aDue = parseDueAt(a.dueAt);
      const bDue = parseDueAt(b.dueAt);
      if (aDue && bDue) {
        return aDue.getTime() - bDue.getTime();
      }
      if (aDue) {
        return -1;
      }
      if (bDue) {
        return 1;
      }

      const aCreated = new Date(a.createdAt).getTime();
      const bCreated = new Date(b.createdAt).getTime();
      if (Number.isNaN(aCreated) && Number.isNaN(bCreated)) {
        return 0;
      }
      if (Number.isNaN(aCreated)) {
        return 1;
      }
      if (Number.isNaN(bCreated)) {
        return -1;
      }
      return bCreated - aCreated;
    });
    return list;
  }, [torrentTasks]);

  const activeTaskCount = activeUploads.length + activeDownloads.length;
  const hasIssueTasks = failedUploads.length > 0 || failedDownloads.length > 0;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-neutral-200/80 dark:border-neutral-700/80 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-xl p-5 md:p-7">
        <div className="pointer-events-none absolute -top-16 -right-12 h-52 w-52 rounded-full bg-[#D4AF37]/10 blur-3xl" />
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          传输中心
        </h1>
        <p className="mt-2 text-sm leading-6 text-neutral-500 dark:text-neutral-400">
          仅保留关键传输状态与可追踪历史，聚焦当前任务与结果。
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <div className="rounded-full border border-neutral-200/80 dark:border-neutral-700/80 bg-white/90 dark:bg-neutral-900/80 px-3 py-1.5">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">上传中</span>
            <span className="ml-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              {activeUploads.length}
            </span>
          </div>
          <div className="rounded-full border border-neutral-200/80 dark:border-neutral-700/80 bg-white/90 dark:bg-neutral-900/80 px-3 py-1.5">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">下载中</span>
            <span className="ml-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              {activeDownloads.length}
            </span>
          </div>
          <div className="rounded-full border border-neutral-200/80 dark:border-neutral-700/80 bg-white/90 dark:bg-neutral-900/80 px-3 py-1.5">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">历史总数</span>
            <span className="ml-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              {historyPagination.totalCount}
            </span>
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 md:px-5 py-3 border-b border-neutral-200/80 dark:border-neutral-700/80">
          <div>
            <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">实时任务</div>
            <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              当前进行中 {activeTaskCount} 项
            </div>
          </div>
        </div>

        <div className="divide-y divide-neutral-200/80 dark:divide-neutral-700/80">
          {activeUploads.map((task) => (
            <div key={`upload-${task.id}`} className="px-4 md:px-5 py-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    {task.file.name}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                    <ArrowUpFromLine className="w-3.5 h-3.5" />
                    <span>上传</span>
                    <span>{formatFileSize(task.file.size)}</span>
                    <span>{taskStatusLabel(task.status)}</span>
                  </div>
                </div>
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  {Math.round(task.progress)}%
                </span>
              </div>
              <ProgressBar className="mt-2.5" value={task.progress} size="sm" color="gold" />
            </div>
          ))}

          {activeDownloads.map((task) => (
            <div key={`download-${task.id}`} className="px-4 md:px-5 py-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    {task.fileName}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                    <ArrowDownToLine className="w-3.5 h-3.5" />
                    <span>下载</span>
                    <span>{formatFileSize(task.size)}</span>
                    <span>{taskStatusLabel(task.status)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">
                    {Math.round(task.progress)}%
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onCancelDownload(task.id)}
                    className="!px-2.5"
                  >
                    取消
                  </Button>
                </div>
              </div>
              <ProgressBar className="mt-2.5" value={task.progress} size="sm" color="gold" />
            </div>
          ))}

          {activeTaskCount === 0 ? (
            <div className="px-4 md:px-5 py-8 text-sm text-neutral-500 dark:text-neutral-400">
              当前没有进行中的传输任务。
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 md:px-5 py-3 border-b border-neutral-200/80 dark:border-neutral-700/80">
          <div>
            <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Torrent 任务</div>
            <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              URL/种子下载后转发到 Telegram，按预计清理时间最近优先展示
            </div>
          </div>
          {torrentLoading ? (
            <span className="text-xs text-neutral-500 dark:text-neutral-400">刷新中...</span>
          ) : null}
        </div>

        <div className="divide-y divide-neutral-200/80 dark:divide-neutral-700/80">
          {sortedTorrentTasks.map((task) => {
            const progress = Math.min(
              100,
              Math.max(0, Math.round(((task.status === 'completed' ? 1 : task.progress) || 0) * 100))
            );
            const showSelectAction = task.status === 'awaiting_selection';
            const showRetryAction = task.status === 'error';
            const dueAtDate = parseDueAt(task.dueAt);
            return (
              <div key={task.id} className="px-4 md:px-5 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      {task.torrentName || task.infoHash}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                      <span>{torrentStatusLabel(task.status)}</span>
                      <span>{formatFileSize(task.estimatedSize || 0)}</span>
                      {task.isPrivate ? <span className="text-emerald-600 dark:text-emerald-300">Private</span> : null}
                    </div>
                    {task.error ? (
                      <div className="mt-1 text-xs text-red-600 dark:text-red-300">
                        {task.error}
                      </div>
                    ) : null}
                    {dueAtDate ? (
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                        <Clock3 className="w-3.5 h-3.5" />
                        <span>预计清理时间：{formatDateTime(dueAtDate)}</span>
                        <span className="rounded-full bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-[11px] text-neutral-700 dark:text-neutral-300">
                          {formatCleanupCountdown(dueAtDate, cleanupNowMs)}
                        </span>
                      </div>
                    ) : null}
                    {!dueAtDate && task.status === 'completed' ? (
                      <div className="mt-1 text-xs text-emerald-600 dark:text-emerald-300">
                        源文件已清理
                      </div>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">{progress}%</span>
                    {showRetryAction ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<RotateCcw className="w-3.5 h-3.5" />}
                        onClick={() => void onRetryTorrentTask(task.id)}
                      >
                        重新下载
                      </Button>
                    ) : null}
                    {showSelectAction ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<Send className="w-3.5 h-3.5" />}
                        onClick={() => onOpenTorrentSelection(task.id)}
                      >
                        选择文件
                      </Button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => onDeleteTorrentTask(task.id)}
                      className="rounded-lg p-1.5 text-neutral-400 dark:text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer transition-colors"
                      title="删除任务并清理临时文件"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <ProgressBar className="mt-2.5" value={progress} size="sm" color="gold" />
              </div>
            );
          })}

          {sortedTorrentTasks.length === 0 ? (
            <div className="px-4 md:px-5 py-8 text-sm text-neutral-500 dark:text-neutral-400">
              暂无 Torrent 任务。
            </div>
          ) : null}
        </div>
      </section>

      {hasIssueTasks ? (
        <section className="rounded-2xl border border-amber-200/80 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/5">
          <div className="flex items-center justify-between px-4 md:px-5 py-3 border-b border-amber-200/70 dark:border-amber-500/20">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-300">
              <ShieldAlert className="w-4 h-4" />
              待处理异常
            </div>
            <Button variant="ghost" size="sm" onClick={onClearFinishedDownloads}>
              清空结束下载
            </Button>
          </div>

          <div className="divide-y divide-amber-200/70 dark:divide-amber-500/20">
            {failedUploads.map((task) => (
              <div key={`failed-upload-${task.id}`} className="px-4 md:px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    {task.file.name}
                  </div>
                  <div className="mt-1 text-xs text-red-600 dark:text-red-300">
                    {task.error || '上传失败'}
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void onRetryUpload(task.id)}
                  icon={<RotateCcw className="w-3.5 h-3.5" />}
                >
                  重试
                </Button>
              </div>
            ))}

            {failedDownloads.map((task) => (
              <div key={`failed-download-${task.id}`} className="px-4 md:px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    {task.fileName}
                  </div>
                  <div className="mt-1 text-xs text-red-600 dark:text-red-300">
                    {task.error || '下载失败'}
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onRetryDownload(task.id)}
                  icon={<RotateCcw className="w-3.5 h-3.5" />}
                >
                  重试
                </Button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-xl">
        <div className="px-4 md:px-5 py-3.5 border-b border-neutral-200/80 dark:border-neutral-700/80">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">历史记录</div>
              <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                展示已完成、失败和取消的传输结果
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-neutral-200/80 dark:border-neutral-700/80 px-2.5 py-1 text-xs text-neutral-500 dark:text-neutral-400">
                当前筛选：{historyFilterLabel(historyFilter)}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setHistoryAdvancedOpen((prev) => !prev)}
                icon={<SlidersHorizontal className="w-3.5 h-3.5" />}
                iconPosition="left"
                className="!px-3"
                aria-expanded={historyAdvancedOpen}
                aria-label="展开或收起高级筛选"
              >
                高级筛选
                {historyAdvancedOpen ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </Button>
            </div>
          </div>

          {historyAdvancedOpen ? (
            <div className="mt-3 rounded-2xl border border-neutral-200/80 dark:border-neutral-700/80 bg-neutral-50/70 dark:bg-neutral-950/60 p-3 space-y-3">
              <div className="space-y-1.5">
                <div className="text-xs text-neutral-500 dark:text-neutral-400">方向筛选</div>
                <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-neutral-200/80 dark:border-neutral-700/80 p-1 bg-white/80 dark:bg-neutral-900/80">
                  <button
                    type="button"
                    onClick={() => onHistoryFilterChange('all')}
                    className={`rounded-lg px-2.5 py-1 text-xs transition-colors cursor-pointer ${
                      historyFilter === 'all'
                        ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                        : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                    }`}
                  >
                    全部
                  </button>
                  <button
                    type="button"
                    onClick={() => onHistoryFilterChange('upload')}
                    className={`rounded-lg px-2.5 py-1 text-xs transition-colors cursor-pointer ${
                      historyFilter === 'upload'
                        ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                        : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                    }`}
                  >
                    上传
                  </button>
                  <button
                    type="button"
                    onClick={() => onHistoryFilterChange('download')}
                    className={`rounded-lg px-2.5 py-1 text-xs transition-colors cursor-pointer ${
                      historyFilter === 'download'
                        ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                        : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                    }`}
                  >
                    下载
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="text-xs text-neutral-500 dark:text-neutral-400">历史清理</div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={3650}
                    value={cleanupDaysInput}
                    onChange={(e) => setCleanupDaysInput(e.target.value)}
                    autoComplete="off"
                    placeholder="清理天数"
                    className="w-[112px] rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-3 py-1.5 text-xs text-neutral-700 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      const days = Number.parseInt(cleanupDaysInput.trim(), 10);
                      onClearHistoryByDays(Number.isFinite(days) ? days : 7);
                    }}
                  >
                    清理 N 天前
                  </Button>
                  <Button variant="secondary" size="sm" onClick={onClearHistory}>
                    清空历史
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="divide-y divide-neutral-200/80 dark:divide-neutral-700/80">
          {history.map((item) => {
            const tags = uploadProcessTags(item);
            return (
              <div key={item.id} className="px-4 md:px-5 py-3.5 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    {item.fileName}
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                    <span className="inline-flex items-center gap-1">
                      {item.direction === 'upload' ? (
                        <ArrowUpFromLine className="w-3.5 h-3.5" />
                      ) : (
                        <ArrowDownToLine className="w-3.5 h-3.5" />
                      )}
                      {item.direction === 'upload' ? '上传' : '下载'}
                    </span>
                    <span>{formatFileSize(item.size)}</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="w-3.5 h-3.5" />
                      {formatDateTime(new Date(item.finishedAt))}
                    </span>
                  </div>

                  {item.error ? (
                    <div className="mt-1.5 text-xs text-red-600 dark:text-red-300 truncate">
                      {item.error}
                    </div>
                  ) : null}

                  {tags.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {tags.map((tag) => (
                        <span
                          key={`${item.id}-${tag.key}`}
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${tag.className}`}
                        >
                          {tag.label}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="flex items-start gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${historyStatusColor(item.status)}`}
                  >
                    {historyStatusLabel(item.status)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemoveHistoryItem(item.id)}
                    className="rounded-lg p-1.5 text-neutral-400 dark:text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer transition-colors"
                    title="删除记录"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}

          {!historyLoading && history.length === 0 ? (
            <div className="px-4 md:px-5 py-8 text-sm text-neutral-500 dark:text-neutral-400">
              暂无历史记录。
            </div>
          ) : null}

          {historyLoading ? (
            <div className="px-4 md:px-5 py-8 text-sm text-neutral-500 dark:text-neutral-400">
              正在加载历史记录...
            </div>
          ) : null}
        </div>

        <div className="border-t border-neutral-200/80 dark:border-neutral-700/80 px-4 md:px-5 py-3">
          <Pagination
            page={historyPagination.page}
            pageSize={historyPagination.pageSize}
            totalCount={historyPagination.totalCount}
            totalPages={historyPagination.totalPages}
            onPageChange={onHistoryPageChange}
            onPageSizeChange={onHistoryPageSizeChange}
            pageSizeOptions={[20, 50, 100]}
          />
        </div>
      </section>
    </div>
  );
}
