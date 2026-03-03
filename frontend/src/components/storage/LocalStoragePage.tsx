import { useCallback, useState } from 'react';
import { 
  ChevronDown, 
  ChevronUp, 
  HardDrive, 
  Loader2, 
  Trash2, 
  Info, 
  Activity, 
  Database, 
  CloudLightning,
  AlertCircle,
  CheckCircle2,
  Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ResidualFile, ResidualTask } from '@/types';
import { Pagination } from '@/components/ui/Pagination';
import { 
  ActionStatusPill, 
  ActionTextButton, 
  DangerActionConfirmModal, 
  type ActionTone 
} from '@/components/ui/HeroActionPrimitives';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useToast } from '@/hooks/useToast';
import { formatDateTime, formatFileSize } from '@/utils/formatters';
import { springTransition, staggerContainer, transitions } from '@/utils/animations';

/**
 * 辅助：简写 Hash
 */
function shortenHash(hash: string): string {
  const raw = hash.trim();
  if (raw.length <= 16) return raw || '-';
  return `${raw.slice(0, 8)}...${raw.slice(-6)}`;
}

/**
 * 状态色调映射
 */
function statusTone(status: string): ActionTone {
  if (status === 'completed') return 'success';
  if (status === 'error') return 'danger';
  if (status === 'uploading') return 'warning';
  return 'neutral';
}

/**
 * 残留文件项组件
 */
function ResidualFileItem({ file }: { file: ResidualFile }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -5 }}
      animate={{ opacity: 1, x: 0 }}
      className="group flex items-center justify-between gap-4 rounded-xl border border-neutral-200/40 bg-white/40 p-2.5 transition-all hover:border-[var(--theme-primary-a35)] hover:bg-white/60 dark:border-white/5 dark:bg-black/20 dark:hover:border-white/10 dark:hover:bg-white/5"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className={file.existsOnDisk ? "text-amber-500" : "text-neutral-400"}>
          <Database className="h-3.5 w-3.5" />
        </div>
        <span className="truncate text-xs font-medium text-neutral-700 dark:text-neutral-300">
          {file.fileName || '未知文件'}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="font-mono text-[10px] text-neutral-500">{formatFileSize(file.fileSize || 0)}</span>
        <div className={`h-1.5 w-1.5 rounded-full ${file.existsOnDisk ? 'bg-amber-500 animate-pulse' : 'bg-neutral-300 dark:bg-neutral-700'}`} />
      </div>
    </motion.div>
  );
}

/**
 * 任务项动画变体
 */
const taskItemVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: springTransition },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } }
};

interface ResidualTaskCardProps {
  task: ResidualTask;
  expanded: boolean;
  cleaning: boolean;
  onToggleExpand: (taskID: string) => void;
  onRequestCleanup: (task: ResidualTask) => void;
}

