import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import type { ViewMode, Theme, ContextMenuPosition, FileItem } from '@/types';

/* 视图模式 */
export const viewModeAtom = atom<ViewMode>('grid');

/* 主题 */
export const themeAtom = atomWithStorage<Theme>('tg-theme', 'system');

export const uploadConcurrencyAtom = atomWithStorage<number>('tgcd-upload-concurrency', 1);
export const downloadConcurrencyAtom = atomWithStorage<number>('tgcd-download-concurrency', 2);
export const reservedDiskBytesAtom = atomWithStorage<number>(
  'tgcd-reserved-disk-bytes',
  2 * 1024 * 1024 * 1024
);

/* 侧边栏展开状态 */
export const sidebarOpenAtom = atom<boolean>(true);

/* 移动端侧边栏展开状态 */
export const mobileSidebarOpenAtom = atom<boolean>(false);

/* 右键菜单状态 */
export const contextMenuAtom = atom<{
  visible: boolean;
  position: ContextMenuPosition;
  targetFile: FileItem | null;
}>({
  visible: false,
  position: { x: 0, y: 0 },
  targetFile: null,
});

/* 预览模态框状态 */
export const previewModalAtom = atom<{
  visible: boolean;
  file: FileItem | null;
}>({
  visible: false,
  file: null,
});

/* 新建文件夹模态框 */
export const newFolderModalAtom = atom<boolean>(false);

/* 重命名模态框 */
export const renameModalAtom = atom<{
  visible: boolean;
  file: FileItem | null;
}>({
  visible: false,
  file: null,
});

/* 删除确认模态框 */
export const deleteModalAtom = atom<{
  visible: boolean;
  files: FileItem[];
}>({
  visible: false,
  files: [],
});

/* 当前激活的导航项 */
export const activeNavAtom = atom<string>('files');
