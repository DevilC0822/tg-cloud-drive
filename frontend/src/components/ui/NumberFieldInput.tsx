import { useId } from 'react';
import { NumberField as HeroNumberField } from '@heroui/react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface NumberFieldInputProps {
  hint?: string;
  value: string;
  onValueChange: (value: string) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  className?: string;
}

function cn(...inputs: Parameters<typeof clsx>) {
  return twMerge(clsx(inputs));
}

export function NumberFieldInput({
  hint,
  value,
  onValueChange,
  min,
  max,
  step,
  placeholder,
  className,
}: NumberFieldInputProps) {
  const inputId = useId();
  const parsedValue = Number(value);
  const safeValue = Number.isFinite(parsedValue) ? parsedValue : Number.isFinite(min) ? Number(min) : 0;

  return (
    <div className={cn('w-full', className)}>
      <HeroNumberField
        value={safeValue}
        onChange={(next) => {
          if (Number.isFinite(next)) {
            onValueChange(String(next));
            return;
          }
          onValueChange('');
        }}
        minValue={min}
        maxValue={max}
        step={step}
        variant="secondary"
        fullWidth
      >
        <HeroNumberField.Group
          className={cn(
            'w-full rounded-xl border bg-white/96 dark:bg-neutral-900/90',
            'transition-[border-color,box-shadow,background-color] duration-200',
            'border-neutral-200 dark:border-neutral-700',
          )}
        >
          <HeroNumberField.Input
            id={inputId}
            autoComplete="off"
            placeholder={placeholder}
            className={cn(
              'w-full bg-transparent px-4 py-2.5 text-sm',
              'text-neutral-900 dark:text-neutral-100',
              'placeholder:text-neutral-400 dark:placeholder:text-neutral-500',
              'focus-visible:ring-0 focus-visible:outline-none',
            )}
          />
        </HeroNumberField.Group>
      </HeroNumberField>

      {hint ? <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">{hint}</p> : null}
    </div>
  );
}
