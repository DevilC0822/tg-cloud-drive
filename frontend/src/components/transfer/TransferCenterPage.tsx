import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DownloadTask, TorrentTask, TransferHistoryItem, UploadTask } from '@/types';
import type { HistoryFilter, HistoryPagination } from '@/hooks/useTransferCenter';
import { AttentionBanner } from '@/components/transfer/AttentionBanner';
import { ActiveTaskSection } from '@/components/transfer/ActiveTaskSection';
import type { ActiveTaskRow } from '@/components/transfer/ActiveTaskItem';
import { HistorySection } from '@/components/transfer/HistorySection';
import type {
  HistoryStatusFilter,
  TransferHistoryTab,
} from '@/components/transfer/transferHistoryTypes';
import { isActiveTorrentTask } from '@/components/transfer/transferUtils';
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
  historyError?: string;
  historyPagination: HistoryPagination;
  torrentError?: string;
  onRetryUpload: (taskId: string) => Promise<unknown>;
  onRemoveUploadTask: (taskId: string) => void;
  onRetryDownload: (taskId: string) => void;
  onCancelDownload: (taskId: string) => void;
  onRemoveHistoryItem: (id: string) => void | Promise<void>;
  onDeleteTorrentTask: (id: string) => void | Promise<void>;
  onHistoryFilterChange: (filter: HistoryFilter) => void;
  onHistoryPageChange: (page: number) => void;
  onHistoryPageSizeChange: (pageSize: number) => void;
  onOpenTorrentSelection: (taskId: string) => void;
  onRetryTorrentTask: (taskId: string) => void | Promise<void>;
}

type TransferDangerAction =
  | { type: 'cancel-all-downloads' }
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
  historyError,
  historyPagination,
  torrentError,
  onRetryUpload,
  onRemoveUploadTask,
  onRetryDownload,
  onCancelDownload,
  onRemoveHistoryItem,
  onDeleteTorrentTask,
  onHistoryFilterChange,
  onHistoryPageChange,
  onHistoryPageSizeChange,
  onOpenTorrentSelection,
  onRetryTorrentTask,
}: TransferCenterPageProps) {
  const { pushToast } = useToast();
  const [historyQuery, setHistoryQuery] = useState('');
  const [attentionOpen, setAttentionOpen] = useState(false);
  const [activeOpen, setActiveOpen] = useState(true);
  const [historyTab, setHistoryTab] = useState<TransferHistoryTab>('files');
  const [cleanupNowMs, setCleanupNowMs] = useState(() => Date.now());
  const [fileHistoryStatusFilter, setFileHistoryStatusFilter] = useState<HistoryStatusFilter>('all');
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
  const awaitingSelectionTasks = useMemo(
    () => torrentTasks.filter((task) => task.status === 'awaiting_selection'),
    [torrentTasks],
  );
  const failedTorrentTasks = useMemo(() => torrentTasks.filter((task) => task.status === 'error'), [torrentTasks]);
  const activeTorrentTasks = useMemo(() => torrentTasks.filter(isActiveTorrentTask), [torrentTasks]);

  const historyScopedQuery = historyQuery.trim();
  const sectionQuery = '';

  const dangerConfirmConfig = useMemo(() => {
    if (!dangerAction) return null;

    if (dangerAction.type === 'cancel-all-downloads') {
      return {
        title: '确认取消全部下载',
        description: '将取消当前所有进行中的下载任务。',
        confirmText: '确认取消',
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

    if (dangerAction.type === 'cancel-all-downloads') {
      for (const task of activeDownloads) {
        onCancelDownload(task.id);
      }
      setDangerAction(null);
      return;
    }

    if (dangerAction.type === 'remove-history-item') {
      void onRemoveHistoryItem(dangerAction.id);
      setDangerAction(null);
      return;
    }

    void onDeleteTorrentTask(dangerAction.id);
    setDangerAction(null);
  }, [activeDownloads, dangerAction, onCancelDownload, onDeleteTorrentTask, onRemoveHistoryItem]);

  const handleCopyText = useCallback(
    async (text: string, successMessage: string) => {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
          pushToast({ type: 'success', message: successMessage });
          return;
        }
      } catch {
        // 忽略
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
    setDangerAction({ type: 'cancel-all-downloads' });
  }, []);

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden px-3 pt-0 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 md:px-8 md:pt-4 md:pb-12">
      {/* Background Decorative Elements - 移动端性能优化 */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-[-5%] left-[-5%] h-[30%] w-[40%] rounded-full bg-brand-500/5 blur-[80px] md:blur-[120px]" />
        <div className="absolute right-[-5%] bottom-[-5%] h-[25%] w-[35%] rounded-full bg-brand-500/5 blur-[60px] md:blur-[100px]" />
      </div>

      <div className="mx-auto max-w-6xl space-y-6 sm:space-y-8 md:space-y-10">
        <div className="space-y-8 sm:space-y-10 md:space-y-12">
          {historyError || torrentError ? (
            <section
              aria-live="polite"
              className="group relative overflow-hidden rounded-2xl border border-amber-200/50 bg-amber-50/50 p-4 transition-all hover:bg-amber-50/80 dark:border-amber-500/20 dark:bg-amber-500/5"
            >
              <div className="relative z-10 flex items-center gap-3 text-sm font-medium text-amber-800 dark:text-amber-200">
                <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                <div className="space-y-1 min-w-0">
                  {historyError ? <div className="truncate">历史同步失败：{historyError}</div> : null}
                  {torrentError ? <div className="truncate">Torrent 同步失败：{torrentError}</div> : null}
                </div>
              </div>
            </section>
          ) : null}

          <div id="transfer-attention">
            <AttentionBanner
              failedUploads={failedUploads}
              failedDownloads={failedDownloads}
              awaitingSelectionTasks={awaitingSelectionTasks}
              failedTorrentTasks={failedTorrentTasks}
              query={sectionQuery}
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
          </div>

          <div id="transfer-active" className="space-y-4">
            <div className="flex items-center gap-3 px-1 sm:px-2">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-neutral-200 to-transparent dark:via-white/10" />
              <h2 className="text-[9px] font-black uppercase tracking-[0.25em] text-neutral-400 sm:text-[10px]">
                活跃处理中
              </h2>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-neutral-200 to-transparent dark:via-white/10" />
            </div>
            
            <ActiveTaskSection
              rows={activeRows}
              activeDownloadTasks={activeDownloads}
              query={sectionQuery}
              open={activeOpen}
              onOpenChange={setActiveOpen}
              onCancelDownload={onCancelDownload}
              onRequestCancelAllDownloads={handleCancelAllDownloads}
            />
          </div>

          <div id="transfer-history" className="space-y-4">
            <div className="flex items-center gap-3 px-1 sm:px-2">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-neutral-200 to-transparent dark:via-white/10" />
              <h2 className="text-[9px] font-black uppercase tracking-[0.25em] text-neutral-400 sm:text-[10px]">
                任务归档
              </h2>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-neutral-200 to-transparent dark:via-white/10" />
            </div>

            <HistorySection
              tab={historyTab}
              onTabChange={setHistoryTab}
              query={historyScopedQuery}
              onQueryChange={setHistoryQuery}
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
        </div>
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
