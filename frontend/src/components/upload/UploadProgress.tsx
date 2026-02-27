import { useCallback, useMemo, useState } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { X, Check, AlertCircle, ChevronDown, ChevronUp, Trash2, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { Dropdown as HeroDropdown, Label as HeroLabel } from '@heroui/react';
import { uploadTasksAtom, uploadPanelExpandedAtom, isUploadingAtom } from '@/stores/uploadAtoms';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { formatFileSize } from '@/utils/formatters';
import { useUpload } from '@/hooks/useUpload';
import type { UploadTask } from '@/types';
import {
  ActionIconButton,
  ActionStatusPill,
  DangerActionConfirmModal,
  type ActionTone,
} from '@/components/ui/HeroActionPrimitives';

type DangerAction =
  | { type: 'clear-all' }
  | { type: 'clear-completed' }
  | { type: 'remove-task'; taskId: string; taskName: string; taskStatus: UploadTask['status'] };

function taskStatusLabel(status: UploadTask['status']): string {
  switch (status) {
    case 'pending':
      return '排队中';
    case 'uploading':
      return '上传中';
    case 'completed':
      return '已完成';
    default:
      return '失败';
  }
}

function taskStatusTone(status: UploadTask['status']): ActionTone {
  switch (status) {
    case 'completed':
      return 'success';
    case 'error':
      return 'danger';
    case 'pending':
      return 'brand';
    default:
      return 'warning';
  }
}

function summaryStatusTone(isUploading: boolean, errorCount: number): ActionTone {
  if (isUploading) return 'brand';
  if (errorCount > 0) return 'danger';
  return 'success';
}

export function UploadProgress() {
  const uploadTasks = useAtomValue(uploadTasksAtom);
  const isUploading = useAtomValue(isUploadingAtom);
  const [expanded, setExpanded] = useAtom(uploadPanelExpandedAtom);
  const { removeTask, clearCompletedTasks, clearAllTasks, retryTask } = useUpload();
  const [dangerAction, setDangerAction] = useState<DangerAction | null>(null);

  const completedCount = uploadTasks.filter((t) => t.status === 'completed').length;
  const errorCount = uploadTasks.filter((t) => t.status === 'error').length;
  const activeCount = uploadTasks.filter((t) => t.status === 'pending' || t.status === 'uploading').length;

  const summaryText = isUploading
    ? `进行中 ${activeCount} 个任务`
    : errorCount > 0
      ? `失败 ${errorCount} 个任务`
      : `完成 ${completedCount} 个任务`;

  const dangerConfirmConfig = useMemo(() => {
    if (!dangerAction) return null;

    if (dangerAction.type === 'clear-all') {
      return {
        title: '确认清空任务列表',
        description: '将移除所有上传记录（进行中、失败、已完成），不会保留当前面板历史。',
        confirmText: '确认清空',
      };
    }

    if (dangerAction.type === 'clear-completed') {
      return {
        title: '确认清除已完成任务',
        description: '仅清除已完成任务，失败与进行中任务会保留。',
        confirmText: '确认清除',
      };
    }

    const statusLabel = taskStatusLabel(dangerAction.taskStatus);
    return {
      title: `确认移除“${dangerAction.taskName}”`,
      description: `该任务当前状态为“${statusLabel}”，移除后将不再出现在上传面板中。`,
      confirmText: '确认移除',
    };
  }, [dangerAction]);

  const handleConfirmDangerAction = useCallback(() => {
    if (!dangerAction) return;

    if (dangerAction.type === 'clear-all') {
      clearAllTasks();
      setDangerAction(null);
      return;
    }

    if (dangerAction.type === 'clear-completed') {
      clearCompletedTasks();
      setDangerAction(null);
      return;
    }

    removeTask(dangerAction.taskId);
    setDangerAction(null);
  }, [clearAllTasks, clearCompletedTasks, dangerAction, removeTask]);

  if (uploadTasks.length === 0) return null;

  return (
    <>
      <div
        className={
          'animate-slideUp fixed right-4 bottom-4 z-40 w-[22rem] overflow-hidden rounded-2xl border border-neutral-200/80 bg-white/92 shadow-[0_24px_52px_-36px_rgba(15,23,42,0.55)] dark:border-neutral-700/80 dark:bg-neutral-900/88'
        }
      >
        <div className="flex items-center justify-between border-b border-neutral-200/80 bg-neutral-50/90 px-4 py-3 dark:border-neutral-700/80 dark:bg-neutral-800/90">
          <div className="flex items-center gap-2">
            {isUploading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--theme-primary)] border-t-transparent" />
            ) : errorCount > 0 ? (
              <AlertCircle className="h-4 w-4 text-red-500" />
            ) : (
              <Check className="h-4 w-4 text-green-500" />
            )}
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">上传任务</span>
              <ActionStatusPill tone={summaryStatusTone(isUploading, errorCount)}>{summaryText}</ActionStatusPill>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <HeroDropdown>
              <HeroDropdown.Trigger>
                <ActionIconButton icon={<SlidersHorizontal className="h-4 w-4" />} label="任务操作" tone="brand" />
              </HeroDropdown.Trigger>
              <HeroDropdown.Popover className="w-48 rounded-2xl border border-white/50 bg-white/40 shadow-[0_16px_40px_-16px_rgba(15,23,42,0.2)] backdrop-blur-xl dark:border-white/10 dark:bg-black/40 dark:shadow-[0_16px_40px_-16px_rgba(0,0,0,0.5)]">
                <HeroDropdown.Menu
                  aria-label="上传任务操作"
                  onAction={(key) => {
                    if (key === 'clear-completed') {
                      setDangerAction({ type: 'clear-completed' });
                    }
                    if (key === 'clear-all') {
                      setDangerAction({ type: 'clear-all' });
                    }
                  }}
                >
                  <HeroDropdown.Item
                    id="clear-completed"
                    textValue="清除已完成任务"
                    isDisabled={completedCount === 0}
                    className="rounded-xl transition-colors duration-200 data-[hover=true]:bg-white/60 data-[hover=true]:text-neutral-900 dark:data-[hover=true]:bg-white/10 dark:data-[hover=true]:text-white"
                  >
                    <Check className="h-4 w-4 text-current" />
                    <HeroLabel>清除已完成任务</HeroLabel>
                  </HeroDropdown.Item>
                  <HeroDropdown.Item
                    id="clear-all"
                    textValue="清空任务列表"
                    variant="danger"
                    className="rounded-xl transition-colors duration-200 data-[hover=true]:bg-white/60 data-[hover=true]:text-neutral-900 dark:data-[hover=true]:bg-white/10 dark:data-[hover=true]:text-white"
                  >
                    <Trash2 className="h-4 w-4 text-current" />
                    <HeroLabel>清空任务列表</HeroLabel>
                  </HeroDropdown.Item>
                </HeroDropdown.Menu>
              </HeroDropdown.Popover>
            </HeroDropdown>

            <ActionIconButton
              icon={expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              label={expanded ? '收起面板' : '展开面板'}
              onPress={() => setExpanded(!expanded)}
            />
          </div>
        </div>

        {expanded && (
          <div className="max-h-80 overflow-y-auto">
            {uploadTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-3 border-b border-neutral-100/80 px-4 py-3 last:border-b-0 dark:border-neutral-800/80"
              >
                <div className="flex-shrink-0">
                  {task.status === 'completed' ? (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                      <Check className="h-4 w-4 text-green-500" />
                    </div>
                  ) : task.status === 'error' ? (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    </div>
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--theme-primary)] border-t-transparent" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      {task.file.name}
                    </p>
                    <ActionStatusPill tone={taskStatusTone(task.status)}>
                      {taskStatusLabel(task.status)}
                    </ActionStatusPill>
                  </div>

                  {task.status === 'error' ? (
                    <div className="mt-1 space-y-1">
                      <p className="text-xs text-red-500">{task.error || '上传失败，请重试'}</p>
                      {task.resumable ? (
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                          已上传 {task.uploadedChunkCount || 0}/{task.totalChunkCount || 0} 分片
                        </p>
                      ) : null}
                    </div>
                  ) : task.status === 'completed' ? (
                    <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                      {formatFileSize(task.file.size)}
                    </p>
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

                <div className="flex flex-shrink-0 items-center gap-1">
                  {task.status === 'error' ? (
                    <ActionIconButton
                      icon={<RotateCcw className="h-4 w-4" />}
                      label={task.resumable ? '续传重试' : '重试上传'}
                      tone="brand"
                      onPress={() => {
                        void retryTask(task.id);
                      }}
                    />
                  ) : null}

                  <ActionIconButton
                    icon={<X className="h-4 w-4" />}
                    label="移除任务"
                    tone="danger"
                    onPress={() => {
                      setDangerAction({
                        type: 'remove-task',
                        taskId: task.id,
                        taskName: task.file.name,
                        taskStatus: task.status,
                      });
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <DangerActionConfirmModal
        open={Boolean(dangerConfirmConfig)}
        title={dangerConfirmConfig?.title || '确认操作'}
        description={dangerConfirmConfig?.description || ''}
        confirmText={dangerConfirmConfig?.confirmText || '确认继续'}
        onClose={() => setDangerAction(null)}
        onConfirm={handleConfirmDangerAction}
      />
    </>
  );
}
