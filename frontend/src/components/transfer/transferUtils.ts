import type { DownloadTask, TorrentTask, TransferHistoryItem, UploadTask } from '@/types';

export function normalizeQuery(input: string): string {
  return input.trim().toLowerCase();
}

export function includesQuery(haystack: string, queryNorm: string): boolean {
  if (!queryNorm) return true;
  return haystack.toLowerCase().includes(queryNorm);
}

export function uploadTaskStatusLabel(status: UploadTask['status']): string {
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

export function downloadTaskStatusLabel(status: DownloadTask['status']): string {
  switch (status) {
    case 'pending':
      return '排队中';
    case 'downloading':
      return '下载中';
    case 'completed':
      return '已完成';
    case 'canceled':
      return '已取消';
    default:
      return '失败';
  }
}

export function historyDirectionLabel(direction: TransferHistoryItem['direction']): string {
  return direction === 'upload' ? '上传' : '下载';
}

export function historyStatusLabel(status: TransferHistoryItem['status']): string {
  switch (status) {
    case 'completed':
      return '完成';
    case 'canceled':
      return '取消';
    default:
      return '失败';
  }
}

export function historyStatusColor(status: TransferHistoryItem['status']): string {
  switch (status) {
    case 'completed':
      return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300';
    case 'canceled':
      return 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300';
    default:
      return 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300';
  }
}

export function torrentStatusLabel(status: TorrentTask['status']): string {
  switch (status) {
    case 'queued':
      return '排队中';
    case 'downloading':
      return '下载中';
    case 'awaiting_selection':
      return '待选文件';
    case 'uploading':
      return '发送中';
    case 'completed':
      return '已完成';
    default:
      return '失败';
  }
}

export function torrentStatusColor(status: TorrentTask['status']): string {
  switch (status) {
    case 'completed':
      return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300';
    case 'error':
      return 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300';
    case 'awaiting_selection':
      return 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300';
    case 'downloading':
    case 'uploading':
      return 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300';
    default:
      return 'bg-neutral-100 text-neutral-700 dark:bg-neutral-700/60 dark:text-neutral-200';
  }
}

/**
 * 活跃任务区只展示真正“跑起来”的任务；待选文件属于待处理横幅。
 */
export function isActiveTorrentTask(task: TorrentTask): boolean {
  return task.status === 'queued' || task.status === 'downloading' || task.status === 'uploading';
}

export function parseDueAt(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export function parseDateMs(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) return null;
  return ms;
}

export function formatCleanupCountdown(dueAt: Date, nowMs: number): string {
  const diffMs = dueAt.getTime() - nowMs;
  if (diffMs <= 0) return '即将清理';

  const totalMinutes = Math.max(1, Math.ceil(diffMs / (60 * 1000)));
  if (totalMinutes < 60) return `距清理还剩 ${totalMinutes} 分钟`;

  const totalHours = Math.floor(totalMinutes / 60);
  const remainMinutes = totalMinutes % 60;
  if (totalHours < 24) {
    if (remainMinutes === 0) return `距清理还剩 ${totalHours} 小时`;
    return `距清理还剩 ${totalHours} 小时 ${remainMinutes} 分钟`;
  }

  const days = Math.floor(totalHours / 24);
  const remainHours = totalHours % 24;
  if (remainHours === 0) return `距清理还剩 ${days} 天`;
  return `距清理还剩 ${days} 天 ${remainHours} 小时`;
}

export function torrentCleanupStatus(task: TorrentTask): { label: string; className: string; dueAt: Date | null } {
  const dueAtDate = parseDueAt(task.dueAt);
  if (task.status !== 'completed') {
    return {
      label: '未进入清理',
      className: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300',
      dueAt: null,
    };
  }
  if (dueAtDate) {
    return {
      label: '待清理',
      className: 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300',
      dueAt: dueAtDate,
    };
  }
  return {
    label: '已清理',
    className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    dueAt: null,
  };
}

export function formatDurationShort(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '-';
  const totalSeconds = Math.max(1, Math.round(ms / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const remainSeconds = totalSeconds % 60;
  if (totalMinutes < 60) {
    if (remainSeconds === 0) return `${totalMinutes}m`;
    return `${totalMinutes}m ${remainSeconds}s`;
  }
  const totalHours = Math.floor(totalMinutes / 60);
  const remainMinutes = totalMinutes % 60;
  if (totalHours < 24) {
    if (remainMinutes === 0) return `${totalHours}h`;
    return `${totalHours}h ${remainMinutes}m`;
  }
  const days = Math.floor(totalHours / 24);
  const remainHours = totalHours % 24;
  if (remainHours === 0) return `${days}d`;
  return `${days}d ${remainHours}h`;
}

export function formatInfoHashShort(infoHash: string): string {
  const raw = (infoHash || '').trim();
  if (raw.length <= 12) return raw;
  const head = raw.slice(0, 4);
  const tail = raw.slice(-4);
  return `${head}...${tail}`;
}

