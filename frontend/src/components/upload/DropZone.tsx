import { useCallback, useRef, type ReactNode } from 'react';
import { CloudUpload } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useUpload } from '@/hooks/useUpload';

function cn(...inputs: Parameters<typeof clsx>) {
  return twMerge(clsx(inputs));
}

export interface DropZoneProps {
  children?: ReactNode;
  onDrop?: (files: FileList | File[]) => void;
  className?: string;
}

export function DropZone({ children, onDrop, className }: DropZoneProps) {
  const { isDragActive, handleDragEnter, handleDragLeave, handleDragOver, handleDrop: handleUploadDrop } = useUpload();

  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        if (onDrop) {
          onDrop(files);
        } else {
          handleUploadDrop(e);
        }
      }
    },
    [onDrop, handleUploadDrop],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        onDrop?.(files);
      }
      // 重置 input 以允许选择相同文件
      e.target.value = '';
    },
    [onDrop],
  );

  return (
    <div
      className={cn('relative', className)}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* 隐藏的文件输入 */}
      <input ref={inputRef} type="file" multiple autoComplete="off" className="hidden" onChange={handleFileSelect} />

      {/* 子内容 */}
      {children}

      {/* 拖拽覆盖层 */}
      {isDragActive && (
        <div className="animate-fadeIn absolute inset-0 z-40 flex items-center justify-center rounded-2xl border-2 border-dashed border-[var(--theme-primary)] bg-[var(--theme-primary-a12)] backdrop-blur-sm">
          <div className="text-center">
            <CloudUpload className="mx-auto mb-4 h-16 w-16 text-[var(--theme-primary)]" />
            <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100">释放以上传文件</h3>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">文件将上传到当前文件夹</p>
          </div>
        </div>
      )}
    </div>
  );
}
