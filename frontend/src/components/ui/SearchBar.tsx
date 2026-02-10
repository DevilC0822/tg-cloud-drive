import { Search, X } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

function cn(...inputs: (string | undefined | null | boolean)[]) {
  return twMerge(clsx(inputs));
}

export function SearchBar({
  value,
  onChange,
  placeholder = '搜索文件...',
  className,
}: SearchBarProps) {
  return (
    <div className={cn('relative', className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 dark:text-neutral-500" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        data-form-type="other"
        placeholder={placeholder}
        className={cn(
          'w-full pl-10 pr-10 py-2.5 text-sm',
          'bg-neutral-100 dark:bg-neutral-800',
          'text-neutral-900 dark:text-neutral-100',
          'border border-transparent',
          'rounded-xl',
          'placeholder:text-neutral-400 dark:placeholder:text-neutral-500',
          'focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent',
          'focus:bg-white dark:focus:bg-neutral-900',
          'transition-all duration-200'
        )}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className={cn(
            'absolute right-3 top-1/2 -translate-y-1/2',
            'p-0.5 rounded-full',
            'text-neutral-400 hover:text-neutral-600',
            'dark:text-neutral-500 dark:hover:text-neutral-300',
            'hover:bg-neutral-200 dark:hover:bg-neutral-700',
            'transition-colors duration-200'
          )}
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
