import { Check, AlertCircle, ChevronDown, ChevronUp, Trash2, RotateCcw, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { Dropdown as HeroDropdown, Label as HeroLabel } from '@heroui/react';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { formatFileSize } from '@/utils/formatters';
import type { UploadTask } from '@/types';
import { ActionIconButton, ActionStatusPill, type ActionTone } from '@/components/ui/HeroActionPrimitives';

export type UploadDangerAction =
  | { type: 'clear-all' }
  | { type: 'clear-completed' }
  | { type: 'remove-task'; taskId: string; taskName: string; taskStatus: UploadTask['status'] };

export type UploadSummary = {
  completedCount: number;
  errorCount: number;
  activeCount: number;
  summaryText: string;
  previewTask?: UploadTask;
};

function taskStatusLabel(status: UploadTask['status']): string {
  if (status === 'pending') return '排队中';
  if (status === 'uploading') return '上传中';
  if (status === 'completed') return '已完成';
  return '失败';
}

function taskStatusTone(status: UploadTask['status']): ActionTone {
  if (status === 'completed') return 'success';
  if (status === 'error') return 'danger';
  if (status === 'pending') return 'brand';
  return 'warning';
}

function summaryStatusTone(isUploading: boolean, errorCount: number): ActionTone {
  if (isUploading) return 'brand';
  if (errorCount > 0) return 'danger';
  return 'success';
}

function taskStateIcon(status: UploadTask['status']) {
  if (status === 'completed') {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100/90 dark:bg-emerald-900/30">
        <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-100/90 dark:bg-rose-900/30">
        <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-300" />
      </div>
    );
  }
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--theme-primary-a16)]">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--theme-primary)] border-t-transparent" />
    </div>
  );
}

function taskChunkLabel(task: UploadTask): string {
  if (!task.resumable) return '';
  const uploaded = task.uploadedChunkCount || 0;
  const total = task.totalChunkCount || 0;
  return `分片 ${uploaded}/${total}`;
}

interface UploadTaskRowProps {
  task: UploadTask;
  onRetry: (taskID: string) => void;
  onRemove: (task: UploadTask) => void;
}

function UploadTaskRow({ task, onRetry, onRemove }: UploadTaskRowProps) {
  const chunkLabel = taskChunkLabel(task);
  return (
    <div className="rounded-2xl border border-neutral-200/80 bg-white/80 px-3 py-3 shadow-[0_10px_24px_-22px_rgba(15,23,42,0.85)] dark:border-neutral-700/80 dark:bg-neutral-900/55">
      <div className="flex items-start gap-3">
        {taskStateIcon(task.status)}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">{task.file.name}</p>
            <ActionStatusPill tone={taskStatusTone(task.status)} className="shrink-0 whitespace-nowrap">
              {taskStatusLabel(task.status)}
            </ActionStatusPill>
          </div>
          <div className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">{formatFileSize(task.file.size)}</div>
          {task.status === 'error' ? <p className="mt-1 text-xs text-rose-500">{task.error || '上传失败，请重试'}</p> : null}
          {task.status === 'pending' || task.status === 'uploading' ? (
            <div className="mt-2 space-y-1.5">
              <ProgressBar value={task.progress} size="sm" color="gold" />
              {chunkLabel ? <p className="text-[11px] text-neutral-500 dark:text-neutral-400">{chunkLabel}</p> : null}
            </div>
          ) : chunkLabel ? (
            <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">{chunkLabel}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {task.status === 'error' ? (
            <ActionIconButton icon={<RotateCcw className="h-4 w-4" />} label="重试上传" tone="brand" onPress={() => onRetry(task.id)} />
          ) : null}
          <ActionIconButton icon={<X className="h-4 w-4" />} label="移除任务" tone="danger" onPress={() => onRemove(task)} />
        </div>
      </div>
    </div>
  );
}

