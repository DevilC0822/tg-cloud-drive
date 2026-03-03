import type { HistoryFilter } from '@/hooks/useTransferCenter';
import type { HistoryStatusFilter } from '@/components/transfer/transferHistoryTypes';
import { TransferSearchField } from '@/components/transfer/TransferSearchField';

export interface HistoryFiltersProps {
  direction: HistoryFilter;
  onDirectionChange: (next: HistoryFilter) => void;
  status: HistoryStatusFilter;
  onStatusChange: (next: HistoryStatusFilter) => void;
  query: string;
  onQueryChange: (next: string) => void;
}

/**
 * 文件历史筛选条：仅保留搜索输入
 */
export function HistoryFilters({
  query,
  onQueryChange,
}: HistoryFiltersProps) {
  return (
    <div className="flex justify-end">
      <TransferSearchField
        value={query}
        onValueChange={onQueryChange}
        placeholder="搜索文件名…"
        className="w-full md:w-[360px]"
      />
    </div>
  );
}
