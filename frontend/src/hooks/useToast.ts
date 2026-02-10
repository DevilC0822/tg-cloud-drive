import { useCallback } from 'react';
import { useSetAtom } from 'jotai';
import { toastsAtom, type ToastItem, type ToastType } from '@/stores/toastAtoms';
import { generateId } from '@/utils/fileUtils';

export interface PushToastOptions {
  type?: ToastType;
  title?: string;
  message: string;
  durationMs?: number;
}

/**
 * 轻量 Toast 工具（不依赖第三方库）
 */
export function useToast() {
  const setToasts = useSetAtom(toastsAtom);

  const pushToast = useCallback(
    ({ type = 'info', title, message, durationMs = 3000 }: PushToastOptions) => {
      const item: ToastItem = {
        id: generateId(),
        type,
        title,
        message,
        createdAt: Date.now(),
        durationMs,
      };

      setToasts((prev) => [...prev, item]);
      return item.id;
    },
    [setToasts]
  );

  const removeToast = useCallback(
    (id: string) => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    },
    [setToasts]
  );

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, [setToasts]);

  return { pushToast, removeToast, clearToasts };
}

