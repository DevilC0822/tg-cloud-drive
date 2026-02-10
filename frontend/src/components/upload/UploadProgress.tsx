import { useAtom, useAtomValue } from 'jotai';
import { X, Check, AlertCircle, ChevronDown, ChevronUp, Trash2, RotateCcw } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { uploadTasksAtom, uploadPanelExpandedAtom, isUploadingAtom } from '@/stores/uploadAtoms';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { formatFileSize } from '@/utils/formatters';
import { useUpload } from '@/hooks/useUpload';

function cn(...inputs: (string | undefined | null | boolean)[]) {
  return twMerge(clsx(inputs));
}

export function UploadProgress() {
  const uploadTasks = useAtomValue(uploadTasksAtom);
  const isUploading = useAtomValue(isUploadingAtom);
  const [expanded, setExpanded] = useAtom(uploadPanelExpandedAtom);
  const { removeTask, clearCompletedTasks, clearAllTasks, retryTask } = useUpload();

  if (uploadTasks.length === 0) return null;

  const completedCount = uploadTasks.filter((t) => t.status === 'completed').length;
  const errorCount = uploadTasks.filter((t) => t.status === 'error').length;
  const totalCount = uploadTasks.length;

  return (
    <div
      className={cn(
        'fixed bottom-4 right-4 z-40 w-80',
        'bg-white dark:bg-neutral-900',
        'rounded-2xl shadow-2xl',
        'border border-neutral-200 dark:border-neutral-700',
        'overflow-hidden animate-slideUp'
      )}
    >
      {/* 头部 */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-neutral-50 dark:bg-neutral-800 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          {isUploading ? (
            <div className="w-4 h-4 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
          ) : errorCount > 0 ? (
            <AlertCircle className="w-4 h-4 text-red-500" />
          ) : (
            <Check className="w-4 h-4 text-green-500" />
          )}
          <span className="font-medium text-sm text-neutral-900 dark:text-neutral-100">
            {isUploading
              ? `正在上传 ${totalCount - completedCount - errorCount} 个文件`
              : errorCount > 0
              ? `${errorCount} 个文件上传失败`
              : `${completedCount} 个文件上传完成`}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              clearAllTasks();
            }}
            className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300"
            title="清除全部"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-neutral-400 dark:text-neutral-500" />
          ) : (
            <ChevronUp className="w-4 h-4 text-neutral-400 dark:text-neutral-500" />
          )}
        </div>
      </div>

      {/* 任务列表 */}
      {expanded && (
        <div className="max-h-64 overflow-y-auto">
          {uploadTasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-3 px-4 py-3 border-b border-neutral-100 dark:border-neutral-800 last:border-b-0"
            >
              {/* 状态图标 */}
              <div className="flex-shrink-0">
                {task.status === 'completed' ? (
                  <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <Check className="w-4 h-4 text-green-500" />
                  </div>
                ) : task.status === 'error' ? (
                  <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>

              {/* 文件信息 */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                  {task.file.name}
                </p>
                {task.status === 'error' ? (
                  <div className="space-y-1">
                    <p className="text-xs text-red-500">{task.error || '上传失败'}</p>
                    {task.resumable && (
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                        已上传 {task.uploadedChunkCount || 0}/{task.totalChunkCount || 0} 分片
                      </p>
                    )}
                  </div>
                ) : task.status === 'completed' ? (
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">{formatFileSize(task.file.size)}</p>
                ) : (
                  <div className="mt-1 space-y-1">
                    <ProgressBar value={task.progress} size="sm" color="gold" />
                    {task.resumable && task.totalChunkCount ? (
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                        分片 {task.uploadedChunkCount || 0}/{task.totalChunkCount}
                      </p>
                    ) : null}
                  </div>
                )}
              </div>

              {/* 移除按钮 */}
              <div className="flex flex-shrink-0 items-center gap-1">
                {task.status === 'error' && (
                  <button
                    onClick={() => void retryTask(task.id)}
                    className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-[#D4AF37]"
                    title={task.resumable ? '续传重试' : '重试上传'}
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => removeTask(task.id)}
                  className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 底部操作 */}
      {expanded && completedCount > 0 && (
        <div className="px-4 py-2 bg-neutral-50 dark:bg-neutral-800 border-t border-neutral-200 dark:border-neutral-700">
          <button
            onClick={clearCompletedTasks}
            className="text-xs text-[#D4AF37] hover:underline"
          >
            清除已完成
          </button>
        </div>
      )}
    </div>
  );
}
