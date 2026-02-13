import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Input as HeroInput } from '@heroui/react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  rightIcon?: React.ReactNode;
}

function cn(...inputs: Parameters<typeof clsx>) {
  return twMerge(clsx(inputs));
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, rightIcon, id, type, autoComplete, ...props }, ref) => {
    const autoId = useId();
    const inputId = id || autoId;
    const resolvedType = type || 'text';
    const resolvedAutoComplete = autoComplete || (resolvedType === 'password' ? 'new-password' : 'off');

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-200">
            {label}
          </label>
        )}
        <div className="relative">
          <HeroInput
            ref={ref}
            id={inputId}
            type={resolvedType}
            autoComplete={resolvedAutoComplete}
            data-form-type="other"
            className={cn(
              'w-full rounded-xl border bg-white/96 dark:bg-neutral-900/90',
              'px-4 py-2.5 text-sm',
              'text-neutral-900 dark:text-neutral-100',
              'placeholder:text-neutral-400 dark:placeholder:text-neutral-500',
              'shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] transition-[border-color,box-shadow,background-color] duration-200',
              'focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:outline-none',
              rightIcon && 'pr-10',
              error
                ? 'border-red-300 focus-visible:border-red-500 focus-visible:ring-red-500 dark:border-red-700'
                : 'border-neutral-200 focus-visible:border-[var(--theme-primary)] focus-visible:ring-[var(--theme-primary)] dark:border-neutral-700',
              className,
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute top-1/2 right-3 -translate-y-1/2 text-neutral-400 dark:text-neutral-500">
              {rightIcon}
            </div>
          )}
        </div>
        {error && <p className="mt-1.5 text-sm text-red-500">{error}</p>}
      </div>
    );
  },
);

Input.displayName = 'Input';
