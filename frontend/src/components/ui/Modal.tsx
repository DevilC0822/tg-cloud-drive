import { type ReactNode } from 'react';
import { X } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Modal as HeroModal } from '@heroui/react';

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
  if (!open) return null;

  const sizes = {
    sm: 'sm:max-w-sm',
    md: 'sm:max-w-md',
    lg: 'sm:max-w-lg',
    xl: 'sm:max-w-xl',
    '2xl': 'sm:max-w-2xl',
    '3xl': 'sm:max-w-3xl',
  };

  return (
    <HeroModal>
      <HeroModal.Backdrop
        isOpen={open}
        onOpenChange={(isOpen) => {
          if (!isOpen) onClose();
        }}
        isDismissable={closeOnOverlayClick}
        isKeyboardDismissDisabled={!closeOnEscape}
        variant="blur"
        className="modal-backdrop-motion"
      >
        <HeroModal.Container placement="auto" scroll={scroll} className="px-4">
          <HeroModal.Dialog
            className={cn(
              'modal-dialog-motion w-full overflow-hidden rounded-3xl border border-neutral-200/80 bg-[linear-gradient(160deg,rgba(255,255,255,0.98),rgba(250,248,245,0.96))] shadow-[0_28px_72px_-38px_rgba(15,23,42,0.72)]',
              'dark:border-neutral-700/80 dark:bg-[linear-gradient(160deg,rgba(23,23,23,0.96),rgba(15,23,42,0.94))]',
              sizes[size],
            )}
          >
            {showCloseButton ? (
              <HeroModal.CloseTrigger
                className={cn(
                  'absolute top-5 right-5 z-20 rounded-full bg-transparent p-2',
                  'text-neutral-500 transition-colors duration-200 hover:bg-[var(--theme-primary-a12)] hover:text-neutral-700',
                  'focus-visible:ring-2 focus-visible:ring-[var(--theme-primary-a24)] focus-visible:outline-none',
                  'dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-neutral-200',
                )}
              >
                <X className="h-5 w-5" />
              </HeroModal.CloseTrigger>
            ) : null}

            {(title || description) && (
              <HeroModal.Header className="mx-4 mt-4 rounded-2xl border border-[var(--theme-primary-a24)] bg-[linear-gradient(132deg,var(--theme-primary-a20),var(--theme-primary-a08))] px-5 py-4 pr-14 dark:border-[var(--theme-primary-a20)] dark:bg-[linear-gradient(132deg,var(--theme-primary-a24),rgba(15,23,42,0.35))]">
                <div>
                  {title ? (
                    <HeroModal.Heading className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                      {title}
                    </HeroModal.Heading>
                  ) : null}
                  {description ? (
                    <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{description}</p>
                  ) : null}
                </div>
              </HeroModal.Header>
            )}

            <HeroModal.Body className="p-5 sm:p-6">{children}</HeroModal.Body>

            {footer ? (
              <HeroModal.Footer className="flex items-center justify-end gap-3 border-t border-neutral-200/70 px-5 pt-4 pb-5 dark:border-neutral-700/70">
                {footer}
              </HeroModal.Footer>
            ) : null}
          </HeroModal.Dialog>
        </HeroModal.Container>
      </HeroModal.Backdrop>
    </HeroModal>
  );
}
