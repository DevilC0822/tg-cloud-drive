import { useCallback, useState } from 'react';
import { ChevronDown, ChevronUp, HardDrive, Loader2, Trash2 } from 'lucide-react';
import type { ResidualFile, ResidualTask } from '@/types';
import { Pagination } from '@/components/ui/Pagination';
import { ActionStatusPill, ActionTextButton, DangerActionConfirmModal, type ActionTone } from '@/components/ui/HeroActionPrimitives';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useToast } from '@/hooks/useToast';
import { formatDateTime, formatFileSize } from '@/utils/formatters';

type PendingCleanup = {
  taskId: string;
  torrentName: string;
  totalResidualBytes: number;
};

function shortenHash(hash: string): string {
  const raw = hash.trim();
  if (raw.length <= 16) return raw || '-';
  return `${raw.slice(0, 8)}...${raw.slice(-6)}`;
}

function statusTone(status: string): ActionTone {
  if (status === 'completed') return 'success';
  if (status === 'error') return 'danger';
  if (status === 'uploading') return 'warning';
  return 'neutral';
}

function statusLabel(status: string): string {
  if (status === 'completed') return '已完成';
  if (status === 'uploading') return '上传中';
  if (status === 'error') return '异常';
  return status || '未知';
}

function renderFinishedAt(raw: string | null): string {
  if (!raw) return '未记录';
  return formatDateTime(raw);
}

