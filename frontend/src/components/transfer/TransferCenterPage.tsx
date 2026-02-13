import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Pagination } from '@/components/ui/Pagination';
import { NumberFieldInput } from '@/components/ui/NumberFieldInput';
import { formatDateTime, formatFileSize } from '@/utils/formatters';
import type { HistoryFilter, HistoryPagination } from '@/hooks/useTransferCenter';
import { ScrollShadow } from '@heroui/react';
import {
  ActionIconButton,
  ActionStatusPill,
  ActionTextButton,
  DangerActionConfirmModal,
} from '@/components/ui/HeroActionPrimitives';

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

type HistoryRowTypeFilter = 'all' | 'file' | 'torrent';

type HistoryTableRow = {
  id: string;
  rowType: 'file' | 'torrent';
  name: string;
  size: number;
  typeLabel: string;
  subTypeLabel: string;
  faststartLabel: string;
  faststartClassName: string;
  previewLabel: string;
  previewClassName: string;
  cleanupLabel: string;
  cleanupClassName: string;
  cleanupDueLabel: string;
  statusLabel: string;
  statusClassName: string;
  finishedAtMs: number;
  progressText?: string;
  error?: string;
  fileItem?: TransferHistoryItem;
  torrentTask?: TorrentTask;
};

type TransferDangerAction =
  | { type: 'clear-finished-downloads' }
  | { type: 'clear-history' }
  | { type: 'clear-history-by-days'; days: number }
  | { type: 'remove-history-item'; id: string; name: string }
  | { type: 'delete-torrent-task'; id: string; name: string };

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
      return 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300';
    default:
      return 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300';
  }
}

function historyFilterLabel(filter: HistoryFilter): string {
  switch (filter) {
    case 'upload':
      return '上传';
    case 'download':
      return '下载';
    default:
      return '全部';
  }
}

