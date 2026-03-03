import { motion, AnimatePresence } from 'framer-motion';
import type { TransferHistoryItem } from '@/types';
import type { HistoryStatusFilter } from '@/components/transfer/transferHistoryTypes';
import { HistoryFileItem } from './HistoryFileItem';
import { Pagination } from '@/components/ui/Pagination';
import { FileText, Inbox } from 'lucide-react';
import { staggerContainer, transitions } from '@/utils/animations';

export interface HistoryFileListProps {
  items: TransferHistoryItem[];
  loading: boolean;
  statusFilter: HistoryStatusFilter;
  query: string;
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onRequestRemoveItem: (id: string, name: string) => void;
}

/**
 * 文件历史列定义 (Grid Config)
 * 采用响应式设计，在不同屏幕下调整对齐方式
 */
export const FILE_HISTORY_GRID = "grid-cols-[1fr_auto] md:grid-cols-[minmax(0,1fr)_120px_100px_100px_180px_64px]";

function TableHeader() {
  return (
    <div className={`hidden md:grid ${FILE_HISTORY_GRID} gap-4 px-6 py-3 border-b border-neutral-200/60 dark:border-white/5`}>
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">任务文件</div>
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">容量</div>
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">耗时</div>
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">状态</div>
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">完成时间</div>
      <div className="text-right text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">操作</div>
    </div>
  );
}

export function HistoryFileList({
  items,
  loading,
  pagination,
  onPageChange,
  onPageSizeChange,
  onRequestRemoveItem,
}: HistoryFileListProps) {
  const isEmpty = !loading && items.length === 0;

  return (
    <div className="flex flex-col min-h-[400px]">
      <TableHeader />
      
      <div className="flex-1">
        <AnimatePresence mode="popLayout">
          {loading && items.length === 0 ? (
            <motion.div 
              key="loading" 
              {...transitions.fadeIn}
              className="py-20 flex flex-col items-center justify-center text-neutral-400 gap-3"
            >
              <FileText className="h-8 w-8 animate-pulse opacity-20" />
              <p className="text-xs font-bold uppercase tracking-widest">Scanning Archives...</p>
            </motion.div>
          ) : isEmpty ? (
            <motion.div 
              key="empty" 
              {...transitions.fadeIn}
              className="py-20 flex flex-col items-center justify-center text-neutral-400 gap-3"
            >
              <Inbox className="h-8 w-8 opacity-20" />
              <p className="text-xs font-bold uppercase tracking-widest">No Records Found</p>
            </motion.div>
          ) : (
            <motion.div
              key="list"
              variants={staggerContainer}
              initial="initial"
              animate="animate"
            >
              {items.map((item) => (
                <HistoryFileItem
                  key={item.id}
                  item={item}
                  onRequestRemove={onRequestRemoveItem}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {!isEmpty && (
        <div className="px-6 py-6 border-t border-neutral-200/60 dark:border-white/5">
          <Pagination
            page={pagination.page}
            pageSize={pagination.pageSize}
            totalCount={pagination.totalCount}
            totalPages={pagination.totalPages}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
        </div>
      )}
    </div>
  );
}
