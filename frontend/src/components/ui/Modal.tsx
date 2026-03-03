import { type ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'framer-motion';
import { springTransition } from '@/utils/animations';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  scroll?: 'inside' | 'outside';
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
}

function cn(...inputs: (string | undefined | null | boolean)[]) {
  return twMerge(clsx(inputs));
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  scroll = 'inside',
  closeOnOverlayClick = true,
  closeOnEscape = true,
  showCloseButton = true,
}: ModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === 'Escape') {
        onClose();
      }
    };
    if (open) {
      window.addEventListener('keydown', handleEscape);
    }
    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [open, closeOnEscape, onClose]);

  const sizes = {
    sm: 'sm:max-w-sm',
    md: 'sm:max-w-md',
    lg: 'sm:max-w-lg',
    xl: 'sm:max-w-xl',
    '2xl': 'sm:max-w-2xl',
    '3xl': 'sm:max-w-3xl',
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-neutral-950/40 backdrop-blur-md"
            onClick={closeOnOverlayClick ? onClose : undefined}
          />

          {/* Dialog Container */}
          <div className={cn(
            'relative z-50 flex h-full w-full flex-col p-4 sm:h-auto',
            scroll === 'outside' ? 'overflow-y-auto' : 'overflow-hidden'
          )}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={springTransition}
              data-selection-preserve="true"
              className={cn(
                'relative mx-auto flex w-full flex-col overflow-hidden rounded-2xl border border-neutral-200/80 bg-white/95 shadow-2xl sm:rounded-3xl',
                'dark:border-neutral-700/80 dark:bg-neutral-900/98',
                sizes[size],
                scroll === 'inside' ? 'max-h-full' : 'h-auto'
              )}
            >
              {showCloseButton && (
                <button
                  onClick={onClose}
                  className={cn(
                    'absolute top-3.5 right-3.5 z-20 rounded-full bg-transparent p-2 sm:top-5 sm:right-5',
                    'text-neutral-500 transition-colors duration-200 hover:bg-[var(--theme-primary-a12)] hover:text-neutral-700',
                    'focus-visible:ring-2 focus-visible:ring-[var(--theme-primary-a24)] focus-visible:outline-none',
                    'dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-neutral-200',
                  )}
                >
                  <X className="h-5 w-5" />
                </button>
              )}

              {(title || description) && (
                <header className="mx-3 mt-3 shrink-0 rounded-2xl border border-[var(--theme-primary-a24)] bg-[linear-gradient(132deg,var(--theme-primary-a20),var(--theme-primary-a08))] px-4 py-3 pr-12 sm:mx-4 sm:mt-4 sm:px-5 sm:py-4 sm:pr-14 dark:border-[var(--theme-primary-a20)] dark:bg-[linear-gradient(132deg,var(--theme-primary-a24),rgba(15,23,42,0.35))]">
                  <div>
                    {title && (
                      <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                        {title}
                      </h2>
                    )}
                    {description && (
                      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{description}</p>
                    )}
                  </div>
                </header>
              )}

              <div className={cn(
                'p-3.5 sm:p-5',
                scroll === 'inside' ? 'overflow-y-auto' : ''
              )}>
                {children}
              </div>

              {footer && (
                <footer className="shrink-0 flex items-center justify-end gap-3 border-t border-neutral-200/70 px-3.5 pt-3 pb-3.5 sm:px-5 sm:pt-4 sm:pb-5 dark:border-neutral-700/70">
                  {footer}
                </footer>
              )}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