function rowTypeFilterLabel(filter: HistoryRowTypeFilter): string {
  switch (filter) {
    case 'file':
      return '仅文件记录';
    case 'torrent':
      return '仅种子记录';
    default:
      return '全部记录';
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

function torrentStatusColor(status: TorrentTask['status']): string {
  switch (status) {
    case 'completed':
      return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300';
    case 'error':
      return 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300';
    case 'awaiting_selection':
      return 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300';
    case 'downloading':
    case 'uploading':
      return 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300';
    default:
      return 'bg-neutral-100 text-neutral-700 dark:bg-neutral-700/60 dark:text-neutral-200';
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

function parseDateMs(raw: string | null | undefined): number | null {
  if (!raw) {
    return null;
  }
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) {
    return null;
  }
  return ms;
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

function uploadFaststartIndicator(item: TransferHistoryItem): { label: string; className: string } {
  if (item.direction !== 'upload') {
    return {
      label: '-',
      className: 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400',
    };
  }
  if (item.uploadVideoFaststartApplied === true) {
    return {
      label: '已启用',
      className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    };
  }
  if (item.uploadVideoFaststartFallback === true) {
    return {
      label: '回退',
      className: 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300',
    };
  }
  return {
    label: '未启用',
    className: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300',
  };
}

function uploadPreviewIndicator(item: TransferHistoryItem): { label: string; className: string } {
  if (item.direction !== 'upload') {
    return {
      label: '-',
      className: 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400',
    };
  }
  if (item.uploadVideoPreviewAttached === true) {
    return {
      label: '已附加',
      className: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300',
    };
  }
  if (item.uploadVideoPreviewFallback === true) {
    return {
      label: '回退',
      className: 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300',
    };
  }
  return {
    label: '未附加',
    className: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300',
  };
}

function torrentCleanupStatus(task: TorrentTask): { label: string; className: string } {
  const dueAtDate = parseDueAt(task.dueAt);
  if (task.status !== 'completed') {
    return {
      label: '未进入清理',
      className: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300',
    };
  }
  if (dueAtDate) {
    return {
      label: '待清理',
      className: 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300',
    };
  }
  return {
    label: '已清理',
    className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  };
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
  const [historyRowTypeFilter, setHistoryRowTypeFilter] = useState<HistoryRowTypeFilter>('all');
  const [dangerAction, setDangerAction] = useState<TransferDangerAction | null>(null);

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
    [uploadTasks],
  );
  const activeDownloads = useMemo(
    () => downloadTasks.filter((task) => task.status === 'pending' || task.status === 'downloading'),
    [downloadTasks],
  );
  const failedUploads = useMemo(() => uploadTasks.filter((task) => task.status === 'error'), [uploadTasks]);
  const failedDownloads = useMemo(
    () => downloadTasks.filter((task) => task.status === 'error' || task.status === 'canceled'),
    [downloadTasks],
  );

  const pendingTorrentCleanupCount = useMemo(
    () => torrentTasks.filter((task) => task.status === 'completed' && parseDueAt(task.dueAt)).length,
    [torrentTasks],
  );
  const cleanedTorrentCount = useMemo(
    () => torrentTasks.filter((task) => task.status === 'completed' && !parseDueAt(task.dueAt)).length,
    [torrentTasks],
  );

  const historyTableRows = useMemo(() => {
    const rows: HistoryTableRow[] = [];

    if (historyRowTypeFilter !== 'torrent') {
      for (const item of history) {
        const faststart = uploadFaststartIndicator(item);
        const preview = uploadPreviewIndicator(item);
        rows.push({
          id: `history-${item.id}`,
          rowType: 'file',
          name: item.fileName,
          size: item.size,
          typeLabel: '文件',
          subTypeLabel: item.direction === 'upload' ? '上传' : '下载',
          faststartLabel: faststart.label,
          faststartClassName: faststart.className,
          previewLabel: preview.label,
          previewClassName: preview.className,
          cleanupLabel: '-',
          cleanupClassName: 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400',
          cleanupDueLabel: '-',
          statusLabel: historyStatusLabel(item.status),
          statusClassName: historyStatusColor(item.status),
          finishedAtMs: item.finishedAt,
          error: item.error,
          fileItem: item,
        });
      }
    }

    if (historyRowTypeFilter !== 'file') {
      for (const task of torrentTasks) {
        const progress = Math.min(
          100,
          Math.max(0, Math.round(((task.status === 'completed' ? 1 : task.progress) || 0) * 100)),
        );
        const cleanupState = torrentCleanupStatus(task);
        const dueAtDate = parseDueAt(task.dueAt);
        const finishedAtMs =
          parseDateMs(task.finishedAt) ?? parseDateMs(task.updatedAt) ?? parseDateMs(task.createdAt) ?? Date.now();

        let cleanupDueLabel = '-';
        if (task.status === 'completed' && dueAtDate) {
          cleanupDueLabel = `${formatDateTime(dueAtDate)} · ${formatCleanupCountdown(dueAtDate, cleanupNowMs)}`;
        } else if (task.status === 'completed' && !dueAtDate) {
          cleanupDueLabel = `已清理（${formatDateTime(new Date(finishedAtMs))}）`;
        }

        rows.push({
          id: `torrent-${task.id}`,
          rowType: 'torrent',
          name: task.torrentName || task.infoHash,
          size: task.estimatedSize || 0,
          typeLabel: '种子',
          subTypeLabel: task.sourceType === 'url' ? 'URL' : '文件',
          faststartLabel: '-',
          faststartClassName: 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400',
          previewLabel: '-',
          previewClassName: 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400',
          cleanupLabel: cleanupState.label,
          cleanupClassName: cleanupState.className,
          cleanupDueLabel,
          statusLabel: torrentStatusLabel(task.status),
          statusClassName: torrentStatusColor(task.status),
          finishedAtMs,
          progressText: `${progress}%`,
          error: task.error ?? undefined,
          torrentTask: task,
        });
      }
    }

    rows.sort((a, b) => b.finishedAtMs - a.finishedAtMs);
    return rows;
  }, [cleanupNowMs, history, historyRowTypeFilter, torrentTasks]);

  const activeTaskCount = activeUploads.length + activeDownloads.length;
  const hasIssueTasks = failedUploads.length > 0 || failedDownloads.length > 0;
  const transferMetricCards = [
    {
      key: 'uploading',
      label: '上传中',
      value: activeUploads.length,
      description: '正在上传',
      icon: ArrowUpFromLine,
    },
    {
      key: 'downloading',
      label: '下载中',
      value: activeDownloads.length,
      description: '正在下载',
      icon: ArrowDownToLine,
    },
    {
      key: 'cleanup-pending',
      label: '待清理种子',
      value: pendingTorrentCleanupCount,
      description: '等待清理',
      icon: Clock3,
    },
    {
      key: 'cleanup-completed',
      label: '已清理种子',
      value: cleanedTorrentCount,
      description: '清理完成',
      icon: Trash2,
    },
  ];

  const dangerConfirmConfig = useMemo(() => {
    if (!dangerAction) return null;

    if (dangerAction.type === 'clear-finished-downloads') {
      return {
        title: '确认清理已结束下载',
        description: '将清理失败和已取消的下载记录，进行中的下载不会受影响。',
        confirmText: '确认清理',
      };
    }

    if (dangerAction.type === 'clear-history') {
      return {
        title: '确认清空历史记录',
        description: '将清空全部文件历史记录，该操作不可恢复。',
        confirmText: '确认清空',
      };
    }

    if (dangerAction.type === 'clear-history-by-days') {
      return {
        title: '确认按天数清理历史',
        description: `将清理早于 ${dangerAction.days} 天的文件历史记录，该操作不可恢复。`,
        confirmText: '确认清理',
      };
    }

    if (dangerAction.type === 'remove-history-item') {
      return {
        title: `确认删除记录“${dangerAction.name}”`,
        description: '该条历史记录将被永久移除，不影响原始文件内容。',
        confirmText: '确认删除',
      };
    }

    return {
      title: `确认删除种子任务“${dangerAction.name}”`,
      description: '将尝试清理该任务关联的临时下载文件，删除后不可恢复。',
      confirmText: '确认删除',
    };
  }, [dangerAction]);

  const handleConfirmDangerAction = useCallback(() => {
    if (!dangerAction) return;

    if (dangerAction.type === 'clear-finished-downloads') {
      onClearFinishedDownloads();
      setDangerAction(null);
      return;
    }

    if (dangerAction.type === 'clear-history') {
      onClearHistory();
      setDangerAction(null);
      return;
    }

    if (dangerAction.type === 'clear-history-by-days') {
      onClearHistoryByDays(dangerAction.days);
      setDangerAction(null);
      return;
    }

    if (dangerAction.type === 'remove-history-item') {
      onRemoveHistoryItem(dangerAction.id);
      setDangerAction(null);
      return;
    }

    void onDeleteTorrentTask(dangerAction.id);
    setDangerAction(null);
  }, [
    dangerAction,
    onClearFinishedDownloads,
    onClearHistory,
    onClearHistoryByDays,
    onDeleteTorrentTask,
    onRemoveHistoryItem,
  ]);

  const renderRowActions = (row: HistoryTableRow, compact = false) => {
    const showRetryAction = row.rowType === 'torrent' && row.torrentTask?.status === 'error';
    const showSelectAction = row.rowType === 'torrent' && row.torrentTask?.status === 'awaiting_selection';
    const torrentTask = row.torrentTask;
    const fileItem = row.fileItem;

    return (
      <div className={compact ? 'flex flex-wrap items-center gap-2' : 'flex items-center gap-2'}>
        {showRetryAction && torrentTask ? (
          <ActionTextButton
            tone="brand"
            leadingIcon={<RotateCcw className="h-3.5 w-3.5" />}
            className={compact ? 'px-2.5! py-1.5! text-xs!' : undefined}
            onPress={() => void onRetryTorrentTask(torrentTask.id)}
          >
            重试
          </ActionTextButton>
        ) : null}
        {showSelectAction && torrentTask ? (
          <ActionTextButton
            tone="brand"
            leadingIcon={<Send className="h-3.5 w-3.5" />}
            className={compact ? 'px-2.5! py-1.5! text-xs!' : undefined}
            onPress={() => onOpenTorrentSelection(torrentTask.id)}
          >
            选择文件
          </ActionTextButton>
        ) : null}

        {row.rowType === 'file' && fileItem ? (
          <ActionIconButton
            icon={<Trash2 className="h-4 w-4" />}
            label="删除记录"
            tone="danger"
            onPress={() =>
              setDangerAction({
                type: 'remove-history-item',
                id: fileItem.id,
                name: row.name,
              })
            }
            className={compact ? 'border border-neutral-200/80 dark:border-neutral-700/80' : undefined}
          />
        ) : null}

        {row.rowType === 'torrent' && torrentTask ? (
          <ActionIconButton
            icon={<Trash2 className="h-4 w-4" />}
            label="删除任务并清理临时文件"
            tone="danger"
            onPress={() =>
              setDangerAction({
                type: 'delete-torrent-task',
                id: torrentTask.id,
                name: row.name,
              })
            }
            className={compact ? 'border border-neutral-200/80 dark:border-neutral-700/80' : undefined}
          />
        ) : null}
      </div>
    );
  };

  return (
    <div className="mx-auto w-full max-w-[90rem] px-3 py-5 md:px-5 md:py-7">
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-3xl border border-neutral-200/80 bg-gradient-to-br from-white via-neutral-50 to-orange-50/65 p-5 shadow-[0_28px_64px_-46px_rgba(15,23,42,0.65)] md:p-7 dark:border-neutral-700/80 dark:from-neutral-950 dark:via-neutral-900 dark:to-orange-950/25">
          <div className="pointer-events-none absolute -top-24 -right-12 h-64 w-64 rounded-full bg-[var(--theme-primary-a24)] blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 -left-16 h-56 w-56 rounded-full bg-slate-300/30 blur-3xl dark:bg-slate-700/30" />

          <div className="relative grid gap-5 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <span className="inline-flex items-center rounded-full border border-neutral-300/80 bg-white/85 px-3 py-1 text-[11px] font-medium tracking-[0.16em] text-neutral-600 uppercase dark:border-neutral-700/70 dark:bg-neutral-900/80 dark:text-neutral-300">
                Transfer Hub
              </span>
              <h1 className="mt-3 text-3xl font-semibold text-neutral-900 md:text-[2.1rem] dark:text-neutral-100">
                传输中心
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600 dark:text-neutral-400">
                在一个页面查看实时任务、失败重试与历史记录，快速定位问题并清理旧任务。
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {transferMetricCards.map((card) => {
                const Icon = card.icon;
                return (
                  <div
                    key={card.key}
                    className="rounded-2xl border border-white/90 bg-white/88 px-3.5 py-3 shadow-sm backdrop-blur dark:border-neutral-700/80 dark:bg-neutral-900/82"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] tracking-[0.14em] text-neutral-500 uppercase dark:text-neutral-400">
                        {card.label}
                      </span>
                      <Icon className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
                      {card.value}
                    </div>
                    <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">{card.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-neutral-200/80 bg-white/86 shadow-[0_24px_54px_-44px_rgba(15,23,42,0.85)] dark:border-neutral-700/80 dark:bg-neutral-900/74">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200/80 px-4 py-3.5 md:px-5 dark:border-neutral-700/80">
            <div>
              <div className="text-base font-semibold text-neutral-900 dark:text-neutral-100">实时任务</div>
              <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                当前进行中 {activeTaskCount} 项，可直接取消或处理失败任务。
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ActionStatusPill tone="brand">上传 {activeUploads.length}</ActionStatusPill>
              <ActionStatusPill tone="success">下载 {activeDownloads.length}</ActionStatusPill>
            </div>
          </div>

          {activeTaskCount === 0 ? (
            <div className="px-4 py-9 text-sm text-neutral-500 md:px-5 dark:text-neutral-400">
              暂无实时任务。新的上传或下载开始后会显示在这里。
            </div>
          ) : (
            <div className="grid gap-4 p-4 md:grid-cols-2 md:p-5">
              <div className="rounded-2xl border border-sky-200/70 bg-sky-50/60 p-3 dark:border-sky-500/25 dark:bg-sky-950/20">
                <div className="mb-2 flex items-center justify-between">
                  <div className="inline-flex items-center gap-2 text-xs font-medium text-sky-700 dark:text-sky-300">
                    <ArrowUpFromLine className="h-3.5 w-3.5" />
                    上传任务
                  </div>
                  <span className="text-[11px] text-sky-600 dark:text-sky-300/90">{activeUploads.length} 项</span>
                </div>
                <div className="max-h-[380px] space-y-2.5 overflow-y-auto pr-1">
                  {activeUploads.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-sky-200/80 bg-white/65 px-3 py-4 text-xs text-sky-700/80 dark:border-sky-500/30 dark:bg-sky-950/20 dark:text-sky-300/80">
                      暂无上传任务
                    </div>
                  ) : null}
                  {activeUploads.map((task) => (
                    <article
                      key={`upload-${task.id}`}
                      className="rounded-xl border border-sky-200/70 bg-white/92 p-3 dark:border-sky-500/20 dark:bg-neutral-900/78"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                            {task.file.name}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                            <span>{formatFileSize(task.file.size)}</span>
                            <span>{taskStatusLabel(task.status)}</span>
                          </div>
                        </div>
                        <span className="inline-flex items-center rounded-full border border-sky-200/80 bg-white px-2 py-1 text-[11px] text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/12 dark:text-sky-300">
                          {Math.round(task.progress)}%
                        </span>
                      </div>
                      <ProgressBar className="mt-2.5" value={task.progress} size="sm" color="gold" />
                    </article>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/60 p-3 dark:border-emerald-500/25 dark:bg-emerald-950/20">
                <div className="mb-2 flex items-center justify-between">
                  <div className="inline-flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                    <ArrowDownToLine className="h-3.5 w-3.5" />
                    下载任务
                  </div>
                  <span className="text-[11px] text-emerald-700 dark:text-emerald-300/90">
                    {activeDownloads.length} 项
                  </span>
                </div>
                <div className="max-h-[380px] space-y-2.5 overflow-y-auto pr-1">
                  {activeDownloads.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-emerald-200/80 bg-white/65 px-3 py-4 text-xs text-emerald-700/80 dark:border-emerald-500/30 dark:bg-emerald-950/20 dark:text-emerald-300/80">
                      暂无下载任务
                    </div>
                  ) : null}
                  {activeDownloads.map((task) => (
                    <article
                      key={`download-${task.id}`}
                      className="rounded-xl border border-emerald-200/70 bg-white/92 p-3 dark:border-emerald-500/20 dark:bg-neutral-900/78"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                            {task.fileName}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                            <span>{formatFileSize(task.size)}</span>
                            <span>{taskStatusLabel(task.status)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center rounded-full border border-emerald-200/80 bg-white px-2 py-1 text-[11px] text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/12 dark:text-emerald-300">
                            {Math.round(task.progress)}%
                          </span>
                          <ActionTextButton
                            tone="warning"
                            onPress={() => onCancelDownload(task.id)}
                            className="h-7! px-2! py-0! text-[11px]"
                          >
                            取消
                          </ActionTextButton>
                        </div>
                      </div>
                      <ProgressBar className="mt-2.5" value={task.progress} size="sm" color="gold" />
                    </article>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        {hasIssueTasks ? (
          <section className="rounded-3xl border border-orange-200/80 bg-orange-50/80 shadow-[0_18px_42px_-34px_rgba(217,119,6,0.45)] dark:border-orange-500/30 dark:bg-orange-500/8">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-orange-200/80 px-4 py-3 md:px-5 dark:border-orange-500/20">
              <div className="flex items-center gap-2 text-sm font-medium text-orange-700 dark:text-orange-300">
                <ShieldAlert className="h-4 w-4" />
                异常任务
              </div>
              <ActionTextButton tone="warning" onPress={() => setDangerAction({ type: 'clear-finished-downloads' })}>
                清理已结束下载
              </ActionTextButton>
            </div>

            <div className="divide-y divide-orange-200/70 dark:divide-orange-500/20">
              {failedUploads.map((task) => (
                <div
                  key={`failed-upload-${task.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 md:px-5"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      {task.file.name}
                    </div>
                    <div className="mt-1 text-xs text-red-600 dark:text-red-300">{task.error || '上传失败'}</div>
                  </div>
                  <ActionTextButton
                    tone="brand"
                    onPress={() => void onRetryUpload(task.id)}
                    leadingIcon={<RotateCcw className="h-3.5 w-3.5" />}
                  >
                    重试
                  </ActionTextButton>
                </div>
              ))}

              {failedDownloads.map((task) => (
                <div
                  key={`failed-download-${task.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 md:px-5"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      {task.fileName}
                    </div>
                    <div className="mt-1 text-xs text-red-600 dark:text-red-300">{task.error || '下载失败'}</div>
                  </div>
                  <ActionTextButton
                    tone="brand"
                    onPress={() => onRetryDownload(task.id)}
                    leadingIcon={<RotateCcw className="h-3.5 w-3.5" />}
                  >
                    重试
                  </ActionTextButton>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="rounded-3xl border border-neutral-200/80 bg-white/88 shadow-[0_26px_58px_-44px_rgba(15,23,42,0.75)] dark:border-neutral-700/80 dark:bg-neutral-900/76">
          <div className="border-b border-neutral-200/80 px-4 py-4 md:px-5 dark:border-neutral-700/80">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-base font-semibold text-neutral-900 dark:text-neutral-100">历史记录</div>
                <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                  按时间查看传输结果，并支持按类型筛选与快速清理。
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <ActionStatusPill>
                  {historyFilterLabel(historyFilter)} / {rowTypeFilterLabel(historyRowTypeFilter)}
                </ActionStatusPill>
                <ActionStatusPill>记录 {historyTableRows.length}</ActionStatusPill>
                {torrentLoading ? (
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">种子任务同步中...</span>
                ) : null}
                <ActionTextButton
                  tone="brand"
                  active={historyAdvancedOpen}
                  onPress={() => setHistoryAdvancedOpen((prev) => !prev)}
                  leadingIcon={<SlidersHorizontal className="h-3.5 w-3.5" />}
                  trailingIcon={
                    historyAdvancedOpen ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )
                  }
                  aria-expanded={historyAdvancedOpen}
                  aria-label="展开或收起筛选项"
                >
                  筛选
                </ActionTextButton>
              </div>
            </div>

            {historyAdvancedOpen ? (
              <div className="mt-3 grid gap-3 rounded-2xl border border-neutral-200/80 bg-white/90 p-3.5 lg:grid-cols-3 dark:border-neutral-700/80 dark:bg-neutral-900/70">
                <div className="space-y-2">
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">方向（仅文件记录）</div>
                  <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-neutral-200/80 bg-white p-1 dark:border-neutral-700/80 dark:bg-neutral-900/85">
                    <ActionTextButton
                      active={historyFilter === 'all'}
                      onPress={() => onHistoryFilterChange('all')}
                      className="justify-center"
                    >
                      全部
                    </ActionTextButton>
                    <ActionTextButton
                      active={historyFilter === 'upload'}
                      onPress={() => onHistoryFilterChange('upload')}
                      className="justify-center"
                    >
                      上传
                    </ActionTextButton>
                    <ActionTextButton
                      active={historyFilter === 'download'}
                      onPress={() => onHistoryFilterChange('download')}
                      className="justify-center"
                    >
                      下载
                    </ActionTextButton>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">记录类型</div>
                  <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-neutral-200/80 bg-white p-1 dark:border-neutral-700/80 dark:bg-neutral-900/85">
                    <ActionTextButton
                      active={historyRowTypeFilter === 'all'}
                      onPress={() => setHistoryRowTypeFilter('all')}
                      className="justify-center"
                    >
                      全部
                    </ActionTextButton>
                    <ActionTextButton
                      active={historyRowTypeFilter === 'file'}
                      onPress={() => setHistoryRowTypeFilter('file')}
                      className="justify-center"
                    >
                      文件
                    </ActionTextButton>
                    <ActionTextButton
                      active={historyRowTypeFilter === 'torrent'}
                      onPress={() => setHistoryRowTypeFilter('torrent')}
                      className="justify-center"
                    >
                      种子
                    </ActionTextButton>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">清理文件历史</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <NumberFieldInput
                      min={1}
                      max={3650}
                      value={cleanupDaysInput}
                      onValueChange={setCleanupDaysInput}
                      placeholder="天数"
                      className="w-[116px] py-1.5 text-xs"
                    />
                    <ActionTextButton
                      tone="warning"
                      onPress={() => {
                        const days = Number.parseInt(cleanupDaysInput.trim(), 10);
                        setDangerAction({
                          type: 'clear-history-by-days',
                          days: Number.isFinite(days) ? days : 7,
                        });
                      }}
                    >
                      清理早于 N 天
                    </ActionTextButton>
                    <ActionTextButton tone="danger" onPress={() => setDangerAction({ type: 'clear-history' })}>
                      清空历史
                    </ActionTextButton>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="md:hidden">
            {historyLoading && historyTableRows.length === 0 && historyRowTypeFilter !== 'torrent' ? (
              <div className="px-4 py-8 text-sm text-neutral-500 dark:text-neutral-400">正在加载历史记录...</div>
            ) : null}
            {!historyLoading && historyTableRows.length === 0 ? (
              <div className="px-4 py-8 text-sm text-neutral-500 dark:text-neutral-400">暂无历史记录。</div>
            ) : null}
            {historyTableRows.map((row) => {
              const progressValue = row.progressText ? Number.parseInt(row.progressText, 10) : null;
              const safeProgress =
                typeof progressValue === 'number' && Number.isFinite(progressValue)
                  ? Math.min(100, Math.max(0, progressValue))
                  : null;

              return (
                <article
                  key={`mobile-${row.id}`}
                  className="border-t border-neutral-200/80 bg-white/78 px-4 py-3.5 first:border-t-0 dark:border-neutral-700/80 dark:bg-transparent"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                        {row.name}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                          {row.typeLabel}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                          {row.subTypeLabel}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${row.statusClassName}`}
                        >
                          {row.statusLabel}
                        </span>
                      </div>
                    </div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">
                      {row.progressText || formatFileSize(row.size)}
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl border border-neutral-200/80 bg-neutral-50/85 p-2.5 dark:border-neutral-700/80 dark:bg-neutral-900/75">
                    <div className="text-[11px] text-neutral-500 dark:text-neutral-400">大小 / 进度</div>
                    <div className="mt-1 text-xs text-neutral-700 dark:text-neutral-200">
                      {formatFileSize(row.size)}
                    </div>
                    {safeProgress !== null ? (
                      <div className="mt-1.5">
                        <ProgressBar value={safeProgress} size="sm" color="gold" />
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-2.5 rounded-xl border border-neutral-200/80 bg-neutral-50/85 p-2.5 dark:border-neutral-700/80 dark:bg-neutral-900/75">
                    <div className="text-[11px] text-neutral-500 dark:text-neutral-400">清理状态</div>
                    <span
                      className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${row.cleanupClassName}`}
                    >
                      {row.cleanupLabel}
                    </span>
                    <div className="mt-1 text-[11px] leading-4 text-neutral-500 dark:text-neutral-400">
                      {row.cleanupDueLabel}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
                    <Clock3 className="h-3.5 w-3.5" />
                    {formatDateTime(new Date(row.finishedAtMs))}
                  </div>

                  {row.error ? <div className="mt-2 text-xs text-red-600 dark:text-red-300">{row.error}</div> : null}

                  <div className="mt-3">{renderRowActions(row, true)}</div>
                </article>
              );
            })}
          </div>

          <div className="hidden px-4 py-4 md:block md:px-5 md:py-5">
            <ScrollShadow
              orientation="horizontal"
              hideScrollBar
              className="rounded-2xl border border-neutral-200/80 bg-white/94 dark:border-neutral-700/80 dark:bg-neutral-900/72"
            >
              <table className="w-full min-w-[1020px] table-fixed text-sm">
                <colgroup>
                  <col className="w-[28%]" />
                  <col className="w-[14%]" />
                  <col className="w-[16%]" />
                  <col className="w-[12%]" />
                  <col className="w-[16%]" />
                  <col className="w-[14%]" />
                  <col className="w-[12%]" />
                </colgroup>
                <thead>
                  <tr>
                    <th className="sticky top-0 z-10 border-b border-neutral-200/80 bg-neutral-100/95 px-4 py-3 text-left text-[11px] font-semibold tracking-[0.12em] text-neutral-500 uppercase backdrop-blur dark:border-neutral-700/80 dark:bg-neutral-900/95 dark:text-neutral-400">
                      名称
                    </th>
                    <th className="sticky top-0 z-10 border-b border-neutral-200/80 bg-neutral-100/95 px-4 py-3 text-left text-[11px] font-semibold tracking-[0.12em] text-neutral-500 uppercase backdrop-blur dark:border-neutral-700/80 dark:bg-neutral-900/95 dark:text-neutral-400">
                      来源
                    </th>
                    <th className="sticky top-0 z-10 border-b border-neutral-200/80 bg-neutral-100/95 px-4 py-3 text-left text-[11px] font-semibold tracking-[0.12em] text-neutral-500 uppercase backdrop-blur dark:border-neutral-700/80 dark:bg-neutral-900/95 dark:text-neutral-400">
                      大小 / 进度
                    </th>
                    <th className="sticky top-0 z-10 border-b border-neutral-200/80 bg-neutral-100/95 px-4 py-3 text-left text-[11px] font-semibold tracking-[0.12em] text-neutral-500 uppercase backdrop-blur dark:border-neutral-700/80 dark:bg-neutral-900/95 dark:text-neutral-400">
                      状态
                    </th>
                    <th className="sticky top-0 z-10 border-b border-neutral-200/80 bg-neutral-100/95 px-4 py-3 text-left text-[11px] font-semibold tracking-[0.12em] text-neutral-500 uppercase backdrop-blur dark:border-neutral-700/80 dark:bg-neutral-900/95 dark:text-neutral-400">
                      清理
                    </th>
                    <th className="sticky top-0 z-10 border-b border-neutral-200/80 bg-neutral-100/95 px-4 py-3 text-left text-[11px] font-semibold tracking-[0.12em] text-neutral-500 uppercase backdrop-blur dark:border-neutral-700/80 dark:bg-neutral-900/95 dark:text-neutral-400">
                      完成时间
                    </th>
                    <th className="sticky top-0 z-10 border-b border-neutral-200/80 bg-neutral-100/95 px-4 py-3 text-left text-[11px] font-semibold tracking-[0.12em] text-neutral-500 uppercase backdrop-blur dark:border-neutral-700/80 dark:bg-neutral-900/95 dark:text-neutral-400">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {historyTableRows.map((row) => {
                    const progressValue = row.progressText ? Number.parseInt(row.progressText, 10) : null;
                    const safeProgress =
                      typeof progressValue === 'number' && Number.isFinite(progressValue)
                        ? Math.min(100, Math.max(0, progressValue))
                        : null;

                    return (
                      <tr
                        key={row.id}
                        className="align-top transition-colors duration-200 odd:bg-white even:bg-neutral-50/65 hover:bg-orange-50/55 dark:odd:bg-transparent dark:even:bg-neutral-900/45 dark:hover:bg-orange-500/6"
                      >
                        <td className="px-4 py-3.5">
                          <div className="max-w-[320px] truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                            {row.name}
                          </div>
                          {row.error ? (
                            <div className="mt-1 max-w-[320px] truncate text-xs text-red-600 dark:text-red-300">
                              {row.error}
                            </div>
                          ) : null}
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${row.faststartClassName}`}
                            >
                              视频加速: {row.faststartLabel}
                            </span>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${row.previewClassName}`}
                            >
                              封面: {row.previewLabel}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                              {row.typeLabel}
                            </span>
                            <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                              {row.subTypeLabel}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="text-xs text-neutral-600 dark:text-neutral-300">
                            {formatFileSize(row.size)}
                          </div>
                          {safeProgress !== null ? (
                            <div className="mt-1.5 max-w-[160px]">
                              <ProgressBar value={safeProgress} size="sm" color="gold" />
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${row.statusClassName}`}
                          >
                            {row.statusLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex flex-col gap-1">
                            <span
                              className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${row.cleanupClassName}`}
                            >
                              {row.cleanupLabel}
                            </span>
                            <span className="max-w-[240px] text-[11px] leading-4 text-neutral-500 dark:text-neutral-400">
                              {row.cleanupDueLabel}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="inline-flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
                            <Clock3 className="h-3.5 w-3.5" />
                            {formatDateTime(new Date(row.finishedAtMs))}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">{renderRowActions(row)}</td>
                      </tr>
                    );
                  })}

                  {historyLoading && historyTableRows.length === 0 && historyRowTypeFilter !== 'torrent' ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-sm text-neutral-500 dark:text-neutral-400">
                        正在加载历史记录...
                      </td>
                    </tr>
                  ) : null}

                  {!historyLoading && historyTableRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-sm text-neutral-500 dark:text-neutral-400">
                        暂无历史记录。
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </ScrollShadow>
          </div>

          <div className="border-t border-neutral-200/80 px-4 py-3.5 md:px-5 dark:border-neutral-700/80">
            {historyRowTypeFilter === 'torrent' ? (
              <div className="text-xs text-neutral-500 dark:text-neutral-400">当前仅显示种子记录，不使用文件分页。</div>
            ) : (
              <>
                <div className="text-xs text-neutral-500 dark:text-neutral-400">
                  文件记录按分页加载，可切换每页数量。
                </div>
                <Pagination
                  className="mt-2"
                  page={historyPagination.page}
                  pageSize={historyPagination.pageSize}
                  totalCount={historyPagination.totalCount}
                  totalPages={historyPagination.totalPages}
                  onPageChange={onHistoryPageChange}
                  onPageSizeChange={onHistoryPageSizeChange}
                  pageSizeOptions={[20, 50, 100]}
                />
              </>
            )}
          </div>
        </section>
      </div>

      <DangerActionConfirmModal
        open={Boolean(dangerConfirmConfig)}
        title={dangerConfirmConfig?.title || '确认操作'}
        description={dangerConfirmConfig?.description || ''}
        confirmText={dangerConfirmConfig?.confirmText || '确认继续'}
        onClose={() => setDangerAction(null)}
        onConfirm={handleConfirmDangerAction}
      />
    </div>
  );
}