function panelLeadingIcon(isUploading: boolean, errorCount: number) {
  if (isUploading) {
    return (
      <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--theme-primary-a35)] bg-[var(--theme-primary-a12)]">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--theme-primary)] border-t-transparent" />
      </div>
    );
  }
  if (errorCount > 0) {
    return (
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-rose-200/90 bg-rose-50 dark:border-rose-800/80 dark:bg-rose-900/25">
        <AlertCircle className="h-5 w-5 text-rose-500 dark:text-rose-300" />
      </div>
    );
  }
  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-200/90 bg-emerald-50 dark:border-emerald-800/80 dark:bg-emerald-900/25">
      <Check className="h-5 w-5 text-emerald-500 dark:text-emerald-300" />
    </div>
  );
}

export function buildUploadSummary(uploadTasks: UploadTask[], isUploading: boolean): UploadSummary {
  let completed = 0;
  let error = 0;
  let active = 0;
  for (const task of uploadTasks) {
    if (task.status === 'completed') completed += 1;
    if (task.status === 'error') error += 1;
    if (task.status === 'pending' || task.status === 'uploading') active += 1;
  }
  const summaryText = isUploading ? `进行中 ${active} 个任务` : error > 0 ? `失败 ${error} 个任务` : `完成 ${completed} 个任务`;
  const previewTask = uploadTasks.find((task) => task.status === 'uploading' || task.status === 'pending') || uploadTasks[0];
  return { completedCount: completed, errorCount: error, activeCount: active, summaryText, previewTask };
}

export function resolveDangerConfirmConfig(dangerAction: UploadDangerAction | null) {
  if (!dangerAction) return null;
  if (dangerAction.type === 'clear-all') {
    return { title: '确认清空任务列表', description: '将移除所有上传记录（进行中、失败、已完成），不会保留当前面板历史。', confirmText: '确认清空' };
  }
  if (dangerAction.type === 'clear-completed') {
    return { title: '确认清除已完成任务', description: '仅清除已完成任务，失败与进行中任务会保留。', confirmText: '确认清除' };
  }
  return {
    title: `确认移除“${dangerAction.taskName}”`,
    description: `该任务当前状态为“${taskStatusLabel(dangerAction.taskStatus)}”，移除后将不再出现在上传面板中。`,
    confirmText: '确认移除',
  };
}

interface UploadPanelHeaderProps {
  expanded: boolean;
  isUploading: boolean;
  activeCount: number;
  errorCount: number;
  completedCount: number;
  summaryText: string;
  onToggleExpand: () => void;
  onClearCompleted: () => void;
  onClearAll: () => void;
}

interface UploadHeaderStatsProps {
  isUploading: boolean;
  activeCount: number;
  errorCount: number;
  completedCount: number;
  summaryText: string;
}

function UploadHeaderStats({ isUploading, activeCount, errorCount, completedCount, summaryText }: UploadHeaderStatsProps) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {panelLeadingIcon(isUploading, errorCount)}
      <div className="min-w-0">
        <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          上传任务
          <Sparkles className="h-3.5 w-3.5 text-[var(--theme-primary)]" />
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <ActionStatusPill tone={summaryStatusTone(isUploading, errorCount)} className="whitespace-nowrap">{summaryText}</ActionStatusPill>
          <ActionStatusPill tone="brand" className="whitespace-nowrap">进行中 {activeCount}</ActionStatusPill>
          <ActionStatusPill tone={errorCount > 0 ? 'danger' : 'neutral'} className="whitespace-nowrap">失败 {errorCount}</ActionStatusPill>
          <ActionStatusPill tone="neutral" className="whitespace-nowrap">完成 {completedCount}</ActionStatusPill>
        </div>
      </div>
    </div>
  );
}

interface UploadHeaderActionsProps {
  expanded: boolean;
  completedCount: number;
  onToggleExpand: () => void;
  onClearCompleted: () => void;
  onClearAll: () => void;
}

