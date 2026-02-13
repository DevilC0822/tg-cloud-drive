import type { TransferHistoryItem } from '@/types';

export type TransferHistoryTab = 'files' | 'torrents';

export type HistoryStatusFilter = 'all' | TransferHistoryItem['status'];

export type TorrentStatusFilter = 'all' | 'active' | 'awaiting_selection' | 'completed' | 'error';

export type TorrentCleanupFilter = 'all' | 'pending' | 'cleaned';

