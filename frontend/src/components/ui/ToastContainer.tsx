import { useEffect } from 'react';
import { useAtomValue } from 'jotai';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { toastsAtom, type ToastItem, type ToastType } from '@/stores/toastAtoms';
import { useToast } from '@/hooks/useToast';

function cn(...inputs: (string | undefined | null | boolean)[]) {
  return twMerge(clsx(inputs));
}

function getToastIcon(type: ToastType) {
  switch (type) {
    case 'success':
      return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    case 'error':
      return <AlertTriangle className="w-4 h-4 text-red-500" />;
    default:
      return <Info className="w-4 h-4 text-[#D4AF37]" />;
  }
}

function ToastRow({ toast }: { toast: ToastItem }) {
  const { removeToast } = useToast();

  useEffect(() => {
    const timer = window.setTimeout(() => removeToast(toast.id), toast.durationMs);
    return () => window.clearTimeout(timer);
  }, [removeToast, toast.durationMs, toast.id]);

  return (
    <div
      className={cn(
        'glass-card',
        'px-4 py-3',
        'flex items-start gap-3',
        'min-w-[280px] max-w-[360px]',
        'animate-slideUp'
      )}
      role="status"
      aria-live="polite"
    >
      <div className="pt-0.5">{getToastIcon(toast.type)}</div>
      <div className="flex-1 min-w-0">
        {toast.title && (
          <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
            {toast.title}
          </div>
        )}
        <div className="text-sm text-neutral-600 dark:text-neutral-300 break-words">
          {toast.message}
        </div>
      </div>
      <button
        onClick={() => removeToast(toast.id)}
        className={cn(
          'p-1 rounded-lg',
          'text-neutral-400 hover:text-neutral-600',
          'dark:text-neutral-500 dark:hover:text-neutral-300',
          'hover:bg-neutral-100 dark:hover:bg-neutral-800'
        )}
        aria-label="关闭提示"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const toasts = useAtomValue(toastsAtom);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <ToastRow key={t.id} toast={t} />
      ))}
    </div>
  );
}