function UploadHeaderActions({ expanded, completedCount, onToggleExpand, onClearCompleted, onClearAll }: UploadHeaderActionsProps) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <HeroDropdown>
        <HeroDropdown.Trigger>
          <ActionIconButton icon={<SlidersHorizontal className="h-4 w-4" />} label="任务操作" tone="brand" />
        </HeroDropdown.Trigger>
        <HeroDropdown.Popover className="popover-warm w-48 rounded-2xl">
          <HeroDropdown.Menu aria-label="上传任务操作" onAction={(key) => (key === 'clear-completed' ? onClearCompleted() : onClearAll())}>
            <HeroDropdown.Item id="clear-completed" textValue="清除已完成任务" isDisabled={completedCount === 0} className="rounded-xl"><Check className="h-4 w-4 text-current" /><HeroLabel>清除已完成任务</HeroLabel></HeroDropdown.Item>
            <HeroDropdown.Item id="clear-all" textValue="清空任务列表" variant="danger" className="rounded-xl"><Trash2 className="h-4 w-4 text-current" /><HeroLabel>清空任务列表</HeroLabel></HeroDropdown.Item>
          </HeroDropdown.Menu>
        </HeroDropdown.Popover>
      </HeroDropdown>
      <ActionIconButton icon={expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />} label={expanded ? '收起面板' : '展开面板'} onPress={onToggleExpand} />
    </div>
  );
}

export function UploadPanelHeader({
  expanded,
  isUploading,
  activeCount,
  errorCount,
  completedCount,
  summaryText,
  onToggleExpand,
  onClearCompleted,
  onClearAll,
}: UploadPanelHeaderProps) {
  return (
    <div className="relative overflow-hidden border-b border-neutral-200/80 px-4 py-3.5 dark:border-neutral-700/80">
      <span className="pointer-events-none absolute -top-10 -right-8 h-24 w-24 rounded-full bg-[var(--theme-primary-a16)] blur-2xl" />
      <span className="pointer-events-none absolute -bottom-12 -left-6 h-20 w-20 rounded-full bg-white/40 blur-2xl dark:bg-neutral-700/20" />
      <div className="relative flex items-start justify-between gap-3">
        <UploadHeaderStats
          isUploading={isUploading}
          activeCount={activeCount}
          errorCount={errorCount}
          completedCount={completedCount}
          summaryText={summaryText}
        />
        <UploadHeaderActions
          expanded={expanded}
          completedCount={completedCount}
          onToggleExpand={onToggleExpand}
          onClearCompleted={onClearCompleted}
          onClearAll={onClearAll}
        />
      </div>
    </div>
  );
}

interface UploadPanelBodyProps {
  expanded: boolean;
  uploadTasks: UploadTask[];
  previewTask?: UploadTask;
  onRetryTask: (taskID: string) => void;
  onRequestRemoveTask: (task: UploadTask) => void;
}

export function UploadPanelBody({ expanded, uploadTasks, previewTask, onRetryTask, onRequestRemoveTask }: UploadPanelBodyProps) {
  if (expanded) {
    return (
      <div className="max-h-[24rem] space-y-2 overflow-y-auto p-3">
        {uploadTasks.map((task) => <UploadTaskRow key={task.id} task={task} onRetry={onRetryTask} onRemove={onRequestRemoveTask} />)}
      </div>
    );
  }
  if (!previewTask) return null;
  return (
    <div className="border-t border-neutral-200/70 px-4 py-3 dark:border-neutral-700/70">
      <div className="flex items-center gap-3 rounded-2xl border border-neutral-200/80 bg-white/70 px-3 py-2 dark:border-neutral-700/80 dark:bg-neutral-900/50">
        {taskStateIcon(previewTask.status)}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">{previewTask.file.name}</p>
          <div className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">{taskStatusLabel(previewTask.status)}</div>
        </div>
        <ActionStatusPill tone={taskStatusTone(previewTask.status)} className="whitespace-nowrap">{Math.round(previewTask.progress)}%</ActionStatusPill>
      </div>
    </div>
  );
}
