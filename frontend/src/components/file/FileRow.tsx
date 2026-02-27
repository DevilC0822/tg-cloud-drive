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

const FILE_TYPE_LABELS: Record<FileItem['type'], string> = {
  folder: '目录',
  image: '图片',
  video: '视频',
  audio: '音频',
  document: '文档',
  archive: '压缩包',
  code: '代码',
  other: '其他',
};

export interface FileRowProps {
  file: FileItem;
  selected?: boolean;
  columnsClassName?: string;
  onClick?: (e: React.MouseEvent) => void;
  onDoubleClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

export function FileRow({
  file,
  selected = false,
  columnsClassName,
  onClick,
  onDoubleClick,
  onContextMenu,
}: FileRowProps) {
  const typeLabel = FILE_TYPE_LABELS[file.type];

  return (
    <div
      data-file-item="true"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      className={cn(
        'group grid cursor-pointer items-center gap-4 border-b border-white/20 px-4 py-3 dark:border-white/5',
        'transition-colors duration-200 hover:bg-white/30 dark:hover:bg-white/5',
        selected && 'bg-[var(--theme-primary-a12)] hover:bg-[var(--theme-primary-a16)]',
        columnsClassName,
      )}
    >
      {/* 文件图标 */}
      <div className="flex h-10 w-10 items-center justify-center">
        <FileThumbnail file={file} size="row" />
      </div>

      {/* 文件名 */}
      <div className="min-w-0">
        <h3
          className="overflow-hidden text-sm leading-5 font-medium text-neutral-900 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] break-words dark:text-neutral-100"
          title={file.name}
        >
          {file.name}
        </h3>
      </div>

      {/* 类型 */}
      <div className="hidden min-w-0 md:block">
        <span className="truncate text-sm text-neutral-500 dark:text-neutral-400">{typeLabel}</span>
      </div>

      {/* 文件大小 */}
      <div className="hidden min-w-0 text-right md:block">
        <span className="text-sm text-neutral-500 dark:text-neutral-400">
          {file.type === 'folder' ? '-' : formatFileSize(file.size)}
        </span>
      </div>

      {/* 修改日期 */}
      <div className="hidden min-w-0 text-right md:block">
        <span className="text-sm text-neutral-500 dark:text-neutral-400">{formatDate(file.updatedAt)}</span>
      </div>

      {/* 操作按钮 */}
      <div className="flex w-12 justify-end">
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
