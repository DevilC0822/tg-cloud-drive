import { Search } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { SearchField as HeroSearchField } from '@heroui/react';

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

function cn(...inputs: (string | undefined | null | boolean)[]) {
  return twMerge(clsx(inputs));
}

export function SearchBar({ value, onChange, placeholder = '搜索文件或文件夹' }: SearchBarProps) {
  return (
    <HeroSearchField
      value={value}
      onChange={onChange}
      aria-label={placeholder}
      variant="secondary"
      fullWidth
      className="w-full"
    >
      <HeroSearchField.Group
        className={cn(
          'w-full rounded-xl border border-neutral-200 bg-white/95 dark:border-neutral-700 dark:bg-neutral-900/80',
          'shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)]',
          'focus-within:border-[var(--theme-primary)] focus-within:ring-2 focus-within:ring-[var(--theme-primary)]',
          'transition-[background-color,border-color,box-shadow] duration-200',
        )}
      >
        <HeroSearchField.SearchIcon className="h-4 w-4 text-neutral-400 dark:text-neutral-500">
          <Search className="h-4 w-4" />
        </HeroSearchField.SearchIcon>
        <HeroSearchField.Input
          autoComplete="off"
          placeholder={placeholder}
          className={cn(
            'w-full bg-transparent py-2.5 text-sm text-neutral-900 dark:text-neutral-100',
            'placeholder:text-neutral-400 dark:placeholder:text-neutral-500',
            'focus-visible:outline-none',
          )}
        />
        <HeroSearchField.ClearButton
          aria-label="清空搜索"
          className={cn(
            'h-7 min-h-7 w-7 min-w-7 rounded-full',
            'text-neutral-400 dark:text-neutral-500',
            'data-[hovered=true]:bg-neutral-200 data-[hovered=true]:text-neutral-600',
            'dark:data-[hovered=true]:bg-neutral-700 dark:data-[hovered=true]:text-neutral-300',
          )}
        />
      </HeroSearchField.Group>
    </HeroSearchField>
  );
}
