import { MoreVertical } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { FileItem } from '@/types';
import { formatFileSize, formatDate } from '@/utils/formatters';
import { FileThumbnail } from './FileThumbnail';

function cn(...inputs: (string | undefined | null | boolean)[]) {
  return twMerge(clsx(inputs));
}

export interface FileRowProps {
  file: FileItem;
  selected?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  onDoubleClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

export function FileRow({
  file,
  selected = false,
  onClick,
  onDoubleClick,
  onContextMenu,
}: FileRowProps) {
  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      className={cn(
        'group flex items-center gap-4 px-4 py-3 cursor-pointer',
        'hover:bg-neutral-50 dark:hover:bg-neutral-800/50',
        'border-b border-neutral-100 dark:border-neutral-800',
        'transition-colors duration-150',
        selected && 'bg-[#D4AF37]/5 hover:bg-[#D4AF37]/10'
      )}
    >
      {/* 文件图标 */}
      <div className="flex-shrink-0">
        <FileThumbnail file={file} size="row" />
      </div>

      {/* 文件名 */}
      <div className="flex-1 min-w-0">
        <h3
          className="font-medium text-sm text-neutral-900 dark:text-neutral-100 truncate"
          title={file.name}
        >
          {file.name}
        </h3>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
          {file.type === 'folder' ? '文件夹' : file.mimeType || '文件'}
        </p>
      </div>

      {/* 文件大小 */}
      <div className="hidden sm:block w-24 text-right">
        <span className="text-sm text-neutral-500 dark:text-neutral-400">
          {file.type === 'folder' ? '-' : formatFileSize(file.size)}
        </span>
      </div>

      {/* 修改日期 */}
      <div className="hidden md:block w-32 text-right">
        <span className="text-sm text-neutral-500 dark:text-neutral-400">{formatDate(file.updatedAt)}</span>
      </div>

      {/* 操作按钮 */}
      <div className="w-16 flex justify-end">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onContextMenu?.(e);
          }}
          className={cn(
            'p-2 rounded-xl border border-neutral-200/80 dark:border-neutral-700/70',
            'bg-white/85 dark:bg-neutral-900/70 backdrop-blur-sm',
            'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200',
            'hover:bg-white dark:hover:bg-neutral-800/90',
            'opacity-100 md:opacity-0 md:group-hover:opacity-100',
            'scale-100 md:scale-95 md:group-hover:scale-100',
            'shadow-sm transition-all duration-200'
          )}
          aria-label="更多操作"
        >
        <MoreVertical className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
