import { atom } from 'jotai';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  createdAt: number;
  durationMs: number;
}

export const toastsAtom = atom<ToastItem[]>([]);

