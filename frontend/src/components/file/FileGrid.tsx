import type { FileItem } from '@/types';
import { FileCard } from './FileCard';

export interface FileGridProps {
  files: FileItem[];
  selectedIds: Set<string>;
  onSelect: (fileId: string, multiSelect: boolean) => void;
  onOpen: (file: FileItem) => void;
  onContextMenu: (e: React.MouseEvent, file: FileItem) => void;
}

export function FileGrid({
  files,
  selectedIds,
  onSelect,
  onOpen,
  onContextMenu,
}: FileGridProps) {
  if (files.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 md:grid-cols-4 md:gap-4 lg:grid-cols-5 xl:grid-cols-6">
      {files.map((file) => (
        <FileCard
          key={file.id}
          file={file}
          selected={selectedIds.has(file.id)}
          onClick={(e) => onSelect(file.id, e.ctrlKey || e.metaKey)}
          onDoubleClick={() => onOpen(file)}
          onContextMenu={(e) => onContextMenu(e, file)}
        />
      ))}
    </div>
  );
}
