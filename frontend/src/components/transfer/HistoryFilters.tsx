import type { HistoryFilter } from '@/hooks/useTransferCenter';
import type { HistoryStatusFilter } from '@/components/transfer/transferHistoryTypes';
import { ActionTextButton } from '@/components/ui/HeroActionPrimitives';
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
 * 文件历史筛选条：方向 + 状态 + 搜索（与页头同一输入）
 */
export function HistoryFilters({
  direction,
  onDirectionChange,
  status,
  onStatusChange,
  query,
  onQueryChange,
}: HistoryFiltersProps) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-neutral-200/80 bg-white/70 p-1.5 dark:border-neutral-700/80 dark:bg-neutral-900/50">
          <ActionTextButton active={direction === 'all'} onPress={() => onDirectionChange('all')} className="justify-center">
            全部
          </ActionTextButton>
          <ActionTextButton active={direction === 'upload'} onPress={() => onDirectionChange('upload')} className="justify-center">
            上传
          </ActionTextButton>
          <ActionTextButton active={direction === 'download'} onPress={() => onDirectionChange('download')} className="justify-center">
            下载
          </ActionTextButton>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-neutral-200/80 bg-white/70 p-1.5 dark:border-neutral-700/80 dark:bg-neutral-900/50">
          <ActionTextButton active={status === 'all'} onPress={() => onStatusChange('all')} className="justify-center">
            全部
          </ActionTextButton>
          <ActionTextButton active={status === 'completed'} onPress={() => onStatusChange('completed')} className="justify-center">
            完成
          </ActionTextButton>
          <ActionTextButton active={status === 'error'} onPress={() => onStatusChange('error')} className="justify-center">
            失败
          </ActionTextButton>
          <ActionTextButton active={status === 'canceled'} onPress={() => onStatusChange('canceled')} className="justify-center">
            取消
          </ActionTextButton>
        </div>
      </div>

      <TransferSearchField
        value={query}
        onValueChange={onQueryChange}
        placeholder="搜索文件名…"
        className="w-full md:w-[360px]"
      />
    </div>
  );
}

