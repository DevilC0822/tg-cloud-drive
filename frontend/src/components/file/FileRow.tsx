import { MoreVertical } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { FileItem } from '@/types';
import { ActionIconButton } from '@/components/ui/HeroActionPrimitives';
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

export function FileRow({ file, selected = false, onClick, onDoubleClick, onContextMenu }: FileRowProps) {
  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      className={cn(
        'group flex cursor-pointer items-center gap-4 border-b border-white/20 px-4 py-3 dark:border-white/5',
        'transition-colors duration-200 hover:bg-white/30 dark:hover:bg-white/5',
        selected && 'bg-[var(--theme-primary-a12)] hover:bg-[var(--theme-primary-a16)]',
      )}
    >
      {/* 文件图标 */}
      <div className="flex-shrink-0">
        <FileThumbnail file={file} size="row" />
      </div>

      {/* 文件名 */}
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100" title={file.name}>
          {file.name}
        </h3>
        <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
          {file.type === 'folder' ? '目录' : file.mimeType || '文件'}
        </p>
      </div>

      {/* 文件大小 */}
      <div className="hidden w-24 text-right sm:block">
        <span className="text-sm text-neutral-500 dark:text-neutral-400">
          {file.type === 'folder' ? '-' : formatFileSize(file.size)}
        </span>
      </div>

      {/* 修改日期 */}
      <div className="hidden w-32 text-right md:block">
        <span className="text-sm text-neutral-500 dark:text-neutral-400">{formatDate(file.updatedAt)}</span>
      </div>

      {/* 操作按钮 */}
      <div className="flex w-16 justify-end">
        <ActionIconButton
          icon={<MoreVertical className="h-4 w-4" />}
          label="更多操作"
          onClick={(e) => {
            e.stopPropagation();
            onContextMenu?.(e);
          }}
          className={cn(
            'rounded-xl border border-neutral-200/80 dark:border-neutral-700/70',
            'bg-white/85 backdrop-blur-sm dark:bg-neutral-900/70',
            'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200',
            'hover:bg-white dark:hover:bg-neutral-800/90',
            'opacity-100 md:opacity-0 md:group-hover:opacity-100',
            'scale-100 md:scale-95 md:group-hover:scale-100',
            'shadow-sm transition-all duration-200',
          )}
        />
      </div>
    </div>
  );
}
