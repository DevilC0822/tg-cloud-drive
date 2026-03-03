import { ChevronLeft, ChevronRight, Hash } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Label as HeroLabel, ListBox as HeroListBox, Select as HeroSelect } from '@heroui/react';
import { ActionIconButton } from '@/components/ui/HeroActionPrimitives';
import { motion, AnimatePresence } from 'framer-motion';
import { gentleSpring } from '@/utils/animations';

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
 * 响应式高级分页器
 * 针对移动端优化了布局，并添加了平滑的数值切换动画
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
    <div className={cn('flex flex-col items-center gap-4 sm:flex-row sm:justify-between', className)}>
      {/* 状态信息：胶囊样式展示 */}
      <div className="flex items-center gap-3 rounded-full border border-neutral-200/60 bg-white/50 px-4 py-1.5 dark:border-white/5 dark:bg-white/5 shadow-sm">
        <Hash className="h-3 w-3 text-neutral-400" />
        <span className="text-[11px] font-bold tracking-tight text-neutral-600 dark:text-neutral-400">
          <span className="text-neutral-900 dark:text-neutral-100">{start}-{end}</span>
          <span className="mx-1.5 opacity-40">/</span>
          <span>{totalCount}</span>
        </span>
      </div>

      {/* 翻页控制：居中浮动设计 */}
      <div className="flex items-center gap-1.5 rounded-2xl border border-neutral-200/80 bg-neutral-50/50 p-1.5 dark:border-white/5 dark:bg-white/5 shadow-inner">
        <ActionIconButton
          icon={<ChevronLeft className="h-4 w-4" />}
          label="上一页"
          isDisabled={!canPrev}
          onPress={() => onPageChange(page - 1)}
          className="h-9 w-9 rounded-xl bg-white shadow-sm dark:bg-neutral-800"
        />
        
        <div className="relative flex h-9 items-center justify-center overflow-hidden px-4 min-w-[100px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={page}
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -10, opacity: 0 }}
              transition={gentleSpring}
              className="flex items-center gap-1.5"
            >
              <span className="text-xs font-black text-neutral-900 dark:text-neutral-100">{page}</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">/ {totalPages}</span>
            </motion.div>
          </AnimatePresence>
        </div>

        <ActionIconButton
          icon={<ChevronRight className="h-4 w-4" />}
          label="下一页"
          isDisabled={!canNext}
          onPress={() => onPageChange(page + 1)}
          className="h-9 w-9 rounded-xl bg-white shadow-sm dark:bg-neutral-800"
        />
      </div>

      {/* 每页数量：精简选择器 */}
      {onPageSizeChange && (
        <div className="flex items-center gap-2">
          <HeroSelect
            aria-label="每页数量"
            value={String(pageSize)}
            onChange={(value) => onPageSizeChange?.(Number(value))}
            className="min-w-[80px]"
          >
            <HeroSelect.Trigger
              className={cn(
                'flex h-8 items-center justify-between rounded-xl border border-neutral-200 bg-white/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-600',
                'dark:border-white/10 dark:bg-neutral-900/80 dark:text-neutral-400 hover:bg-white dark:hover:bg-neutral-800 transition-colors',
              )}
            >
              <HeroSelect.Value />
              <span className="ml-1 opacity-50">ITEMS</span>
              <HeroSelect.Indicator className="ml-1" />
            </HeroSelect.Trigger>
            <HeroSelect.Popover className="min-w-[var(--trigger-width)]">
              <HeroListBox>
                {pageSizeOptions.map((size) => (
                  <HeroListBox.Item key={size} id={String(size)} textValue={String(size)}>
                    <HeroLabel className="text-xs font-bold">{size}</HeroLabel>
                    <HeroListBox.ItemIndicator />
                  </HeroListBox.Item>
                ))}
              </HeroListBox>
            </HeroSelect.Popover>
          </HeroSelect>
        </div>
      )}
    </div>
  );
}
