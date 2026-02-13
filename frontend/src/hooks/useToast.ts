import { useCallback } from 'react';
import { toast } from '@heroui/react';

export type ToastType = 'success' | 'error' | 'info';

export interface PushToastOptions {
  type?: ToastType;
  title?: string;
  message: string;
  durationMs?: number;
}

/**
 * 统一 Toast 工具（基于 HeroUI Toast）
 */
export function useToast() {
  const pushToast = useCallback(({ type = 'info', title, message, durationMs = 3000 }: PushToastOptions) => {
    const content = title || message;
    const options = {
      description: title ? message : undefined,
      timeout: durationMs,
    };

    if (type === 'success') {
      return toast.success(content, options);
    }
    if (type === 'error') {
      return toast.danger(content, options);
    }
    return toast.info(content, options);
  }, []);
  return { pushToast };
}
