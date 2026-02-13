import { MoreVertical } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { FileItem } from '@/types';
import { ActionIconButton } from '@/components/ui/HeroActionPrimitives';
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

export function FileCard({ file, selected = false, onClick, onDoubleClick, onContextMenu }: FileCardProps) {
  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      className={cn(
        'group relative cursor-pointer rounded-2xl border border-neutral-200/70 bg-white/92 p-4 dark:border-neutral-700/70 dark:bg-neutral-900/78',
        'shadow-[0_12px_28px_-24px_rgba(15,23,42,0.7)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_36px_-24px_rgba(15,23,42,0.55)]',
        selected && 'ring-2 ring-[var(--theme-primary)] ring-offset-2 dark:ring-offset-neutral-950',
      )}
    >
      {/* 更多操作按钮 */}
      <ActionIconButton
        icon={<MoreVertical className="h-4 w-4" />}
        label="更多操作"
        onClick={(e) => {
          e.stopPropagation();
          onContextMenu?.(e);
        }}
        className={cn(
          'absolute top-2.5 right-2.5 z-10 rounded-xl',
          'border border-white/70 dark:border-neutral-700/80',
          'bg-white/85 backdrop-blur dark:bg-neutral-900/80',
          'shadow-sm hover:shadow',
          'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200',
          'opacity-100 md:opacity-0 md:group-hover:opacity-100',
          'scale-100 md:scale-95 md:group-hover:scale-100',
          'transition-all duration-200',
        )}
      />

      {/* 文件图标/缩略图 */}
      <div className="mb-3 flex h-24 items-center justify-center">
        <FileThumbnail file={file} size="card" />
      </div>

      {/* 文件名 */}
      <div className="text-center">
        <h3 className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100" title={file.name}>
          {truncateFilename(file.name, 18)}
        </h3>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          {file.type === 'folder' ? '目录' : formatFileSize(file.size)}
        </p>
      </div>
    </div>
  );
}
