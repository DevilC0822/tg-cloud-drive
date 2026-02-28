import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { DownloadTask, TorrentTask, TransferHistoryItem, UploadTask } from '@/types';
import type { HistoryFilter, HistoryPagination } from '@/hooks/useTransferCenter';
import { AttentionBanner } from '@/components/transfer/AttentionBanner';
import { ActiveTaskSection } from '@/components/transfer/ActiveTaskSection';
import type { ActiveTaskRow } from '@/components/transfer/ActiveTaskItem';
import { HistorySection } from '@/components/transfer/HistorySection';
import type {
  HistoryStatusFilter,
  TorrentCleanupFilter,
  TorrentStatusFilter,
  TransferHistoryTab,
} from '@/components/transfer/transferHistoryTypes';
import { TransferHeader } from '@/components/transfer/TransferHeader';
import { isActiveTorrentTask } from '@/components/transfer/transferUtils';
import type { TransferCleanupAction } from '@/components/transfer/transferCleanupTypes';
import { DangerActionConfirmModal } from '@/components/ui/HeroActionPrimitives';
import { useToast } from '@/hooks/useToast';

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
  onRemoveUploadTask: (taskId: string) => void;
  onRetryDownload: (taskId: string) => void;
  onCancelDownload: (taskId: string) => void;
  onCleanup: (action: TransferCleanupAction) => void | Promise<void>;
  onHistoryFilterChange: (filter: HistoryFilter) => void;
  onHistoryPageChange: (page: number) => void;
  onHistoryPageSizeChange: (pageSize: number) => void;
  onOpenTorrentSelection: (taskId: string) => void;
  onRetryTorrentTask: (taskId: string) => void | Promise<void>;
}

