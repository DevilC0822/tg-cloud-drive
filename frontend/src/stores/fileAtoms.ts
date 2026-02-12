import { atom } from 'jotai';
import type { FileItem, SortConfig, BreadcrumbItem } from '@/types';

/* 当前文件夹 ID */
export const currentFolderIdAtom = atom<string | null>(null);

/* 文件夹索引（用于面包屑/路径解析；不包含普通文件） */
export const foldersAtom = atom<FileItem[]>([]);

/* 选中的文件 ID 列表 */
export const selectedFileIdsAtom = atom<Set<string>>(new Set<string>());

/* 排序配置 */
export const sortConfigAtom = atom<SortConfig>({
  by: 'name',
  order: 'asc',
});

/* 搜索关键词 */
export const searchQueryAtom = atom<string>('');

function buildBreadcrumbs(files: FileItem[], currentFolderId: string | null): BreadcrumbItem[] {
  const root: BreadcrumbItem = { id: 'root', name: '我的文件', path: '/' };
  if (!currentFolderId) return [root];

  const fileMap = new Map(files.map((file) => [file.id, file] as const));
  const crumbs: BreadcrumbItem[] = [];

  let cursor: string | null = currentFolderId;
  while (cursor) {
    const item = fileMap.get(cursor);
    if (!item || item.type !== 'folder') break;

    crumbs.unshift({ id: item.id, name: item.name, path: item.path });
    cursor = item.parentId;
  }

  return [root, ...crumbs];
}

/* 面包屑导航（派生：由 currentFolderId + 文件树计算） */
export const breadcrumbsAtom = atom<BreadcrumbItem[]>((get) => {
  const files = get(foldersAtom);
  const currentFolderId = get(currentFolderIdAtom);
  return buildBreadcrumbs(files, currentFolderId);
});

/* 正在加载 */
export const isLoadingAtom = atom<boolean>(false);

/* 分页：当前页（从 1 开始） */
export const currentPageAtom = atom<number>(1);

/* 分页：每页数量 */
export const pageSizeAtom = atom<number>(50);
