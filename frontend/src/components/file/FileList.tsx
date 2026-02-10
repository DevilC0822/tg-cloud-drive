import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { FileItem, SortBy, SortOrder } from '@/types';
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
      return <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-50" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-[#D4AF37]" />
    ) : (
      <ArrowDown className="w-3 h-3 text-[#D4AF37]" />
    );
  };

  if (files.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col">
      {/* 表头 */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/50 sticky top-0">
        <div className="w-10 flex-shrink-0" /> {/* 图标占位 */}
        <button
          onClick={() => onSort('name')}
          className={cn(
            'group flex-1 flex items-center gap-1 text-xs font-medium uppercase tracking-wider',
            'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300',
            sortBy === 'name' && 'text-[#D4AF37]'
          )}
        >
          名称 <SortIcon column="name" />
        </button>
        <button
          onClick={() => onSort('size')}
          className={cn(
            'group hidden sm:flex w-24 items-center justify-end gap-1 text-xs font-medium uppercase tracking-wider',
            'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300',
            sortBy === 'size' && 'text-[#D4AF37]'
          )}
        >
          大小 <SortIcon column="size" />
        </button>
        <button
          onClick={() => onSort('date')}
          className={cn(
            'group hidden md:flex w-32 items-center justify-end gap-1 text-xs font-medium uppercase tracking-wider',
            'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300',
            sortBy === 'date' && 'text-[#D4AF37]'
          )}
        >
          修改日期 <SortIcon column="date" />
        </button>
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