function ResidualFiles({ files }: { files: ResidualFile[] }) {
  if (files.length === 0) {
    return <div className="text-xs text-neutral-500 dark:text-neutral-400">未记录任务文件</div>;
  }

  return (
    <div className="space-y-2">
      {files.map((file, index) => (
        <div
          key={`${file.fileName}:${index}`}
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-200/70 bg-white/60 px-3 py-2 dark:border-neutral-700/70 dark:bg-neutral-900/45"
        >
          <div className="min-w-0 flex-1 text-sm text-neutral-700 dark:text-neutral-200">{file.fileName || '-'}</div>
          <div className="flex items-center gap-2 text-xs">
            <ActionStatusPill tone={file.existsOnDisk ? 'warning' : 'neutral'}>
              {file.existsOnDisk ? '磁盘存在' : '已删除'}
            </ActionStatusPill>
            <span className="text-neutral-500 dark:text-neutral-400">{formatFileSize(file.fileSize || 0)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

interface ResidualTaskCardProps {
  task: ResidualTask;
  expanded: boolean;
  cleaning: boolean;
  onToggleExpand: (taskID: string) => void;
  onRequestCleanup: (task: ResidualTask) => void;
}

function ResidualTaskCard({ task, expanded, cleaning, onToggleExpand, onRequestCleanup }: ResidualTaskCardProps) {
  return (
    <article className="rounded-2xl border border-neutral-200/80 bg-white/92 p-4 shadow-[0_12px_30px_-24px_rgba(15,23,42,0.6)] dark:border-neutral-700/80 dark:bg-neutral-900/72">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="max-w-full truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">{task.torrentName || '未命名任务'}</h3>
            <ActionStatusPill tone={statusTone(task.status)}>{statusLabel(task.status)}</ActionStatusPill>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
            <span>InfoHash: {shortenHash(task.infoHash)}</span>
            <span>完成时间: {renderFinishedAt(task.finishedAt)}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <ActionStatusPill tone={task.totalResidualCount > 0 ? 'warning' : 'neutral'}>
              残留文件 {task.totalResidualCount}
            </ActionStatusPill>
            <ActionStatusPill tone={task.totalResidualBytes > 0 ? 'warning' : 'neutral'}>
              占用 {formatFileSize(task.totalResidualBytes)}
            </ActionStatusPill>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <ActionTextButton
            onPress={() => onToggleExpand(task.taskId)}
            leadingIcon={expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          >
            {expanded ? '收起文件' : '查看文件'}
          </ActionTextButton>
          <ActionTextButton
            tone="danger"
            loading={cleaning}
            onPress={() => onRequestCleanup(task)}
            leadingIcon={<Trash2 className="h-4 w-4" />}
          >
            清理
          </ActionTextButton>
        </div>
      </div>

      {expanded ? (
        <div className="mt-4 rounded-xl border border-neutral-200/80 bg-neutral-50/80 p-3 dark:border-neutral-700/70 dark:bg-neutral-900/40">
          <ResidualFiles files={task.residualFiles} />
        </div>
      ) : null}
    </article>
  );
}

export function LocalStoragePage() {
  const { pushToast } = useToast();
  const { items, summary, loading, pagination, setPage, setPageSize, cleanupTask } = useLocalStorage();
  const [expandedTaskIDs, setExpandedTaskIDs] = useState<Set<string>>(() => new Set<string>());
  const [pendingCleanup, setPendingCleanup] = useState<PendingCleanup | null>(null);
  const [cleaningTaskID, setCleaningTaskID] = useState<string | null>(null);

  const isEmpty = !loading && items.length === 0;
  const qbtTone: ActionTone = summary.qbtAvailable ? 'success' : 'warning';
  const qbtLabel = summary.qbtAvailable ? 'qBT 在线' : 'qBT 不可用';

  const handleToggleExpand = useCallback((taskID: string) => {
    setExpandedTaskIDs((prev) => {
      const next = new Set(prev);
      if (next.has(taskID)) {
        next.delete(taskID);
      } else {
        next.add(taskID);
      }
      return next;
    });
  }, []);

  const handleRequestCleanup = useCallback((task: ResidualTask) => {
    setPendingCleanup({
      taskId: task.taskId,
      torrentName: task.torrentName || '未命名任务',
      totalResidualBytes: task.totalResidualBytes,
    });
  }, []);

  const handleConfirmCleanup = useCallback(async () => {
    if (!pendingCleanup || cleaningTaskID) return;

    const target = pendingCleanup;
    setPendingCleanup(null);
    setCleaningTaskID(target.taskId);
    const result = await cleanupTask(target.taskId);
    setCleaningTaskID(null);

    if (!result.ok) {
      pushToast({ type: 'error', message: result.reason || '清理失败' });
      return;
    }

    if (result.cleaned) {
      pushToast({ type: 'success', message: '清理完成' });
    } else {
      pushToast({ type: 'info', message: '清理已执行，但仍存在残留' });
    }

    if (result.warnings.length > 0) {
      pushToast({ type: 'info', message: result.warnings[0] });
    }
  }, [cleaningTaskID, cleanupTask, pendingCleanup, pushToast]);

  return (
    <div className="space-y-4 px-3 py-3 md:px-5 md:py-4">
      <section className="rounded-2xl border border-neutral-200/80 bg-white/92 p-4 shadow-[0_12px_30px_-24px_rgba(15,23,42,0.6)] dark:border-neutral-700/80 dark:bg-neutral-900/72">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <h1 className="inline-flex items-center gap-2 text-base font-semibold text-neutral-900 md:text-lg dark:text-neutral-100">
              <HardDrive className="h-4 w-4 text-neutral-500 md:h-5 md:w-5 dark:text-neutral-400" />
              本地存储
            </h1>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">管理 Torrent 上传后未清理的服务器本地文件</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ActionStatusPill tone={summary.totalTasks > 0 ? 'warning' : 'success'}>残留任务 {summary.totalTasks}</ActionStatusPill>
            <ActionStatusPill tone={summary.totalResidualBytes > 0 ? 'warning' : 'success'}>
              占用 {formatFileSize(summary.totalResidualBytes)}
            </ActionStatusPill>
            <ActionStatusPill tone={qbtTone}>{qbtLabel}</ActionStatusPill>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        {loading && items.length === 0 ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-neutral-300/80 bg-white/70 px-4 py-10 text-sm text-neutral-500 dark:border-neutral-700/80 dark:bg-neutral-900/40 dark:text-neutral-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            正在加载本地残留任务...
          </div>
        ) : null}

        {isEmpty ? (
          <div className="rounded-2xl border border-dashed border-emerald-300/60 bg-emerald-50/70 px-4 py-10 text-center text-sm text-emerald-700 dark:border-emerald-700/60 dark:bg-emerald-900/20 dark:text-emerald-300">
            服务器本地存储干净
          </div>
        ) : null}

        {items.map((task) => (
          <ResidualTaskCard
            key={task.taskId}
            task={task}
            expanded={expandedTaskIDs.has(task.taskId)}
            cleaning={cleaningTaskID === task.taskId}
            onToggleExpand={handleToggleExpand}
            onRequestCleanup={handleRequestCleanup}
          />
        ))}
      </section>

      {!isEmpty ? (
        <Pagination
          page={pagination.page}
          pageSize={pagination.pageSize}
          totalCount={pagination.totalCount}
          totalPages={pagination.totalPages}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      ) : null}

      <DangerActionConfirmModal
        open={!!pendingCleanup}
        title={`确认清理任务“${pendingCleanup?.torrentName || ''}”`}
        description={`将尝试清理本地残留文件（约 ${formatFileSize(pendingCleanup?.totalResidualBytes || 0)}），并删除 qBittorrent 记录。`}
        confirmText="确认清理"
        onClose={() => setPendingCleanup(null)}
        onConfirm={() => {
          void handleConfirmCleanup();
        }}
      />
    </div>
  );
}
