import { atom } from 'jotai';
import type { DownloadTask, TransferHistoryItem } from '@/types';

export const transferHistoryLimit = 300;

/* 下载任务（当前会话） */
export const downloadTasksAtom = atom<DownloadTask[]>([]);

/* 传输历史（后端持久化） */
export const transferHistoryAtom = atom<TransferHistoryItem[]>([]);

/* 活跃下载任务数 */
export const activeDownloadsCountAtom = atom((get) => {
  const tasks = get(downloadTasksAtom);
  return tasks.filter((task) => task.status === 'pending' || task.status === 'downloading').length;
});
