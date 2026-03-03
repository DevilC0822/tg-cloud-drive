import { useEffect, useMemo } from 'react';
import { ChevronUp } from 'lucide-react';
import type { DownloadTask } from '@/types';
import { ActionStatusPill, ActionTextButton } from '@/components/ui/HeroActionPrimitives';
import { ActiveTaskItem, type ActiveTaskRow } from '@/components/transfer/ActiveTaskItem';
import { includesQuery, normalizeQuery } from '@/components/transfer/transferUtils';
import { motion, AnimatePresence } from 'framer-motion';
import { springTransition } from '@/utils/animations';

export interface ActiveTaskSectionProps {
  rows: ActiveTaskRow[];
  activeDownloadTasks: DownloadTask[];
  query: string;
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onCancelDownload: (taskId: string) => void;
  onRequestCancelAllDownloads: () => void;
}

/**
 * 活跃任务区：上传/下载/种子混排，可折叠，空时自动收起。
 */
export function ActiveTaskSection({
  rows,
  activeDownloadTasks,
  query,
  open,
  onOpenChange,
  onCancelDownload,
  onRequestCancelAllDownloads,
}: ActiveTaskSectionProps) {
  const totalCount = rows.length;
  const queryNorm = useMemo(() => normalizeQuery(query), [query]);

  const displayedRows = useMemo(() => {
    if (!queryNorm) return rows;
    return rows.filter((row) => {
      if (row.kind === 'upload') return includesQuery(row.task.file.name, queryNorm);
      if (row.kind === 'download') return includesQuery(row.task.fileName, queryNorm);
      return includesQuery(`${row.task.torrentName || ''} ${row.task.infoHash || ''}`, queryNorm);
    });
  }, [queryNorm, rows]);

  useEffect(() => {
    if (totalCount === 0 && open) {
      onOpenChange(false);
    }
  }, [onOpenChange, open, totalCount]);

  return (
    <motion.section
      layout
      id="transfer-active"
      className="glass-card scroll-mt-[var(--transfer-sticky-offset)] px-4 py-4 md:scroll-mt-24 md:px-5"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">活跃任务</div>
            <ActionStatusPill tone="brand">{totalCount}</ActionStatusPill>
            {queryNorm ? (
              <ActionStatusPill>
                匹配 {displayedRows.length} / {totalCount}
              </ActionStatusPill>
            ) : null}
          </div>
          <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            上传 / 下载 / 种子任务统一展示；优先排序进行中，其次排队中。
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeDownloadTasks.length > 0 ? (
            <ActionTextButton
              tone="warning"
              density="cozy"
              onPress={onRequestCancelAllDownloads}
              className="h-10! px-3! py-0! text-sm"
            >
              全部取消（仅下载）
            </ActionTextButton>
          ) : null}
          <ActionTextButton
            tone="neutral"
            density="cozy"
            onPress={() => onOpenChange(!open)}
            trailingIcon={<motion.div animate={{ rotate: open ? 0 : 180 }}><ChevronUp className="h-4 w-4" /></motion.div>}
            className="h-10! px-3! py-0! text-sm"
          >
            {open ? '收起' : '展开'}
          </ActionTextButton>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={springTransition}
            className="overflow-hidden"
          >
            <div className="mt-4 space-y-2">
              {totalCount === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-2xl border border-dashed border-emerald-200/70 bg-white/60 px-4 py-5 text-sm text-emerald-700/80 dark:border-emerald-500/25 dark:bg-emerald-950/15 dark:text-emerald-300/80"
                >
                  暂无活跃任务。
                </motion.div>
              ) : displayedRows.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-2xl border border-dashed border-neutral-200/80 bg-white/60 px-4 py-5 text-sm text-neutral-600 dark:border-neutral-700/80 dark:bg-neutral-900/40 dark:text-neutral-300"
                >
                  当前搜索条件下没有匹配的活跃任务。
                </motion.div>
              ) : null}

              <motion.div layout className="space-y-2">
                {displayedRows.map((row) => (
                  <ActiveTaskItem key={`${row.kind}:${row.task.id}`} row={row} onCancelDownload={onCancelDownload} />
                ))}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

