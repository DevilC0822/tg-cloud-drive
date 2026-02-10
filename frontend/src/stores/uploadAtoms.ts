import { atom } from 'jotai';
import type { UploadTask } from '@/types';

/* 上传任务列表 */
export const uploadTasksAtom = atom<UploadTask[]>([]);

/* 是否正在上传 */
export const isUploadingAtom = atom((get) => {
  const tasks = get(uploadTasksAtom);
  return tasks.some((task) => task.status === 'uploading' || task.status === 'pending');
});

/* 上传进度（总体） */
export const uploadProgressAtom = atom((get) => {
  const tasks = get(uploadTasksAtom);
  if (tasks.length === 0) return 0;

  const totalProgress = tasks.reduce((sum, task) => sum + task.progress, 0);
  return Math.round(totalProgress / tasks.length);
});

/* 待上传任务数 */
export const pendingUploadsCountAtom = atom((get) => {
  const tasks = get(uploadTasksAtom);
  return tasks.filter((task) => task.status === 'pending' || task.status === 'uploading').length;
});

/* 已完成上传数 */
export const completedUploadsCountAtom = atom((get) => {
  const tasks = get(uploadTasksAtom);
  return tasks.filter((task) => task.status === 'completed').length;
});

/* 上传失败数 */
export const failedUploadsCountAtom = atom((get) => {
  const tasks = get(uploadTasksAtom);
  return tasks.filter((task) => task.status === 'error').length;
});

/* 拖拽上传激活状态 */
export const isDragActiveAtom = atom<boolean>(false);

/* 上传面板展开状态 */
export const uploadPanelExpandedAtom = atom<boolean>(true);