type TransferDangerAction =
  | { type: 'clear-history' }
  | { type: 'clear-history-by-days'; days: number }
  | { type: 'remove-history-item'; id: string; name: string }
  | { type: 'delete-torrent-task'; id: string; name: string };

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
  onRemoveUploadTask,
  onRetryDownload,
  onCancelDownload,
  onCleanup,
  onHistoryFilterChange,
  onHistoryPageChange,
  onHistoryPageSizeChange,
  onOpenTorrentSelection,
  onRetryTorrentTask,
}: TransferCenterPageProps) {
  const { pushToast } = useToast();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const headerWrapRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState('');
  const [attentionOpen, setAttentionOpen] = useState(false);
  const [activeOpen, setActiveOpen] = useState(true);
  const [historyTab, setHistoryTab] = useState<TransferHistoryTab>('files');
  const [cleanupNowMs, setCleanupNowMs] = useState(() => Date.now());
  const [stickyOffsetPx, setStickyOffsetPx] = useState(96);
  const [headerElevated, setHeaderElevated] = useState(false);
  const [fileHistoryStatusFilter, setFileHistoryStatusFilter] = useState<HistoryStatusFilter>('all');
  const [torrentStatusFilter, setTorrentStatusFilter] = useState<TorrentStatusFilter>('all');
  const [torrentCleanupFilter, setTorrentCleanupFilter] = useState<TorrentCleanupFilter>('all');
  const [dangerAction, setDangerAction] = useState<TransferDangerAction | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCleanupNowMs(Date.now());
    }, 60 * 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const headerEl = headerWrapRef.current;
    if (!headerEl) return;

    const updateOffset = () => {
      const height = headerEl.getBoundingClientRect().height;
      const next = Math.max(96, Math.ceil(height + 12));
      setStickyOffsetPx(next);
    };

    updateOffset();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      updateOffset();
    });
    observer.observe(headerEl);
    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const rootEl = rootRef.current;
    const scrollEl = (rootEl?.closest('main') as HTMLElement | null) ?? null;
    const target: EventTarget = scrollEl ?? window;

    let rafId = 0;
    const updateElevation = () => {
      rafId = 0;
      const scrollTop = scrollEl ? scrollEl.scrollTop : window.scrollY;
      setHeaderElevated(scrollTop > 4);
    };

    const onScroll = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(updateElevation);
    };

    updateElevation();
    target.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      target.removeEventListener('scroll', onScroll);
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, []);

  const containerStyle = useMemo<CSSProperties>(() => {
    return {
      ['--transfer-sticky-offset' as any]: `${stickyOffsetPx}px`,
    };
  }, [stickyOffsetPx]);

  const activeUploads = useMemo(
    () => uploadTasks.filter((task) => task.status === 'pending' || task.status === 'uploading'),
    [uploadTasks],
  );
  const activeDownloads = useMemo(
    () => downloadTasks.filter((task) => task.status === 'pending' || task.status === 'downloading'),
    [downloadTasks],
  );
  const endedDownloads = useMemo(
    () => downloadTasks.filter((task) => task.status !== 'pending' && task.status !== 'downloading'),
    [downloadTasks],
  );
  const failedUploads = useMemo(() => uploadTasks.filter((task) => task.status === 'error'), [uploadTasks]);
  const completedUploads = useMemo(() => uploadTasks.filter((task) => task.status === 'completed'), [uploadTasks]);
  const failedDownloads = useMemo(
    () => downloadTasks.filter((task) => task.status === 'error' || task.status === 'canceled'),
    [downloadTasks],
  );
  const awaitingSelectionTasks = useMemo(
    () => torrentTasks.filter((task) => task.status === 'awaiting_selection'),
    [torrentTasks],
  );
  const failedTorrentTasks = useMemo(() => torrentTasks.filter((task) => task.status === 'error'), [torrentTasks]);
  const activeTorrentTasks = useMemo(() => torrentTasks.filter(isActiveTorrentTask), [torrentTasks]);

  const activeTaskCount = activeUploads.length + activeDownloads.length + activeTorrentTasks.length;
  const issueTaskCount =
    failedUploads.length + failedDownloads.length + awaitingSelectionTasks.length + failedTorrentTasks.length;

  const dangerConfirmConfig = useMemo(() => {
    if (!dangerAction) return null;

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

    if (dangerAction.type === 'clear-history') {
      void onCleanup({ type: 'clear-history' });
      setDangerAction(null);
      return;
    }

    if (dangerAction.type === 'clear-history-by-days') {
      void onCleanup({ type: 'clear-history-by-days', days: dangerAction.days });
      setDangerAction(null);
      return;
    }

    if (dangerAction.type === 'remove-history-item') {
      void onCleanup({ type: 'remove-history-item', id: dangerAction.id });
      setDangerAction(null);
      return;
    }

    void onCleanup({ type: 'delete-torrent-task', id: dangerAction.id });
    setDangerAction(null);
  }, [dangerAction, onCleanup]);

  const handleCleanupRequest = useCallback(
    (action: TransferCleanupAction) => {
      if (action.type === 'clear-history') {
        setDangerAction({ type: 'clear-history' });
        return;
      }

      if (action.type === 'clear-history-by-days') {
        setDangerAction({ type: 'clear-history-by-days', days: action.days });
        return;
      }

      void onCleanup(action);
    },
    [onCleanup],
  );

  const jumpToSection = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handleCopyText = useCallback(
    async (text: string, successMessage: string) => {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
          pushToast({ type: 'success', message: successMessage });
          return;
        }
      } catch {
        // 忽略，降级到无提示
      }
      pushToast({ type: 'info', message: '复制失败（浏览器权限限制）' });
    },
    [pushToast],
  );

  const activeRows = useMemo<ActiveTaskRow[]>(() => {
    const rows: ActiveTaskRow[] = [];
    for (const task of activeUploads) rows.push({ kind: 'upload', task });
    for (const task of activeDownloads) rows.push({ kind: 'download', task });
    for (const task of activeTorrentTasks) rows.push({ kind: 'torrent', task });

    const priority = (row: ActiveTaskRow) => {
      if (row.kind === 'upload') return row.task.status === 'uploading' ? 0 : 1;
      if (row.kind === 'download') return row.task.status === 'downloading' ? 0 : 1;
      return row.task.status === 'downloading' || row.task.status === 'uploading' ? 0 : 1;
    };

    const title = (row: ActiveTaskRow) => {
      if (row.kind === 'upload') return row.task.file.name;
      if (row.kind === 'download') return row.task.fileName;
      return row.task.torrentName || row.task.infoHash;
    };

    return rows.slice().sort((a, b) => priority(a) - priority(b) || title(a).localeCompare(title(b), 'zh-Hans-CN'));
  }, [activeDownloads, activeTorrentTasks, activeUploads]);

  const handleCancelAllDownloads = useCallback(() => {
    for (const task of activeDownloads) {
      onCancelDownload(task.id);
    }
  }, [activeDownloads, onCancelDownload]);

  return (
    <div ref={rootRef} style={containerStyle} className="mx-auto w-full max-w-[90rem] px-3 pt-0 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:px-5 md:py-7">
      <div className="space-y-5 md:space-y-6">
        <div
          ref={headerWrapRef}
          className={`transfer-header-surface sticky top-0 z-40 -mx-3 transition-[filter] duration-200 md:static md:mx-0 md:drop-shadow-none ${
            headerElevated ? 'drop-shadow-[0_18px_30px_rgba(15,23,42,0.18)]' : 'drop-shadow-none'
          }`}
        >
          <TransferHeader
            activeCount={activeTaskCount}
            issueCount={issueTaskCount}
            query={query}
            onQueryChange={setQuery}
            onJumpToActive={() => jumpToSection('transfer-active')}
            onJumpToAttention={() => jumpToSection('transfer-attention')}
            completedUploadCount={completedUploads.length}
            uploadTaskCount={uploadTasks.length}
            endedDownloadCount={endedDownloads.length}
            historyTotalCount={historyPagination.totalCount}
            onCleanup={handleCleanupRequest}
          />
        </div>

        <AttentionBanner
          failedUploads={failedUploads}
          failedDownloads={failedDownloads}
          awaitingSelectionTasks={awaitingSelectionTasks}
          failedTorrentTasks={failedTorrentTasks}
          query={query}
          open={attentionOpen}
          onToggle={() => setAttentionOpen((prev) => !prev)}
          onRetryUpload={onRetryUpload}
          onRemoveUploadTask={onRemoveUploadTask}
          onRetryDownload={onRetryDownload}
          onOpenTorrentSelection={onOpenTorrentSelection}
          onRetryTorrentTask={onRetryTorrentTask}
          onRequestDeleteTorrentTask={(task) =>
            setDangerAction({
              type: 'delete-torrent-task',
              id: task.id,
              name: task.torrentName || task.infoHash,
            })
          }
        />

        <ActiveTaskSection
          rows={activeRows}
          activeDownloadTasks={activeDownloads}
          query={query}
          open={activeOpen}
          onOpenChange={setActiveOpen}
          onCancelDownload={onCancelDownload}
          onCancelAllDownloads={handleCancelAllDownloads}
        />

        <HistorySection
          tab={historyTab}
          onTabChange={setHistoryTab}
          query={query}
          onQueryChange={setQuery}
          history={history}
          historyFilter={historyFilter}
          historyLoading={historyLoading}
          historyPagination={historyPagination}
          fileStatusFilter={fileHistoryStatusFilter}
          onFileStatusFilterChange={setFileHistoryStatusFilter}
          onHistoryFilterChange={onHistoryFilterChange}
          onHistoryPageChange={onHistoryPageChange}
          onHistoryPageSizeChange={onHistoryPageSizeChange}
          onRequestRemoveHistoryItem={(id, name) => setDangerAction({ type: 'remove-history-item', id, name })}
          torrentTasks={torrentTasks}
          torrentLoading={torrentLoading}
          torrentStatusFilter={torrentStatusFilter}
          onTorrentStatusFilterChange={setTorrentStatusFilter}
          torrentCleanupFilter={torrentCleanupFilter}
          onTorrentCleanupFilterChange={setTorrentCleanupFilter}
          nowMs={cleanupNowMs}
          onCopyText={handleCopyText}
          onOpenTorrentSelection={onOpenTorrentSelection}
          onRetryTorrentTask={onRetryTorrentTask}
          onRequestDeleteTorrentTask={(task) =>
            setDangerAction({
              type: 'delete-torrent-task',
              id: task.id,
              name: task.torrentName || task.infoHash,
            })
          }
        />
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
