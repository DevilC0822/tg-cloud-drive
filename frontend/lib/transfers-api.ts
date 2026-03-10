import { apiFetchJson } from "@/lib/api"
import {
  normalizeTransferJobDetail,
  normalizeTransferJobSummary,
} from "@/lib/transfer-normalizers"

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
export type TransferPhaseProgressMode = "determinate" | "indeterminate" | "discrete"

export interface TransferProgress {
  percent: number
  current: number
  total: number
  unit: string
}

export interface TransferPreviewItem {
  id: string
  name: string
  relativePath?: string | null
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
  batchMode?: "flat" | "folder"
  directoryCount?: number
  activeCount?: number
  phase: TransferPhase
  phaseDetail?: string | null
  phaseSteps?: string[] | null
  phaseProgress?: TransferProgress | null
  phaseProgressMode?: TransferPhaseProgressMode | null
  phaseSpeedBytesPerSecond?: number | null
  phaseStartedAt?: string | null
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

export interface TransferFolderUploadDetail {
  rootItemId: string
  rootName: string
  directoryCount: number
  fileCount: number
  completedCount: number
  failedCount: number
  activeCount: number
  totalSize: number
}

export interface TransferFolderEntry {
  relativePath: string
  name: string
  entryType: "folder" | "file"
  status: "pending" | "uploading" | "completed" | "failed"
  progress: TransferProgress
  size: number
  completedCount: number
  failedCount: number
  activeCount: number
  hasChildren: boolean
  error?: string | null
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
  folderUpload?: TransferFolderUploadDetail | null
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
  type: "active_snapshot" | "job_upsert" | "job_remove" | "history_upsert" | "history_remove"
  id?: string
  item?: TransferJobSummary
  items?: TransferJobSummary[]
}

interface TransferHistoryResponse {
  items: TransferJobSummary[]
  pagination: TransferHistoryPagination
}

interface TransferFolderEntriesResponse {
  items: TransferFolderEntry[]
}

interface StartDownloadTransferResponse {
  transferJobId: string
  downloadUrl: string
  job: TransferJobSummary
}

const historyRequestCache = new Map<string, Promise<{
  items: TransferJobSummary[]
  pagination: TransferHistoryPagination
}>>()

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
export async function fetchTransferHistory(query: TransferHistoryQuery) {
  const path = `/api/transfers/history?${createHistorySearch(query)}`
  const cached = historyRequestCache.get(path)
  if (cached) {
    return cached
  }

  const request = apiFetchJson<TransferHistoryResponse>(path)
    .then((response) => ({
      items: (response.items ?? []).map(normalizeTransferJobSummary),
      pagination: response.pagination,
    }))
    .finally(() => {
      historyRequestCache.delete(path)
    })

  historyRequestCache.set(path, request)
  return request
}
export async function fetchTransferDetail(transferId: string) {
  const response = await apiFetchJson<TransferJobDetail>(`/api/transfers/${encodeURIComponent(transferId)}`)
  return normalizeTransferJobDetail(response)
}
export async function fetchTransferEntries(transferId: string, parentPath = "") {
  const params = new URLSearchParams()
  if (parentPath.trim()) {
    params.set("parentPath", parentPath)
  }
  const suffix = params.toString() ? `?${params.toString()}` : ""
  const response = await apiFetchJson<TransferFolderEntriesResponse>(`/api/transfers/${encodeURIComponent(transferId)}/entries${suffix}`)
  return response.items ?? []
}
export async function deleteTransferHistoryItem(transferId: string) {
  await apiFetchJson<{ ok: boolean }>(`/api/transfers/history/${encodeURIComponent(transferId)}`, {
    method: "DELETE",
  })
}

export async function deleteActiveTransfer(transferId: string) {
  return apiFetchJson<{
    ok: boolean
    telegramCleanup?: {
      attempted: number
      deleted: number
      replaced: number
      failed: number
      errors?: Array<{
        chatId: string
        messageId: number
        error: string
      }>
    }
  }>(`/api/transfers/${encodeURIComponent(transferId)}`, {
    method: "DELETE",
  })
}
export async function startDownloadTransfer(itemId: string) {
  const response = await apiFetchJson<StartDownloadTransferResponse>("/api/transfers/downloads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ itemId }),
  })
  return {
    ...response,
    job: normalizeTransferJobSummary(response.job),
  }
}

export { connectTransferStream } from "./transfers-stream"
