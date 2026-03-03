import { MoreVertical, Check } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { FileItem } from '@/types';
import { ActionIconButton } from '@/components/ui/HeroActionPrimitives';
import { formatFileSize } from '@/utils/formatters';
import { FileThumbnail } from './FileThumbnail';
import { motion, AnimatePresence } from 'framer-motion';
import { springTransition } from '@/utils/animations';

function cn(...inputs: (string | undefined | null | boolean)[]) {
  return twMerge(clsx(inputs));
}

export interface FileCardProps {
  file: FileItem;
  selected?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

export function FileCard({ file, selected = false, onClick, onContextMenu }: FileCardProps) {
  return (
    <motion.div
      layout
      data-file-item="true"
      data-selected={selected ? 'true' : 'false'}
      aria-selected={selected}
      onClick={onClick}
      onContextMenu={onContextMenu}
      whileHover={
        selected
          ? { y: -4 }
          : { y: -4, boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)' }
      }
      whileTap={{ scale: 0.98 }}
      transition={springTransition}
      className={cn(
        'group relative cursor-pointer rounded-2xl border transition-all duration-300',
        'p-3 backdrop-blur-md sm:p-4',
        selected
          ? 'border-[var(--theme-primary-a70)] bg-[linear-gradient(145deg,var(--theme-primary-a20),var(--theme-primary-a08))] shadow-[inset_0_0_0_1px_var(--theme-primary-a35),0_18px_36px_-20px_var(--theme-primary-a55)] dark:border-[var(--theme-primary-a55)] dark:bg-[linear-gradient(145deg,var(--theme-primary-a24),rgba(15,23,42,0.24))]'
          : 'border-white/50 bg-white/40 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.15)] dark:border-white/10 dark:bg-black/30 dark:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)]'
      )}
    >
      {selected ? (
        <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-[var(--theme-primary-a35)]" />
      ) : null}

      {/* 选中标识 */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="absolute top-2.5 left-2.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--theme-primary)] text-neutral-900 shadow-sm"
          >
            <Check className="h-3 w-3 stroke-[3px]" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 更多操作按钮 */}
      <div className="absolute top-2.5 right-2.5 z-10">
        <ActionIconButton
          icon={<MoreVertical className="h-4 w-4" />}
          label="更多操作"
          onClick={(e) => {
            e.stopPropagation();
            onContextMenu?.(e);
          }}
          className={cn(
            'rounded-xl border border-white/70 dark:border-neutral-700/80',
            'bg-white/85 backdrop-blur dark:bg-neutral-900/80 shadow-sm',
            'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200',
            'transition-opacity duration-200',
            selected
              ? 'pointer-events-auto opacity-100'
              : 'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100'
          )}
        />
      </div>

      {/* 文件图标/缩略图 */}
      <div className="mb-3 flex h-24 items-center justify-center">
        <FileThumbnail file={file} size="card" />
      </div>

      {/* 文件名 */}
      <div className="text-center">
        <h3
          className="min-h-10 overflow-hidden text-sm leading-5 font-medium text-neutral-900 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] break-words dark:text-neutral-100"
          title={file.name}
        >
          {file.name}
        </h3>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          {file.type === 'folder' ? '目录' : formatFileSize(file.size)}
        </p>
      </div>
    </motion.div>
  );
}