function ResidualTaskCard({ task, expanded, cleaning, onToggleExpand, onRequestCleanup }: ResidualTaskCardProps) {
  const tone = statusTone(task.status);
  
  return (
    <motion.article
      layout
      variants={taskItemVariants}
      className="group relative overflow-hidden rounded-2xl border border-neutral-200/80 bg-white/80 p-4 shadow-[0_8px_32px_-12px_rgba(15,23,42,0.1)] backdrop-blur-md transition-all sm:rounded-3xl sm:p-5 dark:border-white/5 dark:bg-neutral-900/60"
    >
      {/* 装饰性背景 */}
      <div className="absolute top-0 right-0 p-4 opacity-[0.03] pointer-events-none sm:p-6 dark:opacity-[0.05]">
        <HardDrive className="h-24 w-24 rotate-12 sm:h-32 sm:w-32" />
      </div>

      <div className="relative z-10">
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-white/5">
                <CloudLightning className={`h-5 w-5 ${tone === 'success' ? 'text-emerald-500' : 'text-amber-500'}`} />
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-sm font-bold tracking-tight text-neutral-900 sm:text-base dark:text-neutral-100">
                  {task.torrentName || '未命名任务'}
                </h3>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <ActionStatusPill tone={tone} className="px-1.5 py-0 text-[9px] uppercase font-black tracking-widest">
                    {task.status}
                  </ActionStatusPill>
                  <span className="font-mono text-[10px] text-neutral-400 hidden xs:inline">#{shortenHash(task.infoHash)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 opacity-70" />
              <span>{task.finishedAt ? formatDateTime(task.finishedAt) : '时间未知'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5 opacity-70" />
              <span className="text-amber-600 dark:text-amber-400">{task.totalResidualCount} 个残留文件</span>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <ActionTextButton
              tone="neutral"
              onPress={() => onToggleExpand(task.taskId)}
              leadingIcon={expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              className="flex-1 rounded-xl px-3 py-2 text-xs sm:flex-none sm:px-4"
            >
              {expanded ? '收起' : '详情'}
            </ActionTextButton>
            <ActionTextButton
              tone="danger"
              loading={cleaning}
              onPress={() => onRequestCleanup(task)}
              leadingIcon={<Trash2 className="h-4 w-4" />}
              className="flex-1 rounded-xl border-transparent bg-red-500/10 text-red-600 shadow-none hover:bg-red-500 hover:text-white sm:flex-none dark:bg-red-500/20 dark:text-red-400"
            >
              彻底清理
            </ActionTextButton>
          </div>
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={springTransition}
              className="overflow-hidden"
            >
              <div className="mt-5 space-y-2 rounded-2xl border border-neutral-200/60 bg-neutral-50/50 p-3 sm:p-4 dark:border-white/5 dark:bg-white/5">
                <div className="flex items-center gap-2 mb-2.5 px-1 text-[9px] font-black uppercase tracking-[0.15em] text-neutral-400">
                  <Info className="h-3 w-3" />
                  文件清单
                </div>
                <div className="grid gap-2 grid-cols-1 md:grid-cols-2">
                  {task.residualFiles.map((file, idx) => (
                    <ResidualFileItem key={idx} file={file} />
                  ))}
                  {task.residualFiles.length === 0 && (
                    <div className="col-span-full py-4 text-center text-xs text-neutral-400">
                      没有记录的具体文件路径
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.article>
  );
}

/**
 * 本地存储主页面
 */
export function LocalStoragePage() {
  const { pushToast } = useToast();
  const { items, summary, loading, pagination, setPage, setPageSize, cleanupTask } = useLocalStorage();
  const [expandedTaskIDs, setExpandedTaskIDs] = useState<Set<string>>(new Set());
  const [pendingCleanup, setPendingCleanup] = useState<ResidualTask | null>(null);
  const [cleaningTaskID, setCleaningTaskID] = useState<string | null>(null);

  const isEmpty = !loading && items.length === 0;

  const handleToggleExpand = useCallback((taskID: string) => {
    setExpandedTaskIDs((prev) => {
      const next = new Set(prev);
      if (next.has(taskID)) next.delete(taskID);
      else next.add(taskID);
      return next;
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
    pushToast({ type: result.cleaned ? 'success' : 'info', message: result.cleaned ? '清理完成' : '清理已执行' });
  }, [cleaningTaskID, cleanupTask, pendingCleanup, pushToast]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-3 py-4 md:space-y-8 md:px-8 md:py-10">
      {/* Hero Header Section */}
      <section className="relative overflow-hidden rounded-[1.5rem] border border-neutral-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.9),rgba(250,248,245,0.8))] p-5 shadow-[0_32px_64px_-24px_rgba(15,23,42,0.15)] sm:rounded-[2.5rem] sm:p-8 dark:border-white/5 dark:bg-[linear-gradient(135deg,rgba(23,23,23,0.8),rgba(15,23,42,0.7))]">
        <div className="absolute top-0 right-0 h-full w-1/3 bg-[radial-gradient(circle_at_center,var(--theme-primary-a12),transparent)] blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col gap-6 sm:gap-8 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--theme-primary)] text-neutral-900 shadow-[0_8px_20px_-6px_var(--theme-primary)] sm:h-12 sm:w-12 sm:rounded-2xl">
                <HardDrive className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight text-neutral-900 sm:text-2xl md:text-3xl dark:text-neutral-100">
                  本地存储
                </h1>
              </div>
            </div>
            <p className="max-w-md text-xs leading-relaxed text-neutral-500 sm:text-sm dark:text-neutral-400">
              智能监控服务器磁盘空间，自动化识别并清理任务上传后的残留碎片。
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:flex sm:gap-4">
            <div className="flex flex-col items-center justify-center rounded-2xl border border-neutral-200/60 bg-white/50 px-4 py-3 sm:rounded-3xl sm:px-6 sm:py-4 dark:border-white/5 dark:bg-white/5">
              <span className="text-[9px] font-black uppercase tracking-widest text-neutral-400 sm:text-[10px]">残留占用</span>
              <span className="mt-1 font-mono text-sm font-bold text-neutral-900 sm:text-xl dark:text-neutral-100">
                {formatFileSize(summary.totalResidualBytes)}
              </span>
            </div>
            <div className="flex flex-col items-center justify-center rounded-2xl border border-neutral-200/60 bg-white/50 px-4 py-3 sm:rounded-3xl sm:px-6 sm:py-4 dark:border-white/5 dark:bg-white/5">
              <span className="text-[9px] font-black uppercase tracking-widest text-neutral-400 sm:text-[10px]">qBT 状态</span>
              <div className="mt-1 flex items-center gap-1.5 sm:gap-2">
                <div className={`h-1.5 w-1.5 rounded-full ${summary.qbtAvailable ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-amber-500'} animate-pulse`} />
                <span className="text-xs font-bold text-neutral-900 sm:text-sm dark:text-neutral-100">
                  {summary.qbtAvailable ? 'CONNECTED' : 'OFFLINE'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <section className="space-y-4 md:space-y-6">
        <div className="flex items-center justify-between px-1 sm:px-2">
          <div className="flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-[var(--theme-primary)] sm:h-4 sm:w-4" />
            <h2 className="text-[11px] font-black uppercase tracking-[0.15em] text-neutral-400 sm:text-sm">活跃残留任务</h2>
          </div>
          <ActionStatusPill tone="neutral" className="font-mono text-[10px] sm:text-xs">{summary.totalTasks} TASKS</ActionStatusPill>
        </div>

        <AnimatePresence mode="wait">
          {loading && items.length === 0 ? (
            <motion.div 
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex h-64 flex-col items-center justify-center gap-4 rounded-[2.5rem] border border-dashed border-neutral-200 bg-white/40 dark:border-neutral-800 dark:bg-black/20"
            >
              <Loader2 className="h-8 w-8 animate-spin text-[var(--theme-primary)]" />
              <p className="text-sm font-medium text-neutral-500">正在扫描磁盘碎片...</p>
            </motion.div>
          ) : isEmpty ? (
            <motion.div
              key="empty"
              {...transitions.fadeIn}
              className="flex h-64 flex-col items-center justify-center gap-4 rounded-[2.5rem] border border-neutral-200 bg-white/40 dark:border-neutral-800 dark:bg-black/20"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div className="text-center">
                <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">磁盘状态极佳</h3>
                <p className="mt-1 text-sm text-neutral-500">所有任务已完美清理，暂无残留碎片。</p>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="list"
              variants={staggerContainer}
              initial="initial"
              animate="animate"
              className="space-y-4"
            >
              {items.map((task) => (
                <ResidualTaskCard
                  key={task.taskId || task.infoHash}
                  task={task}
                  expanded={expandedTaskIDs.has(task.taskId)}
                  cleaning={cleaningTaskID === task.taskId}
                  onToggleExpand={handleToggleExpand}
                  onRequestCleanup={(t) => setPendingCleanup(t)}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {!isEmpty && items.length > 0 && (
          <div className="flex justify-center pt-4">
            <Pagination
              page={pagination.page}
              pageSize={pagination.pageSize}
              totalCount={pagination.totalCount}
              totalPages={pagination.totalPages}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        )}
      </section>

      {/* Footer Info */}
      <footer className="flex items-start gap-3 rounded-2xl bg-brand-500/5 p-4 text-xs leading-relaxed text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        <p>
          提示：本地存储仅列出那些在 qBittorrent 中已标记为完成或报错，但磁盘上仍存在文件的任务。
          彻底清理将从 qBT 中移除任务记录并物理删除服务器上的相关文件。此操作不可撤销。
        </p>
      </footer>

      {/* Confirmation Modal */}
      <DangerActionConfirmModal
        open={!!pendingCleanup}
        title="确认彻底清理？"
        description={`将从磁盘永久删除“${pendingCleanup?.torrentName || '该任务'}”的所有残留文件（约 ${formatFileSize(pendingCleanup?.totalResidualBytes || 0)}），并移除 qBT 记录。`}
        confirmText="立即执行清理"
        onClose={() => setPendingCleanup(null)}
        onConfirm={() => {
          void handleConfirmCleanup();
        }}
      />
    </div>
  );
}
