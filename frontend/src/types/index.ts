/* 文件类型定义 */
export type FileType =
  | 'folder'
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'archive'
  | 'code'
  | 'other';

/* 文件项接口 */
export interface FileItem {
  id: string;
  name: string;
  type: FileType;
  size: number; // 字节
  mimeType?: string;
  extension?: string;
  createdAt: Date;
  updatedAt: Date;
  lastAccessedAt?: Date | null; // 最近访问时间（用于“最近访问”视图）
  parentId: string | null; // null 表示根目录
  path: string; // 完整路径
  isFavorite: boolean;
  isVaulted: boolean;
  isShared: boolean;
  shareCode?: string | null; // 分享短码（仅当已分享时可能有值）
  thumbnail?: string; // 缩略图 URL
  trashedAt?: Date | null; // 回收站时间（有值表示已移入回收站）
}

/* 文件夹接口 */
export interface FolderItem extends FileItem {
  type: 'folder';
  childCount: number;
}

/* 面包屑项 */
export interface BreadcrumbItem {
  id: string;
  name: string;
  path: string;
}

/* 上传任务 */
export interface UploadTask {
  id: string;
  file: File;
  progress: number; // 0-100
  status: 'pending' | 'uploading' | 'completed' | 'error';
  startedAt?: number;
  updatedAt?: number;
  finishedAt?: number;
  error?: string;
  targetParentId?: string | null;
  uploadSessionId?: string;
  uploadedChunkCount?: number;
  totalChunkCount?: number;
  resumable?: boolean;
  uploadVideoFaststartApplied?: boolean;
  uploadVideoFaststartFallback?: boolean;
  uploadVideoPreviewAttached?: boolean;
  uploadVideoPreviewFallback?: boolean;
}

/* 下载任务 */
export interface DownloadTask {
  id: string;
  fileId: string;
  fileName: string;
  size: number;
  progress: number; // 0-100
  status: 'pending' | 'downloading' | 'completed' | 'error' | 'canceled';
  startedAt: number;
  updatedAt: number;
  finishedAt?: number;
  error?: string;
}

/* 传输历史 */
export interface TransferHistoryItem {
  id: string;
  sourceTaskId: string;
  direction: 'upload' | 'download';
  fileId?: string | null;
  fileName: string;
  size: number;
  status: 'completed' | 'error' | 'canceled';
  startedAt: number;
  finishedAt: number;
  error?: string;
  uploadVideoFaststartApplied?: boolean;
  uploadVideoFaststartFallback?: boolean;
  uploadVideoPreviewAttached?: boolean;
  uploadVideoPreviewFallback?: boolean;
}

export type TorrentTaskStatus =
  | 'queued'
  | 'downloading'
  | 'awaiting_selection'
  | 'uploading'
  | 'completed'
  | 'error';

export interface TorrentTaskFile {
  fileIndex: number;
  filePath: string;
  fileName: string;
  fileSize: number;
  selected: boolean;
  uploaded: boolean;
  uploadedItemId?: string | null;
  error?: string | null;
}

export interface TorrentTask {
  id: string;
  sourceType: 'url' | 'file';
  sourceUrl?: string | null;
  torrentName: string;
  infoHash: string;
  targetChatId: string;
  targetParentId?: string | null;
  submittedBy: string;
  estimatedSize: number;
  downloadedBytes: number;
  progress: number;
  isPrivate: boolean;
  trackerHosts: string[];
  status: TorrentTaskStatus;
  error?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  dueAt?: string | null;
  createdAt: string;
  updatedAt: string;
  files?: TorrentTaskFile[];
}

/* 视图模式 */
export type ViewMode = 'grid' | 'list';

/* 排序方式 */
export type SortBy = 'name' | 'size' | 'date' | 'type';
export type SortOrder = 'asc' | 'desc';

export interface SortConfig {
  by: SortBy;
  order: SortOrder;
}

/* 主题 */
export type Theme = 'light' | 'dark' | 'system';

/* 存储统计 */
export type StorageTypeKey =
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'archive'
  | 'code'
  | 'other';

export interface StorageTypeStats {
  bytes: number;
  count: number;
}

export interface StorageStats {
  totalBytes: number; // 全部文件总大小（字节）
  totalFiles: number; // 全部文件总数
  byType: Record<StorageTypeKey, StorageTypeStats>;
}

/* 右键菜单项 */
export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  divider?: boolean;
  onClick?: () => void;
}

/* 右键菜单位置 */
export interface ContextMenuPosition {
  x: number;
  y: number;
}

/* 导航项 */
export interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  badge?: number;
}

/* 用户信息 */
export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

/* 预览支持的文件类型 */
export const PREVIEWABLE_EXTENSIONS = {
  image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'],
  video: ['mp4', 'webm', 'ogg', 'mov'],
  audio: ['mp3', 'wav', 'ogg', 'flac', 'aac'],
  document: ['pdf', 'txt', 'md'],
} as const;

/* 文件扩展名到类型的映射 */
export const EXTENSION_TYPE_MAP: Record<string, FileType> = {
  // 图片
  jpg: 'image', jpeg: 'image', png: 'image', gif: 'image',
  webp: 'image', svg: 'image', bmp: 'image', ico: 'image',
  // 视频
  mp4: 'video', webm: 'video', ogg: 'video', mov: 'video', avi: 'video',
  // 音频
  mp3: 'audio', wav: 'audio', flac: 'audio', aac: 'audio',
  // 文档
  pdf: 'document', doc: 'document', docx: 'document',
  xls: 'document', xlsx: 'document', ppt: 'document', pptx: 'document',
  txt: 'document', md: 'document', rtf: 'document',
  // 压缩包
  zip: 'archive', rar: 'archive', '7z': 'archive', tar: 'archive', gz: 'archive',
  // 代码
  js: 'code', ts: 'code', jsx: 'code', tsx: 'code',
  html: 'code', css: 'code', scss: 'code', less: 'code',
  json: 'code', xml: 'code', yaml: 'code', yml: 'code',
  py: 'code', java: 'code', c: 'code', cpp: 'code', go: 'code', rs: 'code',
};
