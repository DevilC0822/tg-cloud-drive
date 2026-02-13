import { Search, X } from 'lucide-react';

export interface TransferSearchFieldProps {
  value: string;
  onValueChange: (next: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * 传输中心统一搜索框（用于全局过滤：活跃任务 + 历史）
 */
export function TransferSearchField({
  value,
  onValueChange,
  placeholder = '搜索任务 / 历史…',
  className,
}: TransferSearchFieldProps) {
  return (
    <div className={className}>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-neutral-400 dark:text-neutral-500" />
        <input
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-2xl border border-neutral-200/80 bg-white/90 py-2.5 pr-10 pl-10 text-sm text-neutral-900 shadow-[0_12px_26px_-22px_rgba(15,23,42,0.55)] outline-none transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-neutral-400 focus:border-[var(--theme-primary-a55)] focus:shadow-[0_18px_44px_-26px_rgba(244,164,141,0.55)] dark:border-neutral-700/80 dark:bg-neutral-900/70 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-[var(--theme-primary-a35)]"
        />
        {value.trim().length > 0 ? (
          <button
            type="button"
            onClick={() => onValueChange('')}
            aria-label="清空搜索"
            className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer rounded-xl border border-neutral-200/80 bg-white/70 p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 dark:border-neutral-700/80 dark:bg-neutral-900/60 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
