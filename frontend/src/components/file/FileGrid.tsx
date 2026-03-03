import { useRef } from 'react';
import type { FileItem } from '@/types';
import { FileCard } from './FileCard';

const DOUBLE_TAP_OPEN_INTERVAL_MS = 420;

export interface FileGridProps {
  files: FileItem[];
  selectedIds: Set<string>;
  onSelect: (fileId: string, multiSelect: boolean) => void;
  onOpen: (file: FileItem) => void;
  onContextMenu: (e: React.MouseEvent, file: FileItem) => void;
}

export function FileGrid({ files, selectedIds, onSelect, onOpen, onContextMenu }: FileGridProps) {
  const lastActivateRef = useRef<{ fileId: string; time: number }>({ fileId: '', time: 0 });

  const handleFileClick = (event: React.MouseEvent, file: FileItem) => {
    const multiSelect = event.ctrlKey || event.metaKey;
    onSelect(file.id, multiSelect);
    if (multiSelect || event.shiftKey || event.button !== 0) {
      return;
    }

    const now = Date.now();
    const { fileId, time } = lastActivateRef.current;
    if (fileId === file.id && now - time <= DOUBLE_TAP_OPEN_INTERVAL_MS) {
      onOpen(file);
      lastActivateRef.current = { fileId: '', time: 0 };
      return;
    }
    lastActivateRef.current = { fileId: file.id, time: now };
  };

  if (files.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-2 gap-2.5 p-3 sm:grid-cols-3 sm:p-4 md:grid-cols-4 md:gap-4 lg:grid-cols-5 xl:grid-cols-6">
      {files.map((file) => (
        <FileCard
          key={file.id}
          file={file}
          selected={selectedIds.has(file.id)}
          onClick={(e) => handleFileClick(e, file)}
          onContextMenu={(e) => onContextMenu(e, file)}
        />
      ))}
    </div>
  );
}
