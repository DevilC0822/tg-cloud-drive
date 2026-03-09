import { apiFetchJson } from "@/lib/api"

export type TorrentSourceType = "url" | "file"
export type TorrentTaskStatus = "queued" | "downloading" | "awaiting_selection" | "uploading" | "completed" | "error"
export type TorrentCleanupPolicy = "never" | "immediate" | "fixed" | "random"

export interface TorrentPreviewFile {
  fileIndex: number
  filePath: string
  fileName: string
  fileSize: number
}

export interface TorrentPreview {
  torrentName: string
  infoHash: string
  totalSize: number
  isPrivate: boolean
  trackerHosts: string[]
  files: TorrentPreviewFile[]
}

export interface TorrentTaskFile {
  fileIndex: number
  filePath: string
  fileName: string
  fileSize: number
  selected: boolean
  uploaded: boolean
  uploadedItemId?: string | null
  error?: string | null
}

export interface TorrentTaskSummary {
  id: string
  sourceType: TorrentSourceType
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
  status: TorrentTaskStatus
  error?: string | null
  startedAt?: string | null
  finishedAt?: string | null
  sourceCleanupPolicy: TorrentCleanupPolicy
  dueAt?: string | null
  sourceCleanupDone: boolean
  createdAt: string
  updatedAt: string
}

export type TorrentTask = TorrentTaskSummary

export interface TorrentTaskDetail extends TorrentTaskSummary {
  files: TorrentTaskFile[]
}

export interface TorrentTaskQuery {
  status: TorrentTaskStatus | "all"
  page: number
  pageSize: number
}

export interface TorrentTaskPagination {
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
}

export interface CreateTorrentTaskInput {
  parentId?: string | null
  torrentUrl?: string
  torrentFile?: File | null
  selectedFileIndexes?: number[]
  submittedBy?: string
}

interface TorrentTaskListResponse {
  items: TorrentTaskSummary[]
  pagination: TorrentTaskPagination
}

interface TorrentTaskDetailResponse {
  task: TorrentTaskDetail
}

interface DeleteTorrentTaskResponse {
  deleted: boolean
  taskId: string
  cleanupWarnings?: string[]
}

function normalizeTrackerHosts(trackerHosts: string[] | null | undefined) {
  return Array.isArray(trackerHosts) ? trackerHosts : []
}

function normalizeTorrentTaskFiles(files: TorrentTaskFile[] | null | undefined) {
  return Array.isArray(files) ? files : []
}

function normalizeTorrentPreviewFiles(files: TorrentPreviewFile[] | null | undefined) {
  return Array.isArray(files) ? files : []
}

function normalizeTorrentTaskSummary(task: TorrentTaskSummary) {
  return {
    ...task,
    trackerHosts: normalizeTrackerHosts(task.trackerHosts),
  }
}

function normalizeTorrentTaskDetail(task: TorrentTaskDetail) {
  return {
    ...normalizeTorrentTaskSummary(task),
    files: normalizeTorrentTaskFiles(task.files),
  }
}

function buildTorrentFormData(input: CreateTorrentTaskInput) {
  const formData = new FormData()
  const torrentUrl = input.torrentUrl?.trim() || ""
  if (input.parentId) formData.append("parentId", input.parentId)
  if (torrentUrl) formData.append("torrentUrl", torrentUrl)
  if (input.torrentFile) formData.append("torrentFile", input.torrentFile, input.torrentFile.name)
  if (input.submittedBy?.trim()) formData.append("submittedBy", input.submittedBy.trim())

  const selected = Array.from(new Set(input.selectedFileIndexes || []))
    .filter((value) => Number.isInteger(value) && value >= 0)
    .sort((a, b) => a - b)
  if (selected.length > 0) {
    formData.append("selectedFileIndexes", JSON.stringify(selected))
  }

  return formData
}

export async function previewTorrent(input: CreateTorrentTaskInput) {
  const response = await apiFetchJson<{ preview: TorrentPreview }>("/api/torrents/preview", {
    method: "POST",
    body: buildTorrentFormData(input),
  })
  return {
    ...response.preview,
    trackerHosts: normalizeTrackerHosts(response.preview.trackerHosts),
    files: normalizeTorrentPreviewFiles(response.preview.files),
  }
}

export async function createTorrentTask(input: CreateTorrentTaskInput) {
  const response = await apiFetchJson<{ task: TorrentTaskSummary }>("/api/torrents/tasks", {
    method: "POST",
    body: buildTorrentFormData(input),
  })
  return normalizeTorrentTaskSummary(response.task)
}

function createTorrentTaskSearch(query: TorrentTaskQuery) {
  const params = new URLSearchParams()
  params.set("page", String(query.page))
  params.set("pageSize", String(query.pageSize))
  if (query.status !== "all") {
    params.set("status", query.status)
  }
  return params.toString()
}

export async function fetchTorrentTasks(query: TorrentTaskQuery) {
  const search = createTorrentTaskSearch(query)
  const response = await apiFetchJson<TorrentTaskListResponse>(`/api/torrents/tasks?${search}`)
  return {
    ...response,
    items: (response.items ?? []).map(normalizeTorrentTaskSummary),
  }
}

export async function fetchTorrentTask(taskId: string) {
  const response = await apiFetchJson<TorrentTaskDetailResponse>(`/api/torrents/tasks/${encodeURIComponent(taskId)}`)
  return normalizeTorrentTaskDetail(response.task)
}

export async function deleteTorrentTask(taskId: string) {
  return apiFetchJson<DeleteTorrentTaskResponse>(`/api/torrents/tasks/${encodeURIComponent(taskId)}`, {
    method: "DELETE",
  })
}
