import { ChevronRight, Home } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Breadcrumbs as HeroBreadcrumbs } from '@heroui/react';
import type { BreadcrumbItem } from '@/types';

function cn(...inputs: (string | undefined | null | boolean)[]) {
  return twMerge(clsx(inputs));
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  onNavigate: (item: BreadcrumbItem) => void;
}

export function Breadcrumb({ items, onNavigate }: BreadcrumbProps) {
  return (
    <HeroBreadcrumbs
      separator={<ChevronRight className="h-4 w-4 text-neutral-400 dark:text-neutral-500" />}
      className="text-sm"
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const isFirst = index === 0;

        return (
          <HeroBreadcrumbs.Item
            key={item.id}
            isDisabled={isLast}
            onPress={() => onNavigate(item)}
            className={cn(
              'rounded-lg px-2 py-1 transition-colors',
              isLast
                ? 'font-medium text-neutral-900 dark:text-neutral-100'
                : 'text-neutral-500 data-[hovered=true]:text-neutral-900 dark:text-neutral-400 dark:data-[hovered=true]:text-neutral-100',
            )}
          >
            <span aria-current={isLast ? 'page' : undefined} className="inline-flex min-w-0 items-center gap-1.5">
              {isFirst ? <Home className="h-4 w-4" /> : null}
              <span className="inline-block max-w-[120px] truncate">{item.name}</span>
            </span>
          </HeroBreadcrumbs.Item>
        );
      })}
    </HeroBreadcrumbs>
  );
}
