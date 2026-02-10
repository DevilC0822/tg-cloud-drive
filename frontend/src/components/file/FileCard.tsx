import { MoreVertical } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { FileItem } from '@/types';
import { formatFileSize, truncateFilename } from '@/utils/formatters';
import { FileThumbnail } from './FileThumbnail';

function cn(...inputs: (string | undefined | null | boolean)[]) {
  return twMerge(clsx(inputs));
}

export interface FileCardProps {
  file: FileItem;
  selected?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  onDoubleClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

export function FileCard({
  file,
  selected = false,
  onClick,
  onDoubleClick,
  onContextMenu,
}: FileCardProps) {
  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      className={cn(
        'group relative p-4 rounded-2xl cursor-pointer',
        'bg-white dark:bg-neutral-900',
        'border border-neutral-200/50 dark:border-neutral-700/50',
        'hover:shadow-lg hover:-translate-y-0.5',
        'transition-all duration-200',
        selected && 'ring-2 ring-[#D4AF37] ring-offset-2 dark:ring-offset-neutral-950'
      )}
    >
      {/* 更多操作按钮 */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onContextMenu?.(e);
        }}
        className={cn(
          'absolute top-2.5 right-2.5 z-10 p-2 rounded-xl',
          'border border-white/70 dark:border-neutral-700/80',
          'bg-white/85 dark:bg-neutral-900/80 backdrop-blur',
          'shadow-sm hover:shadow',
          'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200',
          'opacity-100 md:opacity-0 md:group-hover:opacity-100',
          'scale-100 md:scale-95 md:group-hover:scale-100',
          'transition-all duration-200'
        )}
        aria-label="更多操作"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {/* 文件图标/缩略图 */}
      <div className="flex items-center justify-center h-24 mb-3">
        <FileThumbnail file={file} size="card" />
      </div>

      {/* 文件名 */}
      <div className="text-center">
        <h3
          className="font-medium text-sm text-neutral-900 dark:text-neutral-100 truncate"
          title={file.name}
        >
          {truncateFilename(file.name, 18)}
        </h3>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
          {file.type === 'folder' ? '文件夹' : formatFileSize(file.size)}
        </p>
      </div>
    </div>
  );
}
