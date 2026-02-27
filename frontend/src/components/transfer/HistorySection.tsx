import type { HistoryFilter, HistoryPagination } from '@/hooks/useTransferCenter';
import type { TransferHistoryItem, TorrentTask } from '@/types';
import type {
  HistoryStatusFilter,
  TorrentCleanupFilter,
  TorrentStatusFilter,
  TransferHistoryTab,
} from '@/components/transfer/transferHistoryTypes';
import { ActionStatusPill, ActionTextButton } from '@/components/ui/HeroActionPrimitives';
import { HistoryFilters } from '@/components/transfer/HistoryFilters';
import { HistoryFileList } from '@/components/transfer/HistoryFileList';
import { HistoryTorrentList } from '@/components/transfer/HistoryTorrentList';

export interface HistorySectionProps {
  tab: TransferHistoryTab;
  onTabChange: (next: TransferHistoryTab) => void;
  query: string;
  onQueryChange: (next: string) => void;

  history: TransferHistoryItem[];
  historyFilter: HistoryFilter;
  historyLoading: boolean;
  historyPagination: HistoryPagination;
  fileStatusFilter: HistoryStatusFilter;
  onFileStatusFilterChange: (next: HistoryStatusFilter) => void;
  onHistoryFilterChange: (filter: HistoryFilter) => void;
  onHistoryPageChange: (page: number) => void;
  onHistoryPageSizeChange: (pageSize: number) => void;
  onRequestRemoveHistoryItem: (id: string, name: string) => void;

  torrentTasks: TorrentTask[];
  torrentLoading: boolean;
  torrentStatusFilter: TorrentStatusFilter;
  onTorrentStatusFilterChange: (next: TorrentStatusFilter) => void;
  torrentCleanupFilter: TorrentCleanupFilter;
  onTorrentCleanupFilterChange: (next: TorrentCleanupFilter) => void;
  nowMs: number;
  onCopyText: (text: string, successMessage: string) => void;
  onOpenTorrentSelection: (taskId: string) => void;
  onRetryTorrentTask: (taskId: string) => void | Promise<void>;
  onRequestDeleteTorrentTask: (task: TorrentTask) => void;
}

/**
 * 传输历史区：文件/种子平级切换 + 内联筛选 + 列表 + 分页
 */
export function HistorySection({
  tab,
  onTabChange,
  query,
  onQueryChange,
  history,
  historyFilter,
  historyLoading,
  historyPagination,
  fileStatusFilter,
  onFileStatusFilterChange,
  onHistoryFilterChange,
  onHistoryPageChange,
  onHistoryPageSizeChange,
  onRequestRemoveHistoryItem,
  torrentTasks,
  torrentLoading,
  torrentStatusFilter,
  onTorrentStatusFilterChange,
  torrentCleanupFilter,
  onTorrentCleanupFilterChange,
  nowMs,
  onCopyText,
  onOpenTorrentSelection,
  onRetryTorrentTask,
  onRequestDeleteTorrentTask,
}: HistorySectionProps) {
  return (
    <section
      id="transfer-history"
      className="glass-card scroll-mt-[var(--transfer-sticky-offset)] px-4 py-4 md:scroll-mt-24 md:px-5"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">传输历史</div>
          <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            文件历史支持分页；种子任务来自完整任务列表。
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <ActionStatusPill>文件 {historyPagination.totalCount}</ActionStatusPill>
          <ActionStatusPill>种子 {torrentTasks.length}</ActionStatusPill>
          {torrentLoading ? <span className="text-xs text-neutral-500 dark:text-neutral-400">同步中...</span> : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <ActionTextButton active={tab === 'files'} onPress={() => onTabChange('files')} className="justify-center">
          文件
        </ActionTextButton>
        <ActionTextButton
          active={tab === 'torrents'}
          onPress={() => onTabChange('torrents')}
          className="justify-center"
        >
          种子
        </ActionTextButton>
      </div>

      {tab === 'files' ? (
        <>
          <div className="mt-4">
            <HistoryFilters
              direction={historyFilter}
              onDirectionChange={onHistoryFilterChange}
              status={fileStatusFilter}
              onStatusChange={onFileStatusFilterChange}
              query={query}
              onQueryChange={onQueryChange}
            />
          </div>
          <HistoryFileList
            items={history}
            loading={historyLoading}
            statusFilter={fileStatusFilter}
            query={query}
            pagination={historyPagination}
            onPageChange={onHistoryPageChange}
            onPageSizeChange={onHistoryPageSizeChange}
            onRequestRemoveItem={onRequestRemoveHistoryItem}
          />
        </>
      ) : (
        <HistoryTorrentList
          tasks={torrentTasks}
          loading={torrentLoading}
          query={query}
          statusFilter={torrentStatusFilter}
          onStatusFilterChange={onTorrentStatusFilterChange}
          cleanupFilter={torrentCleanupFilter}
          onCleanupFilterChange={onTorrentCleanupFilterChange}
          nowMs={nowMs}
          onCopyInfoHash={(hash) => void onCopyText(hash, 'InfoHash 已复制')}
          onOpenSelection={onOpenTorrentSelection}
          onRetryTask={onRetryTorrentTask}
          onRequestDelete={onRequestDeleteTorrentTask}
        />
      )}
    </section>
  );
}
