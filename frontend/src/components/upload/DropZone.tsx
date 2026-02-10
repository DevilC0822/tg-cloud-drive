import { useCallback, useRef, type ReactNode } from 'react';
import { Upload, CloudUpload } from 'lucide-react';
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
  disabled?: boolean;
}

export function DropZone({
  children,
  onDrop,
  className,
  disabled = false,
}: DropZoneProps) {
  const {
    isDragActive,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop: handleUploadDrop,
  } = useUpload();

  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      if (disabled) return;

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
    [disabled, onDrop, handleUploadDrop]
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
    [onDrop]
  );

  // 保留 inputRef 用于隐藏的文件输入
  void inputRef;

  return (
    <div
      className={cn('relative', className)}
      onDragEnter={disabled ? undefined : handleDragEnter}
      onDragLeave={disabled ? undefined : handleDragLeave}
      onDragOver={disabled ? undefined : handleDragOver}
      onDrop={handleDrop}
    >
      {/* 隐藏的文件输入 */}
      <input
        ref={inputRef}
        type="file"
        multiple
        autoComplete="off"
        className="hidden"
        onChange={handleFileSelect}
        disabled={disabled}
      />

      {/* 子内容 */}
      {children}

      {/* 拖拽覆盖层 */}
      {isDragActive && !disabled && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#D4AF37]/10 backdrop-blur-sm border-2 border-dashed border-[#D4AF37] rounded-2xl animate-fadeIn">
          <div className="text-center">
            <CloudUpload className="w-16 h-16 text-[#D4AF37] mx-auto mb-4" />
            <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100">
              释放以上传文件
            </h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
              文件将上传到当前文件夹
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* 独立的上传区域组件 */
export interface UploadAreaProps {
  onUpload: (files: FileList | File[]) => void;
  className?: string;
  compact?: boolean;
}

export function UploadArea({ onUpload, className, compact = false }: UploadAreaProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { isDragActive, handleDragEnter, handleDragLeave, handleDragOver } = useUpload();

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      onUpload(files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onUpload(files);
    }
    e.target.value = '';
  };

  return (
    <div
      className={cn(
        'border-2 border-dashed rounded-2xl transition-all duration-200 cursor-pointer',
        isDragActive
          ? 'border-[#D4AF37] bg-[#D4AF37]/10'
          : 'border-neutral-300 dark:border-neutral-700 hover:border-[#D4AF37] hover:bg-neutral-50 dark:hover:bg-neutral-800/50',
        compact ? 'p-4' : 'p-8',
        className
      )}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        autoComplete="off"
        className="hidden"
        onChange={handleFileSelect}
      />

      <div className="text-center">
        <Upload
          className={cn(
            'mx-auto text-neutral-400',
            compact ? 'w-8 h-8 mb-2' : 'w-12 h-12 mb-4'
          )}
        />
        <h3
          className={cn(
            'font-medium text-neutral-900 dark:text-neutral-100',
            compact ? 'text-sm' : 'text-base mb-1'
          )}
        >
          {compact ? '点击或拖拽上传' : '拖拽文件到此处上传'}
        </h3>
        {!compact && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            或 <span className="text-[#D4AF37]">点击选择文件</span>
          </p>
        )}
      </div>
    </div>
  );
}
