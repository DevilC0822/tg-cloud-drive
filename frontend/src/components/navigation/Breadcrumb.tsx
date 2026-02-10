import { ChevronRight, Home } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { BreadcrumbItem } from '@/types';

function cn(...inputs: (string | undefined | null | boolean)[]) {
  return twMerge(clsx(inputs));
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  onNavigate: (item: BreadcrumbItem) => void;
  className?: string;
}

export function Breadcrumb({ items, onNavigate, className }: BreadcrumbProps) {
  return (
    <nav className={cn('flex items-center gap-1 text-sm', className)}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const isFirst = index === 0;

        return (
          <div key={item.id} className="flex items-center gap-1">
            {index > 0 && (
              <ChevronRight className="w-4 h-4 text-neutral-400 dark:text-neutral-500 flex-shrink-0" />
            )}
            <button
              onClick={() => !isLast && onNavigate(item)}
              disabled={isLast}
              className={cn(
                'flex items-center gap-1.5 px-2 py-1 rounded-lg',
                'transition-colors duration-200',
                isLast
                  ? 'text-neutral-900 dark:text-neutral-100 font-medium cursor-default'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              )}
            >
              {isFirst && <Home className="w-4 h-4" />}
              <span className="max-w-[120px] truncate">{item.name}</span>
            </button>
          </div>
        );
      })}
    </nav>
  );
}
