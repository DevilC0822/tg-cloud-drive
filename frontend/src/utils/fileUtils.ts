import { type FileItem, type FileType, EXTENSION_TYPE_MAP } from '@/types';

/**
 * 根据文件扩展名获取文件类型
 */
export function getFileType(filename: string): FileType {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return EXTENSION_TYPE_MAP[ext] || 'other';
}

/**
 * 根据文件扩展名获取 MIME 类型
 */
export function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const mimeTypes: Record<string, string> = {
    // 图片
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
    // 视频
    mp4: 'video/mp4', webm: 'video/webm', ogg: 'video/ogg',
    // 音频
    mp3: 'audio/mpeg', wav: 'audio/wav', flac: 'audio/flac',
    // 文档
    pdf: 'application/pdf', txt: 'text/plain', md: 'text/markdown',
    json: 'application/json', xml: 'application/xml',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * 检查文件是否可预览
 */
export function isPreviewable(file: FileItem): boolean {
  if (file.type === 'folder') return false;
  const previewableTypes: FileType[] = ['image', 'video', 'audio', 'document'];
  return previewableTypes.includes(file.type);
}

/**
 * 获取文件扩展名
 */
export function getExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

/**
 * 生成唯一 ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * 根据路径获取父路径
 */
export function getParentPath(path: string): string {
  const parts = path.split('/').filter(Boolean);
  parts.pop();
  return '/' + parts.join('/');
}

/**
 * 合并路径
 */
export function joinPath(...parts: string[]): string {
  return '/' + parts.map(p => p.replace(/^\/|\/$/g, '')).filter(Boolean).join('/');
}

/**
 * 排序文件列表（文件夹优先）
 */
export function sortFiles(
  files: FileItem[],
  sortBy: 'name' | 'size' | 'date' | 'type' = 'name',
  order: 'asc' | 'desc' = 'asc'
): FileItem[] {
  return [...files].sort((a, b) => {
    // 文件夹始终排在前面
    if (a.type === 'folder' && b.type !== 'folder') return -1;
    if (a.type !== 'folder' && b.type === 'folder') return 1;

    let comparison = 0;
    switch (sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name, 'zh-CN');
        break;
      case 'size':
        comparison = a.size - b.size;
        break;
      case 'date':
        comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        break;
      case 'type':
        comparison = a.type.localeCompare(b.type);
        break;
    }

    return order === 'asc' ? comparison : -comparison;
  });
}

/**
 * 过滤文件列表
 */
export function filterFiles(files: FileItem[], query: string): FileItem[] {
  if (!query.trim()) return files;
  const lowerQuery = query.toLowerCase();
  return files.filter(file =>
    file.name.toLowerCase().includes(lowerQuery)
  );
}

function splitNameAndExt(filename: string): { base: string; ext: string } {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot <= 0 || lastDot === filename.length - 1) {
    return { base: filename, ext: '' };
  }
  return { base: filename.slice(0, lastDot), ext: filename.slice(lastDot) };
}

/**
 * 获取父目录路径（用于基于 parentId 计算 path）
 * - parentId 为 null：根目录 "/"
 * - parentId 不存在或不是文件夹：回退到根目录 "/"
 */
export function resolveParentPath(files: FileItem[], parentId: string | null): string {
  if (!parentId) return '/';
  const parent = files.find((f) => f.id === parentId && f.type === 'folder' && !f.trashedAt);
  return parent?.path || '/';
}

/**
 * 生成目录内不冲突的名称
 * - 会保留扩展名（例如 "a.txt" -> "a (1).txt"）
 * - 默认忽略回收站中的同名项（trashedAt 有值）
 */
export function getUniqueName(
  files: FileItem[],
  parentId: string | null,
  desiredName: string,
  options?: {
    excludeId?: string;
    suffix?: string;
  }
): string {
  const cleaned = desiredName.trim();
  if (!cleaned) return desiredName;

  const { base, ext } = splitNameAndExt(cleaned);
  const suffix = options?.suffix ?? '';
  const excludeId = options?.excludeId;

  const baseWithSuffix = `${base}${suffix}`;
  let candidate = `${baseWithSuffix}${ext}`;
  let index = 1;

  const conflicts = (name: string) =>
    files.some(
      (f) =>
        !f.trashedAt &&
        f.parentId === parentId &&
        f.name === name &&
        (excludeId ? f.id !== excludeId : true)
    );

  while (conflicts(candidate)) {
    candidate = `${baseWithSuffix} (${index})${ext}`;
    index += 1;
  }

  return candidate;
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
