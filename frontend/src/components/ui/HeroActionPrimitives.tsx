import { type ComponentProps, type ReactNode } from 'react';
import { Button as HeroButton } from '@heroui/react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Modal } from '@/components/ui/Modal';

function cn(...inputs: (string | undefined | null | boolean)[]) {
  return twMerge(clsx(inputs));
}

export type ActionTone = 'neutral' | 'brand' | 'danger' | 'success' | 'warning';
type ActionSurface = 'light' | 'dark';
type ActionDensity = 'compact' | 'cozy';

type HeroButtonProps = ComponentProps<typeof HeroButton>;

export interface ActionIconButtonProps extends Omit<
  HeroButtonProps,
  'children' | 'onPress' | 'isIconOnly' | 'size' | 'variant' | 'className'
> {
  icon: ReactNode;
  label: string;
  tone?: ActionTone;
  surface?: ActionSurface;
  density?: ActionDensity;
  onPress?: () => void;
  className?: string;
}

export function ActionIconButton({
  icon,
  label,
  tone = 'neutral',
  surface = 'light',
  density = 'compact',
  onPress,
  className,
  ...props
}: ActionIconButtonProps) {
  const densityClassName = {
    compact: 'h-8 w-8 min-h-8 min-w-8',
    cozy: 'h-9 w-9 min-h-9 min-w-9',
  };

  const surfaceClassName = {
    light: cn(
      'border border-neutral-200/75 bg-white/50 text-neutral-600',
      'dark:border-neutral-700/80 dark:bg-neutral-900/40 dark:text-neutral-300',
      'data-[hovered=true]:border-neutral-300/80 data-[hovered=true]:bg-neutral-100/85',
      'dark:data-[hovered=true]:border-neutral-600/80 dark:data-[hovered=true]:bg-neutral-800/85',
      'data-[pressed=true]:bg-neutral-200/85 dark:data-[pressed=true]:bg-neutral-700/85',
    ),
    dark: cn(
      'border border-white/15 text-white/90',
      'bg-white/8 data-[hovered=true]:bg-white/14',
      'data-[pressed=true]:bg-white/20',
    ),
  };

  const toneClassName: Record<ActionTone, string> = {
    neutral: '',
    brand:
      surface === 'dark'
        ? 'text-[var(--theme-primary-soft-hover)]'
        : 'text-[var(--theme-primary-ink)] dark:text-[var(--theme-primary-soft-hover)]',
    danger: 'text-red-500 dark:text-red-400',
    success: 'text-emerald-500 dark:text-emerald-400',
    warning: 'text-orange-500 dark:text-orange-400',
  };

  return (
    <HeroButton
      isIconOnly
      size="sm"
      variant="tertiary"
      aria-label={label}
      onPress={onPress}
      className={cn(
        'rounded-xl transition-[background-color,border-color,color,box-shadow] duration-200',
        'focus-visible:ring-2 focus-visible:ring-[var(--theme-primary-a55)]',
        densityClassName[density],
        surfaceClassName[surface],
        toneClassName[tone],
        className,
      )}
      {...props}
    >
      {icon}
    </HeroButton>
  );
}

export interface ActionTextButtonProps extends Omit<HeroButtonProps, 'onPress' | 'size' | 'variant' | 'className'> {
  children: ReactNode;
  tone?: ActionTone;
  density?: ActionDensity;
  active?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  onPress?: () => void;
  className?: string;
}

