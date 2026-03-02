import { useCallback, useMemo, useState } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { uploadTasksAtom, uploadPanelExpandedAtom, isUploadingAtom } from '@/stores/uploadAtoms';
import { useUpload } from '@/hooks/useUpload';
import { DangerActionConfirmModal } from '@/components/ui/HeroActionPrimitives';
import type { UploadTask } from '@/types';
import {
  UploadPanelBody,
  UploadPanelHeader,
  buildUploadSummary,
  resolveDangerConfirmConfig,
  type UploadDangerAction,
} from '@/components/upload/UploadProgressPanel';

interface UploadProgressCardProps {
  expanded: boolean;
  isUploading: boolean;
  uploadTasks: UploadTask[];
  summary: ReturnType<typeof buildUploadSummary>;
  onToggleExpand: () => void;
  onClearCompleted: () => void;
  onClearAll: () => void;
  onRetryTask: (taskID: string) => void;
  onRequestRemoveTask: (action: UploadDangerAction) => void;
}

function UploadProgressCard({
  expanded,
  isUploading,
  uploadTasks,
  summary,
  onToggleExpand,
  onClearCompleted,
  onClearAll,
  onRetryTask,
  onRequestRemoveTask,
}: UploadProgressCardProps) {
  return (
    <section className="animate-slideUp fixed right-2 bottom-[calc(0.5rem+env(safe-area-inset-bottom))] z-40 w-[calc(100vw-1rem)] overflow-hidden rounded-3xl border border-neutral-200/85 bg-[linear-gradient(160deg,rgba(255,255,255,0.95),rgba(251,249,246,0.94))] shadow-[0_36px_70px_-42px_rgba(15,23,42,0.9)] backdrop-blur sm:right-4 sm:bottom-[calc(1rem+env(safe-area-inset-bottom))] sm:w-[25.5rem] dark:border-neutral-700/80 dark:bg-[linear-gradient(160deg,rgba(23,23,23,0.93),rgba(17,24,39,0.92))]">
      <UploadPanelHeader
        expanded={expanded}
        isUploading={isUploading}
        activeCount={summary.activeCount}
        errorCount={summary.errorCount}
        completedCount={summary.completedCount}
        summaryText={summary.summaryText}
        onToggleExpand={onToggleExpand}
        onClearCompleted={onClearCompleted}
        onClearAll={onClearAll}
      />
      <UploadPanelBody
        expanded={expanded}
        uploadTasks={uploadTasks}
        previewTask={summary.previewTask}
        onRetryTask={onRetryTask}
        onRequestRemoveTask={(targetTask) =>
          onRequestRemoveTask({ type: 'remove-task', taskId: targetTask.id, taskName: targetTask.file.name, taskStatus: targetTask.status })
        }
      />
    </section>
  );
}

interface UploadProgressDangerModalProps {
  dangerConfirmConfig: ReturnType<typeof resolveDangerConfirmConfig>;
  onClose: () => void;
  onConfirm: () => void;
}

function UploadProgressDangerModal({ dangerConfirmConfig, onClose, onConfirm }: UploadProgressDangerModalProps) {
  return (
    <DangerActionConfirmModal
      open={Boolean(dangerConfirmConfig)}
      title={dangerConfirmConfig?.title || '确认操作'}
      description={dangerConfirmConfig?.description || ''}
      confirmText={dangerConfirmConfig?.confirmText || '确认继续'}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}

export function UploadProgress() {
  const uploadTasks = useAtomValue(uploadTasksAtom);
  const isUploading = useAtomValue(isUploadingAtom);
  const [expanded, setExpanded] = useAtom(uploadPanelExpandedAtom);
  const { removeTask, clearCompletedTasks, clearAllTasks, retryTask } = useUpload();
  const [dangerAction, setDangerAction] = useState<UploadDangerAction | null>(null);

  const summary = useMemo(() => buildUploadSummary(uploadTasks, isUploading), [isUploading, uploadTasks]);
  const dangerConfirmConfig = useMemo(() => resolveDangerConfirmConfig(dangerAction), [dangerAction]);

  const handleConfirmDangerAction = useCallback(() => {
    if (!dangerAction) return;
    if (dangerAction.type === 'clear-all') clearAllTasks();
    else if (dangerAction.type === 'clear-completed') clearCompletedTasks();
    else removeTask(dangerAction.taskId);
    setDangerAction(null);
  }, [clearAllTasks, clearCompletedTasks, dangerAction, removeTask]);

  if (uploadTasks.length === 0) return null;

  return (
    <>
      <UploadProgressCard
        expanded={expanded}
        isUploading={isUploading}
        uploadTasks={uploadTasks}
        summary={summary}
        onToggleExpand={() => setExpanded(!expanded)}
        onClearCompleted={() => setDangerAction({ type: 'clear-completed' })}
        onClearAll={() => setDangerAction({ type: 'clear-all' })}
        onRetryTask={(taskID) => {
          void retryTask(taskID);
        }}
        onRequestRemoveTask={setDangerAction}
      />
      <UploadProgressDangerModal
        dangerConfirmConfig={dangerConfirmConfig}
        onClose={() => setDangerAction(null)}
        onConfirm={handleConfirmDangerAction}
      />
    </>
  );
}
