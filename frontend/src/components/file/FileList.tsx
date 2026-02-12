import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { FileItem, SortBy, SortOrder } from '@/types';
import { ActionTextButton } from '@/components/ui/HeroActionPrimitives';
import { FileRow } from './FileRow';

function cn(...inputs: (string | undefined | null | boolean)[]) {
  return twMerge(clsx(inputs));
}

export interface FileListProps {
  files: FileItem[];
  selectedIds: Set<string>;
  sortBy: SortBy;
  sortOrder: SortOrder;
  onSelect: (fileId: string, multiSelect: boolean) => void;
  onOpen: (file: FileItem) => void;
  onContextMenu: (e: React.MouseEvent, file: FileItem) => void;
  onSort: (by: SortBy) => void;
}

export function FileList({
  files,
  selectedIds,
  sortBy,
  sortOrder,
  onSelect,
  onOpen,
  onContextMenu,
  onSort,
}: FileListProps) {
  const SortIcon = ({ column }: { column: SortBy }) => {
    if (sortBy !== column) {
      return <ArrowUpDown className="h-3 w-3 opacity-60" />;
    }
    return sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  if (files.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col">
      {/* 表头 */}
      <div className="sticky top-0 z-10 flex items-center gap-4 border-b border-neutral-200/80 bg-neutral-100/90 px-4 py-2.5 backdrop-blur dark:border-neutral-700/80 dark:bg-neutral-900/85">
        <div className="w-10 flex-shrink-0" /> {/* 图标占位 */}
        <ActionTextButton
          tone={sortBy === 'name' ? 'brand' : 'neutral'}
          density="compact"
          onPress={() => onSort('name')}
          trailingIcon={<SortIcon column="name" />}
          className={cn(
            'flex-1 justify-start text-[11px] uppercase tracking-[0.08em]',
            sortBy !== 'name' && 'text-neutral-500 dark:text-neutral-400'
          )}
        >
          文件名
        </ActionTextButton>
        <ActionTextButton
          tone={sortBy === 'size' ? 'brand' : 'neutral'}
          density="compact"
          onPress={() => onSort('size')}
          trailingIcon={<SortIcon column="size" />}
          className={cn(
            'hidden w-24 justify-end text-[11px] uppercase tracking-[0.08em] sm:inline-flex',
            sortBy !== 'size' && 'text-neutral-500 dark:text-neutral-400'
          )}
        >
          大小
        </ActionTextButton>
        <ActionTextButton
          tone={sortBy === 'date' ? 'brand' : 'neutral'}
          density="compact"
          onPress={() => onSort('date')}
          trailingIcon={<SortIcon column="date" />}
          className={cn(
            'hidden w-32 justify-end text-[11px] uppercase tracking-[0.08em] md:inline-flex',
            sortBy !== 'date' && 'text-neutral-500 dark:text-neutral-400'
          )}
        >
          更新时间
        </ActionTextButton>
        <div className="w-16" /> {/* 操作按钮占位 */}
      </div>

      {/* 文件列表 */}
      <div className="flex-1">
        {files.map((file) => (
          <FileRow
            key={file.id}
            file={file}
            selected={selectedIds.has(file.id)}
            onClick={(e) => onSelect(file.id, e.ctrlKey || e.metaKey)}
            onDoubleClick={() => onOpen(file)}
            onContextMenu={(e) => onContextMenu(e, file)}
          />
        ))}
      </div>
    </div>
  );
}