export function ActionTextButton({
  children,
  tone = 'neutral',
  density = 'compact',
  active = false,
  leadingIcon,
  trailingIcon,
  onPress,
  className,
  ...props
}: ActionTextButtonProps) {
  const densityClassName = {
    compact: 'h-8 px-2.5 text-xs',
    cozy: 'h-9 px-3 text-sm',
  };

  const baseClassName =
    'border border-neutral-200/75 bg-white/46 text-neutral-600 dark:border-neutral-700/80 dark:bg-neutral-900/38 dark:text-neutral-300 data-[hovered=true]:border-neutral-300/80 data-[hovered=true]:bg-neutral-100/85 dark:data-[hovered=true]:border-neutral-600/80 dark:data-[hovered=true]:bg-neutral-800/82 data-[pressed=true]:bg-neutral-200/85 dark:data-[pressed=true]:bg-neutral-700/86';

  const toneClassName: Record<ActionTone, { idle: string; active: string }> = {
    neutral: {
      idle: '',
      active:
        'border-neutral-300/80 bg-neutral-100 text-neutral-900 dark:border-neutral-600/80 dark:bg-neutral-800 dark:text-white',
    },
    brand: {
      idle: 'text-[var(--theme-primary-ink)] dark:text-[var(--theme-primary-soft-hover)]',
      active:
        'border-[var(--theme-primary-a35)] bg-[var(--theme-primary-a16)] text-[var(--theme-primary-ink-strong)] dark:border-[var(--theme-primary-a35)] dark:bg-[var(--theme-primary-a20)] dark:text-[var(--theme-primary-soft)]',
    },
    danger: {
      idle: 'text-red-500 dark:text-red-400',
      active: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-900/30 dark:text-red-300',
    },
    success: {
      idle: 'text-emerald-500 dark:text-emerald-400',
      active:
        'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-900/30 dark:text-emerald-300',
    },
    warning: {
      idle: 'text-orange-500 dark:text-orange-400',
      active:
        'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/60 dark:bg-orange-900/30 dark:text-orange-300',
    },
  };

  const stateClassName = active ? toneClassName[tone].active : toneClassName[tone].idle;

  return (
    <HeroButton
      size="sm"
      variant="tertiary"
      onPress={onPress}
      className={cn(
        'rounded-xl font-medium tracking-[0.01em] transition-[background-color,border-color,color,box-shadow] duration-200',
        'focus-visible:ring-2 focus-visible:ring-[var(--theme-primary-a55)]',
        densityClassName[density],
        baseClassName,
        stateClassName,
        className,
      )}
      {...props}
    >
      {leadingIcon ? <span className="inline-flex h-4 w-4 items-center justify-center">{leadingIcon}</span> : null}
      <span>{children}</span>
      {trailingIcon ? <span className="inline-flex h-4 w-4 items-center justify-center">{trailingIcon}</span> : null}
    </HeroButton>
  );
}

export interface ActionStatusPillProps {
  children: ReactNode;
  tone?: ActionTone;
  className?: string;
}

export function ActionStatusPill({ children, tone = 'neutral', className }: ActionStatusPillProps) {
  const toneClassName: Record<ActionTone, string> = {
    neutral: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800/80 dark:text-neutral-300',
    brand:
      'bg-[var(--theme-primary-a20)] text-[var(--theme-primary-ink-strong)] dark:border-[var(--theme-primary-a35)] dark:text-[var(--theme-primary-soft)]',
    danger: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    warning: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border border-transparent px-2.5 py-1 text-[11px] font-medium',
        toneClassName[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export interface DangerActionConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmText?: string;
  onClose: () => void;
  onConfirm: () => void;
}

export function DangerActionConfirmModal({
  open,
  title,
  description,
  confirmText = '确认继续',
  onClose,
  onConfirm,
}: DangerActionConfirmModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <ActionTextButton onPress={onClose} className="min-w-[96px] justify-center">
            取消
          </ActionTextButton>
          <ActionTextButton tone="danger" onPress={onConfirm} className="min-w-[120px] justify-center">
            {confirmText}
          </ActionTextButton>
        </>
      }
    >
      <div className="rounded-xl border border-red-200 bg-red-50/80 p-3 text-sm leading-relaxed text-red-700 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-300">
        该操作不可恢复，请确认后继续。
      </div>
    </Modal>
  );
}
