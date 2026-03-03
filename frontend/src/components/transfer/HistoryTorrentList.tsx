import { motion, AnimatePresence } from 'framer-motion';
import type { TorrentTask } from '@/types';
import { HistoryTorrentItem } from './HistoryTorrentItem';
import { Magnet, Inbox } from 'lucide-react';
import { staggerContainer, transitions } from '@/utils/animations';

export interface HistoryTorrentListProps {
  tasks: TorrentTask[];
  loading: boolean;
  query: string;
  nowMs: number;
  onCopyInfoHash: (infoHash: string) => void;
  onOpenSelection: (taskId: string) => void;
  onRetryTask: (taskId: string) => void | Promise<void>;
  onRequestDelete: (task: TorrentTask) => void;
}

/**
 * 种子任务列定义 (Grid Config)
 */
export const TORRENT_HISTORY_GRID = "grid-cols-[1fr_auto] md:grid-cols-[minmax(0,1fr)_160px_140px_140px_auto]";

function TableHeader() {
  return (
    <div className={`hidden md:grid ${TORRENT_HISTORY_GRID} gap-4 px-6 py-3 border-b border-neutral-200/60 dark:border-white/5`}>
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">种子信息</div>
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">下载进度</div>
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">状态</div>
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">清理详情</div>
      <div className="text-right text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">操作</div>
    </div>
  );
}

export function HistoryTorrentList({
  tasks,
  loading,
  nowMs,
  onCopyInfoHash,
  onOpenSelection,
  onRetryTask,
  onRequestDelete,
}: HistoryTorrentListProps) {
  const isEmpty = !loading && tasks.length === 0;

  return (
    <div className="flex flex-col min-h-[400px]">
      <TableHeader />

      <div className="flex-1">
        <AnimatePresence mode="popLayout">
          {loading && tasks.length === 0 ? (
            <motion.div 
              key="loading" 
              {...transitions.fadeIn}
              className="py-20 flex flex-col items-center justify-center text-neutral-400 gap-3"
            >
              <Magnet className="h-8 w-8 animate-pulse opacity-20" />
              <p className="text-xs font-bold uppercase tracking-widest">Tracking Torrents...</p>
            </motion.div>
          ) : isEmpty ? (
            <motion.div 
              key="empty" 
              {...transitions.fadeIn}
              className="py-20 flex flex-col items-center justify-center text-neutral-400 gap-3"
            >
              <Inbox className="h-8 w-8 opacity-20" />
              <p className="text-xs font-bold uppercase tracking-widest">No Active Torrents</p>
            </motion.div>
          ) : (
            <motion.div
              key="list"
              variants={staggerContainer}
              initial="initial"
              animate="animate"
            >
              {tasks.map((task) => (
                <HistoryTorrentItem
                  key={task.id}
                  task={task}
                  nowMs={nowMs}
                  onCopyInfoHash={onCopyInfoHash}
                  onOpenSelection={onOpenSelection}
                  onRetryTask={onRetryTask}
                  onRequestDelete={onRequestDelete}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
