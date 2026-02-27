import { ArrowDownToLine, ArrowUpFromLine, Clock3, Trash2 } from 'lucide-react';
import type { TransferHistoryItem } from '@/types';
import { formatDateTime, formatFileSize } from '@/utils/formatters';
import { ActionIconButton } from '@/components/ui/HeroActionPrimitives';
import {
  formatDurationShort,
  historyDirectionLabel,
  historyStatusColor,
  historyStatusLabel,
} from '@/components/transfer/transferUtils';

export interface HistoryFileItemProps {
  item: TransferHistoryItem;
  onRequestRemove: (id: string, name: string) => void;
}

function directionIcon(direction: TransferHistoryItem['direction']) {
  return direction === 'upload' ? (
    <ArrowUpFromLine className="h-4 w-4 text-[var(--theme-primary-ink)] dark:text-[var(--theme-primary-soft)]" />
  ) : (
    <ArrowDownToLine className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
  );
}

export function HistoryFileItem({ item, onRequestRemove }: HistoryFileItemProps) {
  const duration = item.finishedAt - item.startedAt;
  const finishedAtText = formatDateTime(new Date(item.finishedAt));

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-t border-neutral-200/80 px-4 py-3 first:border-t-0 md:grid-cols-[minmax(0,1fr)_110px_90px_90px_180px_auto] md:items-center dark:border-neutral-700/80">
      <div className="min-w-0">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 shrink-0">{directionIcon(item.direction)}</span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">{item.fileName}</div>
            {item.error ? (
              <div className="mt-1 truncate text-xs text-red-600 dark:text-red-300">{item.error}</div>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center gap-1.5 md:hidden">
              <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                {historyDirectionLabel(item.direction)}
              </span>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${historyStatusColor(item.status)}`}
              >
                {historyStatusLabel(item.status)}
              </span>
              <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                {formatFileSize(item.size)}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-neutral-500 md:hidden dark:text-neutral-400">
              <span className="inline-flex items-center gap-1">
                <Clock3 className="h-3.5 w-3.5" />
                {finishedAtText}
              </span>
              <span>·</span>
              <span>耗时 {formatDurationShort(duration)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="hidden text-xs text-neutral-700 md:block dark:text-neutral-200">{formatFileSize(item.size)}</div>
      <div className="hidden text-xs text-neutral-700 md:block dark:text-neutral-200">
        {formatDurationShort(duration)}
      </div>
      <div className="hidden md:block">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${historyStatusColor(item.status)}`}
        >
          {historyStatusLabel(item.status)}
        </span>
      </div>
      <div className="hidden text-xs text-neutral-500 md:block dark:text-neutral-400">{finishedAtText}</div>

      <ActionIconButton
        icon={<Trash2 className="h-4 w-4" />}
        label="删除记录"
        tone="danger"
        onPress={() => onRequestRemove(item.id, item.fileName)}
        className="border border-neutral-200/80 dark:border-neutral-700/80"
      />
    </div>
  );
}
