import { ArrowDownToLine, ArrowUpFromLine, Clock3, Trash2, Timer } from 'lucide-react';
import type { TransferHistoryItem } from '@/types';
import { formatDateTime, formatFileSize } from '@/utils/formatters';
import { ActionIconButton } from '@/components/ui/HeroActionPrimitives';
import { motion } from 'framer-motion';
import {
  formatDurationShort,
  historyStatusColor,
  historyStatusLabel,
} from '@/components/transfer/transferUtils';
import { FILE_HISTORY_GRID } from './HistoryFileList';

export interface HistoryFileItemProps {
  item: TransferHistoryItem;
  onRequestRemove: (id: string, name: string) => void;
}

function directionStyles(direction: TransferHistoryItem['direction']) {
  return direction === 'upload' 
    ? {
        icon: <ArrowUpFromLine className="h-4 w-4" />,
        color: 'text-brand-500',
        bg: 'bg-brand-500/10',
        label: 'UPLOAD'
      }
    : {
        icon: <ArrowDownToLine className="h-4 w-4" />,
        color: 'text-emerald-500',
        bg: 'bg-emerald-500/10',
        label: 'DOWNLOAD'
      };
}

export function HistoryFileItem({ item, onRequestRemove }: HistoryFileItemProps) {
  const duration = item.finishedAt - item.startedAt;
  const finishedAtText = formatDateTime(new Date(item.finishedAt));
  const styles = directionStyles(item.direction);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`transfer-history-row group relative grid ${FILE_HISTORY_GRID} items-center gap-4 border-b border-neutral-200/60 px-4 py-4 md:px-6 dark:border-white/5 dark:bg-transparent`}
    >
      {/* 任务文件 */}
      <div className="flex min-w-0 items-center gap-4">
        <div className={`hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${styles.bg} ${styles.color} shadow-sm`}>
          {styles.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5 md:hidden">
            <span className={`text-[9px] font-black tracking-widest ${styles.color}`}>
              {styles.label}
            </span>
          </div>
          <h3 className="truncate text-sm font-bold tracking-tight text-neutral-900 dark:text-neutral-100" title={item.fileName}>
            {item.fileName}
          </h3>
          {item.error && (
            <p className="mt-1 truncate text-[11px] font-medium text-red-600/80 dark:text-red-400/80">
              {item.error}
            </p>
          )}
        </div>
      </div>

      {/* 容量 */}
      <div className="hidden md:block">
        <p className="font-mono text-xs font-bold text-neutral-700 dark:text-neutral-300">{formatFileSize(item.size)}</p>
      </div>
      
      {/* 耗时 */}
      <div className="hidden md:block">
        <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-neutral-700 dark:text-neutral-300">
          <Timer className="h-3 w-3 opacity-50" />
          {formatDurationShort(duration)}
        </div>
      </div>

      {/* 状态 */}
      <div className="hidden md:block">
        <span className={`inline-flex items-center text-[10px] font-black uppercase tracking-widest ${historyStatusColor(item.status)}`}>
          {historyStatusLabel(item.status)}
        </span>
      </div>

      {/* 完成时间 */}
      <div className="hidden md:block">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
          <Clock3 className="h-3 w-3 opacity-50" />
          {finishedAtText}
        </div>
      </div>

      {/* 移动端元数据整合 */}
      <div className="flex flex-col items-end gap-1 md:hidden">
        <p className="font-mono text-[11px] font-bold text-neutral-700 dark:text-neutral-300">{formatFileSize(item.size)}</p>
        <span className={`text-[9px] font-black uppercase tracking-widest ${historyStatusColor(item.status)}`}>
          {historyStatusLabel(item.status)}
        </span>
      </div>

      {/* 操作 */}
      <div className="flex items-center justify-end">
        <ActionIconButton
          icon={<Trash2 className="h-4 w-4" />}
          label="移除此记录"
          tone="danger"
          onPress={() => onRequestRemove(item.id, item.fileName)}
          className="h-9 w-9 rounded-xl border-none bg-neutral-100 hover:bg-red-500/10 hover:text-red-600 dark:bg-white/5 dark:hover:bg-red-500/20 shadow-none"
        />
      </div>
    </motion.div>
  );
}
