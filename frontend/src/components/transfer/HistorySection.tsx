import type { HistoryFilter, HistoryPagination } from '@/hooks/useTransferCenter';
import type { TransferHistoryItem, TorrentTask } from '@/types';
import type {
  HistoryStatusFilter,
  TransferHistoryTab,
} from '@/components/transfer/transferHistoryTypes';
import { HistoryFilters } from '@/components/transfer/HistoryFilters';
import { HistoryFileList } from '@/components/transfer/HistoryFileList';
import { HistoryTorrentList } from '@/components/transfer/HistoryTorrentList';
import { motion, AnimatePresence } from 'framer-motion';
import { Tabs, type TabItem } from '@/components/ui/Tabs';

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
  nowMs,
  onCopyText,
  onOpenTorrentSelection,
  onRetryTorrentTask,
  onRequestDeleteTorrentTask,
}: HistorySectionProps) {
  const historyTabs: TabItem<TransferHistoryTab>[] = [
    { id: 'files', label: '文件历史', badge: historyPagination.totalCount },
    { id: 'torrents', label: '种子任务', badge: torrentTasks.length },
  ];

  return (
    <section
      id="transfer-history"
      className="relative scroll-mt-[var(--transfer-sticky-offset)] md:scroll-mt-24"
    >
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            传输记录
          </h2>
          <p className="text-xs font-medium text-neutral-500">
            ARCHIVED TASKS · {historyPagination.totalCount + torrentTasks.length} ITEMS
          </p>
        </div>

        <Tabs
          tabs={historyTabs}
          activeTab={tab}
          onChange={onTabChange}
          layoutId="historyTabs"
        />
      </div>

      <div className="mt-8 overflow-hidden rounded-[2.5rem] border border-neutral-200/80 bg-[linear-gradient(165deg,rgba(255,255,255,0.5),rgba(250,248,245,0.4))] shadow-[0_32px_64px_-24px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-white/5 dark:bg-[linear-gradient(165deg,rgba(23,23,23,0.4),rgba(15,23,42,0.3))]">
        <div className="p-2 sm:p-4">
          <AnimatePresence mode="wait">
            {tab === 'files' ? (
              <motion.div
                key="files"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="space-y-4"
              >
                <div className="px-2 pt-2 md:px-4">
                  <HistoryFilters
                    direction={historyFilter}
                    onDirectionChange={onHistoryFilterChange}
                    status={fileStatusFilter}
                    onStatusChange={onFileStatusFilterChange}
                    query={query}
                    onQueryChange={onQueryChange}
                  />
                </div>
                <div className="rounded-[1.8rem] bg-white/40 dark:bg-black/20 overflow-hidden">
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
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="torrents"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="space-y-4"
              >
                <div className="px-2 pt-2 md:px-4">
                  <HistoryFilters
                    direction={historyFilter}
                    onDirectionChange={onHistoryFilterChange}
                    status={fileStatusFilter}
                    onStatusChange={onFileStatusFilterChange}
                    query={query}
                    onQueryChange={onQueryChange}
                  />
                </div>
                <div className="rounded-[1.8rem] bg-white/40 dark:bg-black/20 overflow-hidden">
                  <HistoryTorrentList
                    tasks={torrentTasks}
                    loading={torrentLoading}
                    query={query}
                    nowMs={nowMs}
                    onCopyInfoHash={(hash) => void onCopyText(hash, 'InfoHash 已复制')}
                    onOpenSelection={onOpenTorrentSelection}
                    onRetryTask={onRetryTorrentTask}
                    onRequestDelete={onRequestDeleteTorrentTask}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

    </section>
  );
}
