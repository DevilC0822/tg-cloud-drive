import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { FileItem, SortBy, SortOrder } from '@/types';
import { FileRow } from './FileRow';

function cn(...inputs: (string | undefined | null | boolean)[]) {
  return twMerge(clsx(inputs));
}

const FILE_LIST_COLUMNS_CLASS =
  'grid-cols-[2.5rem_minmax(0,1fr)_3rem] md:grid-cols-[2.5rem_minmax(0,5fr)_minmax(0,2fr)_minmax(0,1fr)_minmax(0,2fr)_3rem]';

interface SortHeaderCellProps {
  column: SortBy;
  label: string;
  sortBy: SortBy;
  sortOrder: SortOrder;
  onSort: (by: SortBy) => void;
  align?: 'left' | 'right';
  className?: string;
}

function SortHeaderCell({
  column,
  label,
  sortBy,
  sortOrder,
  onSort,
  align = 'left',
  className,
}: SortHeaderCellProps) {
  const isActive = sortBy === column;
  const SortIcon = !isActive ? ArrowUpDown : sortOrder === 'asc' ? ArrowUp : ArrowDown;

  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className={cn(
        'inline-flex w-full items-center gap-1 text-[11px] font-semibold tracking-[0.08em] uppercase transition-colors duration-200',
        align === 'right' ? 'justify-end' : 'justify-start',
        isActive
          ? 'text-[var(--theme-primary-ink-strong)] dark:text-[var(--theme-primary-soft)]'
          : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200',
        className,
      )}
    >
      <span>{label}</span>
      <SortIcon className={cn('h-3 w-3', !isActive && 'opacity-65')} />
    </button>
  );
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
  if (files.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col">
      {/* 表头 */}
      <div
        className={cn(
          'sticky top-0 z-10 grid items-center gap-4 border-b border-neutral-200/70 bg-white/72 px-4 py-2 dark:border-neutral-700/70 dark:bg-neutral-900/72',
          FILE_LIST_COLUMNS_CLASS,
        )}
      >
        <div className="flex h-10 w-10 items-center justify-center text-[11px] font-medium tracking-[0.08em] text-neutral-500 uppercase dark:text-neutral-400">
          预览
        </div>
        <SortHeaderCell column="name" label="名称" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
        <div className="hidden text-[11px] font-medium tracking-[0.08em] text-neutral-500 uppercase md:block dark:text-neutral-400">
          类型
        </div>
        <SortHeaderCell
          column="size"
          label="大小"
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={onSort}
          align="right"
          className="hidden md:inline-flex"
        />
        <SortHeaderCell
          column="date"
          label="更新时间"
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={onSort}
          align="right"
          className="hidden md:inline-flex"
        />
        <div className="w-12 text-right text-[11px] font-medium tracking-[0.08em] text-neutral-500 uppercase dark:text-neutral-400">
          操作
        </div>
      </div>

      {/* 文件列表 */}
      <div className="flex-1">
        {files.map((file) => (
          <FileRow
            key={file.id}
            file={file}
            selected={selectedIds.has(file.id)}
            columnsClassName={FILE_LIST_COLUMNS_CLASS}
            onClick={(e) => onSelect(file.id, e.ctrlKey || e.metaKey)}
            onDoubleClick={() => onOpen(file)}
            onContextMenu={(e) => onContextMenu(e, file)}
          />
        ))}
      </div>
    </div>
  );
}
