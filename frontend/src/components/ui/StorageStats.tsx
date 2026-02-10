import { useAtomValue } from 'jotai';
import { storageStatsAtom } from '@/stores/uiAtoms';
import { formatFileSize } from '@/utils/formatters';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { StorageTypeKey } from '@/types';

function cn(...inputs: (string | undefined | null | boolean)[]) {
  return twMerge(clsx(inputs));
}

export interface StorageStatsProps {
  className?: string;
  compact?: boolean;
}

export function StorageStats({ className, compact = false }: StorageStatsProps) {
  const stats = useAtomValue(storageStatsAtom);
  const categories = getCategoryMeta();

  if (compact) {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <div className="text-xs min-w-0">
          <div className="font-medium text-neutral-900 dark:text-neutral-100 truncate">
            {formatFileSize(stats.totalBytes)}
          </div>
          <div className="text-neutral-500 dark:text-neutral-300 truncate">
            共 {stats.totalFiles} 个文件
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('p-4', className)}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
          存储空间
        </h3>
        <span className="text-xs text-neutral-500 dark:text-neutral-300">{stats.totalFiles} 个文件</span>
      </div>

      <div className="mb-4">
        <div className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          {formatFileSize(stats.totalBytes)}
        </div>
        <div className="text-sm text-neutral-500 dark:text-neutral-300">当前累计存储大小</div>
      </div>

      <div className="space-y-2">
        {categories.map((category) => (
          <StorageCategory
            key={category.key}
            label={category.label}
            count={stats.byType[category.key].count}
            value={stats.byType[category.key].bytes}
            color={category.color}
          />
        ))}
      </div>
    </div>
  );
}

interface StorageCategoryProps {
  label: string;
  count: number;
  value: number;
  color: string;
}

function StorageCategory({ label, count, value, color }: StorageCategoryProps) {
  return (
    <div className="flex items-center justify-between text-xs">
      <div className="flex items-center gap-2">
        <div className={cn('w-2 h-2 rounded-full', color)} />
        <span className="text-neutral-600 dark:text-neutral-300">{label}</span>
      </div>
      <span className="text-neutral-500 dark:text-neutral-300">{formatFileSize(value)} · {count}</span>
    </div>
  );
}

function getCategoryMeta(): Array<{ key: StorageTypeKey; label: string; color: string }> {
  return [
    { key: 'image', label: '图片', color: 'bg-pink-500' },
    { key: 'video', label: '视频', color: 'bg-purple-500' },
    { key: 'audio', label: '音频', color: 'bg-green-500' },
    { key: 'document', label: '文档', color: 'bg-blue-500' },
    { key: 'archive', label: '压缩包', color: 'bg-orange-500' },
    { key: 'code', label: '代码', color: 'bg-cyan-500' },
    { key: 'other', label: '其他', color: 'bg-neutral-500' },
  ];
}
