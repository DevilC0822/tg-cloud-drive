import { ChevronLeft, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Button } from './Button';

function cn(...inputs: (string | undefined | null | boolean)[]) {
  return twMerge(clsx(inputs));
}

export interface PaginationProps {
  page: number; // 从 1 开始
  pageSize: number;
  totalCount: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

/**
 * 简单分页条（前端本地分页）
 */
export function Pagination({
  page,
  pageSize,
  totalCount,
  totalPages,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [20, 50, 100],
  className,
}: PaginationProps) {
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <div className={cn('flex items-center justify-between gap-4', className)}>
      <div className="text-xs text-neutral-500 dark:text-neutral-400">
        共 {totalCount} 项
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={!canPrev}
          onClick={() => onPageChange(page - 1)}
          icon={<ChevronLeft className="w-4 h-4" />}
        >
          上一页
        </Button>
        <div className="text-xs text-neutral-600 dark:text-neutral-300 min-w-[5.5rem] text-center">
          {page} / {totalPages}
        </div>
        <Button
          variant="ghost"
          size="sm"
          disabled={!canNext}
          onClick={() => onPageChange(page + 1)}
          iconPosition="right"
          icon={<ChevronRight className="w-4 h-4" />}
        >
          下一页
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-neutral-500 dark:text-neutral-400">每页</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
          className={cn(
            'text-xs rounded-lg px-2 py-1',
            'bg-white dark:bg-neutral-900',
            'border border-neutral-200 dark:border-neutral-700',
            'text-neutral-700 dark:text-neutral-200',
            'focus:outline-none focus:ring-2 focus:ring-[#D4AF37]'
          )}
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

