import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface ProgressBarProps {
  value: number; // 0-100
  size?: 'sm' | 'md' | 'lg';
  color?: 'default' | 'gold' | 'success' | 'warning' | 'danger';
  className?: string;
}

function cn(...inputs: (string | undefined | null | boolean)[]) {
  return twMerge(clsx(inputs));
}

export function ProgressBar({ value, size = 'md', color = 'default', className }: ProgressBarProps) {
  const clampedValue = Math.min(100, Math.max(0, value));

  const sizes = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  const colors = {
    default: 'bg-neutral-900 dark:bg-neutral-100',
    gold: 'bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-primary-strong)]',
    success: 'bg-gradient-to-r from-emerald-500 to-emerald-400',
    warning: 'bg-gradient-to-r from-orange-500 to-orange-500',
    danger: 'bg-gradient-to-r from-red-600 to-red-500',
  };

  return (
    <div className={cn('w-full', className)}>
      <div className={cn('w-full overflow-hidden rounded-full bg-neutral-200/90 dark:bg-neutral-700/85', sizes[size])}>
        <div
          className={cn(
            'h-full rounded-full shadow-[0_4px_12px_-8px_rgba(15,23,42,0.7)] transition-all duration-300 ease-out',
            colors[color],
          )}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
    </div>
  );
}
