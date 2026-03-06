import { apiFetchJson } from "@/lib/api"

export type TransferDirection = "upload" | "download"
export type TransferSourceKind = "upload_session" | "upload_batch" | "torrent_task" | "download_task"
export type TransferJobStatus = "running" | "completed" | "error" | "canceled"
export type TransferPhase =
  | "uploading_chunks"
  | "finalizing"
  | "downloading"
  | "queued"
  | "torrent_downloading"
  | "awaiting_selection"
  | "torrent_uploading"
  | ""

export type TransferStreamStatus = "connected" | "reconnecting" | "error"

export interface TransferProgress {
  percent: number
  current: number
  total: number
  unit: string
}

export interface TransferPreviewItem {
  id: string
  name: string
  status: string
  percent: number
  error?: string | null
}

export interface TransferJobSummary {
  id: string
  direction: TransferDirection
  sourceKind: TransferSourceKind
  sourceRef: string
  unitKind: string
  name: string
  targetItemId?: string | null
  totalSize: number
  itemCount: number
  completedCount: number
  errorCount: number
  canceledCount: number
  status: TransferJobStatus
  lastError?: string | null
  startedAt: string
  finishedAt: string
  createdAt: string
  updatedAt: string
  phase: TransferPhase
  progress: TransferProgress
  previewItems: TransferPreviewItem[]
}

export interface TransferUploadSessionItem {
  id: string
  itemId: string
  fileName: string
  fileSize: number
  status: string
  updatedAt: string
  phase: TransferPhase
  progress: TransferProgress
  uploadedCount: number
  totalChunks: number
}

export interface TransferUploadSessionDetail {
  session: TransferUploadSessionItem
  uploadedChunks: number[]
  missingChunks: number[]
}

export interface TransferUploadBatchDetail {
  sessions: TransferUploadSessionItem[]
}

export interface TransferTorrentTaskFile {
  fileIndex: number
  filePath: string
  fileName: string
  fileSize: number
  selected: boolean
  uploaded: boolean
  uploadedItemId?: string | null
  error?: string | null
}

export interface TransferTorrentTaskDetail {
  id: string
  sourceType: "url" | "file"
  sourceUrl?: string | null
  torrentName: string
  infoHash: string
  targetChatId: string
  targetParentId?: string | null
  submittedBy: string
  estimatedSize: number
  downloadedBytes: number
  progress: number
  isPrivate: boolean
  trackerHosts: string[]
  status: string
  error?: string | null
  startedAt?: string | null
  finishedAt?: string | null
  sourceCleanupPolicy: string
  dueAt?: string | null
  sourceCleanupDone: boolean
  createdAt: string
  updatedAt: string
  files: TransferTorrentTaskFile[]
}

export interface TransferDownloadDetail {
  itemId?: string | null
  fileName: string
  phase: TransferPhase
  progress: TransferProgress
}

export interface TransferJobDetail {
  item: TransferJobSummary
  uploadSession?: TransferUploadSessionDetail | null
  uploadBatch?: TransferUploadBatchDetail | null
  torrentTask?: TransferTorrentTaskDetail | null
  downloadTask?: TransferDownloadDetail | null
}

export interface TransferHistoryQuery {
  direction: TransferDirection | "all"
  status: TransferJobStatus | "all"
  sourceKind: TransferSourceKind | "all"
  q: string
  page: number
  pageSize: number
}

export interface TransferHistoryPagination {
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
}

export interface TransferStreamEvent {
  type: "job_upsert" | "job_remove" | "history_upsert" | "history_remove"
  id?: string
  item?: TransferJobSummary
}

interface TransferListResponse {
  items: TransferJobSummary[]
}

interface TransferHistoryResponse extends TransferListResponse {
  pagination: TransferHistoryPagination
}

interface StartDownloadTransferResponse {
  transferJobId: string
  downloadUrl: string
  job: TransferJobSummary
}

type TransferStreamHandlers = {
  onEvent: (event: TransferStreamEvent) => void
  onStatusChange: (status: TransferStreamStatus) => void
}

function createHistorySearch(query: TransferHistoryQuery) {
  const params = new URLSearchParams()
  params.set("page", String(query.page))
  params.set("pageSize", String(query.pageSize))
  if (query.direction !== "all") params.set("direction", query.direction)
  if (query.status !== "all") params.set("status", query.status)
  if (query.sourceKind !== "all") params.set("sourceKind", query.sourceKind)
  if (query.q.trim()) params.set("q", query.q.trim())
  return params.toString()
}

export async function fetchActiveTransfers() {
  const response = await apiFetchJson<TransferListResponse>("/api/transfers/active")
  return response.items ?? []
}

export async function fetchTransferHistory(query: TransferHistoryQuery) {
  const response = await apiFetchJson<TransferHistoryResponse>(`/api/transfers/history?${createHistorySearch(query)}`)
  return {
    items: response.items ?? [],
    pagination: response.pagination,
  }
}

export async function fetchTransferDetail(transferId: string) {
  return apiFetchJson<TransferJobDetail>(`/api/transfers/${encodeURIComponent(transferId)}`)
}

export async function deleteTransferHistoryItem(transferId: string) {
  await apiFetchJson<{ ok: boolean }>(`/api/transfers/history/${encodeURIComponent(transferId)}`, {
    method: "DELETE",
  })
}

export async function startDownloadTransfer(itemId: string) {
  return apiFetchJson<StartDownloadTransferResponse>("/api/transfers/downloads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ itemId }),
  })
}

export function connectTransferStream(handlers: TransferStreamHandlers) {
  const source = new EventSource("/api/transfers/stream", { withCredentials: true })

  source.onopen = () => {
    handlers.onStatusChange("connected")
  }

  source.onmessage = (message) => {
    try {
      const event = JSON.parse(message.data) as TransferStreamEvent
      handlers.onEvent(event)
    } catch {
      handlers.onStatusChange("error")
    }
  }

  source.onerror = () => {
    handlers.onStatusChange("reconnecting")
  }

  return () => {
    source.close()
  }
}
