import { atom } from 'jotai';
import type { DownloadTask, TransferHistoryItem } from '@/types';

/* 下载任务（当前会话） */
export const downloadTasksAtom = atom<DownloadTask[]>([]);

/* 传输历史（后端持久化） */
export const transferHistoryAtom = atom<TransferHistoryItem[]>([]);
