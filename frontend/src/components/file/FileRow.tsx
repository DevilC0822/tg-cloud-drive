import { Check, MoreVertical } from 'lucide-react';
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
  onContextMenu?: (e: React.MouseEvent) => void;
}

export function FileRow({
  file,
  selected = false,
  columnsClassName,
  onClick,
  onContextMenu,
}: FileRowProps) {
  const typeLabel = FILE_TYPE_LABELS[file.type];

  return (
    <div
      data-file-item="true"
      data-selected={selected ? 'true' : 'false'}
      aria-selected={selected}
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={cn(
        'group relative grid cursor-pointer items-center gap-4 border-b border-white/20 px-4 py-3 dark:border-white/5',
        'transition-all duration-200',
        selected
          ? 'bg-[linear-gradient(90deg,var(--theme-primary-a24),var(--theme-primary-a08))] shadow-[inset_0_0_0_1px_var(--theme-primary-a24)] hover:bg-[linear-gradient(90deg,var(--theme-primary-a35),var(--theme-primary-a12))] dark:bg-[linear-gradient(90deg,var(--theme-primary-a24),rgba(15,23,42,0.24))]'
          : 'hover:bg-white/30 dark:hover:bg-white/5',
        columnsClassName,
      )}
    >
      {/* 选中指示条 */}
      {selected && (
        <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-[var(--theme-primary)] shadow-[0_0_8px_var(--theme-primary-a55)]" />
      )}

      {/* 文件图标 */}
      <div className="relative flex h-10 w-10 items-center justify-center">
        <FileThumbnail file={file} size="row" />
        {selected ? (
          <span className="absolute -top-1 -right-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-[var(--theme-primary)] text-neutral-900 shadow-sm">
            <Check className="h-2.5 w-2.5 stroke-[3px]" />
          </span>
        ) : null}
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
