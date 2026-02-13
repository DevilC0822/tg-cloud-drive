import { useMemo } from 'react';
import type { TransferHistoryItem } from '@/types';
import type { HistoryPagination } from '@/hooks/useTransferCenter';
import type { HistoryStatusFilter } from '@/components/transfer/transferHistoryTypes';
import { Pagination } from '@/components/ui/Pagination';
import { HistoryFileItem } from '@/components/transfer/HistoryFileItem';
import { includesQuery, normalizeQuery } from '@/components/transfer/transferUtils';

export interface HistoryFileListProps {
  items: TransferHistoryItem[];
  loading: boolean;
  statusFilter: HistoryStatusFilter;
  query: string;
  pagination: HistoryPagination;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onRequestRemoveItem: (id: string, name: string) => void;
}

export function HistoryFileList({
  items,
  loading,
  statusFilter,
  query,
  pagination,
  onPageChange,
  onPageSizeChange,
  onRequestRemoveItem,
}: HistoryFileListProps) {
  const queryNorm = useMemo(() => normalizeQuery(query), [query]);

  const filtered = useMemo(() => {
    return items
      .filter((item) => (statusFilter === 'all' ? true : item.status === statusFilter))
      .filter((item) => (queryNorm ? includesQuery(item.fileName, queryNorm) : true))
      .slice()
      .sort((a, b) => b.finishedAt - a.finishedAt);
  }, [items, queryNorm, statusFilter]);

  const emptyText = useMemo(() => {
    if (loading && items.length === 0) return '正在加载历史记录...';
    if (items.length === 0) return '暂无历史记录。';
    if (filtered.length === 0) return '当前筛选条件下没有匹配结果。';
    return '';
  }, [filtered.length, items.length, loading]);

  return (
    <div className="mt-4 overflow-hidden rounded-3xl border border-neutral-200/80 bg-white/70 dark:border-neutral-700/80 dark:bg-neutral-900/50">
      {emptyText ? (
        <div className="px-4 py-8 text-sm text-neutral-500 dark:text-neutral-400">{emptyText}</div>
      ) : (
        <div>
          <div className="hidden border-b border-neutral-200/80 px-4 py-2.5 text-[11px] font-medium text-neutral-500 dark:border-neutral-700/80 dark:text-neutral-400 md:grid md:grid-cols-[minmax(0,1fr)_110px_90px_90px_180px_auto] md:items-center">
            <span>文件名</span>
            <span>大小</span>
            <span>耗时</span>
            <span>状态</span>
            <span>完成时间</span>
            <span className="text-right">操作</span>
          </div>
          {filtered.map((item) => (
            <HistoryFileItem key={item.id} item={item} onRequestRemove={onRequestRemoveItem} />
          ))}
        </div>
      )}

      <div className="border-t border-neutral-200/80 px-4 py-4 dark:border-neutral-700/80">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500 dark:text-neutral-400">
          <span>本页匹配 {filtered.length} / {items.length}</span>
          <span>总计 {pagination.totalCount} 条</span>
        </div>
        <Pagination
          page={pagination.page}
          pageSize={pagination.pageSize}
          totalCount={pagination.totalCount}
          totalPages={pagination.totalPages}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      </div>
    </div>
  );
}

