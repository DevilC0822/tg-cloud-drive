import { atom } from 'jotai';
import type { UploadTask } from '@/types';

/* 上传任务列表 */
export const uploadTasksAtom = atom<UploadTask[]>([]);

/* 是否正在上传 */
export const isUploadingAtom = atom((get) => {
  const tasks = get(uploadTasksAtom);
  return tasks.some((task) => task.status === 'uploading' || task.status === 'pending');
});

/* 拖拽上传激活状态 */
export const isDragActiveAtom = atom<boolean>(false);

/* 上传面板展开状态 */
export const uploadPanelExpandedAtom = atom<boolean>(true);
