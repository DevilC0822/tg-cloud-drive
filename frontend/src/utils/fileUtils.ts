import { type FileItem } from '@/types';

/**
 * 生成唯一 ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * 收集某个文件夹及其所有后代的 id（包含自身）
 */
export function collectDescendantIds(files: FileItem[], folderId: string): Set<string> {
  const childrenByParent = new Map<string, string[]>();

  for (const item of files) {
    if (!item.parentId) continue;
    const list = childrenByParent.get(item.parentId) ?? [];
    list.push(item.id);
    childrenByParent.set(item.parentId, list);
  }

  const visited = new Set<string>();
  const queue: string[] = [folderId];

  while (queue.length > 0) {
    const id = queue.shift();
    if (!id || visited.has(id)) continue;

    visited.add(id);
    const children = childrenByParent.get(id) ?? [];
    for (const childId of children) {
      if (!visited.has(childId)) queue.push(childId);
    }
  }

  return visited;
}
