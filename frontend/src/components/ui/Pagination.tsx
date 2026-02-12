import { ChevronLeft, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Label as HeroLabel, ListBox as HeroListBox, Select as HeroSelect } from '@heroui/react';
import { ActionTextButton } from '@/components/ui/HeroActionPrimitives';

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
  const start = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(totalCount, page * pageSize);

  return (
    <div className={cn('flex flex-col gap-3 md:flex-row md:items-center md:justify-between', className)}>
      <div className="text-xs text-neutral-500 dark:text-neutral-400">
        显示 {start}-{end} / 共 {totalCount} 项
      </div>

      <div className="flex items-center gap-2">
        <ActionTextButton
          density="compact"
          isDisabled={!canPrev}
          onPress={() => onPageChange(page - 1)}
          leadingIcon={<ChevronLeft className="h-4 w-4" />}
        >
          上一页
        </ActionTextButton>
        <div className="min-w-[5.5rem] text-center text-xs text-neutral-600 dark:text-neutral-300">
          第 {page} / {totalPages} 页
        </div>
        <ActionTextButton
          density="compact"
          isDisabled={!canNext}
          onPress={() => onPageChange(page + 1)}
          trailingIcon={<ChevronRight className="h-4 w-4" />}
        >
          下一页
        </ActionTextButton>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-neutral-500 dark:text-neutral-400">每页</span>
        <HeroSelect
          aria-label="每页数量"
          value={String(pageSize)}
          onChange={(value) => onPageSizeChange?.(Number(value))}
          variant="secondary"
          className="min-w-[90px]"
        >
          <HeroSelect.Trigger
            className={cn(
              'w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs text-neutral-700',
              'dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200'
            )}
          >
            <HeroSelect.Value />
            <HeroSelect.Indicator />
          </HeroSelect.Trigger>
          <HeroSelect.Popover className="min-w-[var(--trigger-width)]">
            <HeroListBox>
              {pageSizeOptions.map((size) => (
                <HeroListBox.Item key={size} id={String(size)} textValue={String(size)}>
                  <HeroLabel>{size}</HeroLabel>
                  <HeroListBox.ItemIndicator />
                </HeroListBox.Item>
              ))}
            </HeroListBox>
          </HeroSelect.Popover>
        </HeroSelect>
      </div>
    </div>
  );
}
