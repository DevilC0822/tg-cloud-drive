import { apiFetchJson } from "@/lib/api"
import type { FileItem, ItemDTO } from "@/lib/files"
import { dtoToFileItem } from "@/lib/files"
import type { TransferJobSummary } from "@/lib/transfers-api"

export interface UploadSession {
  id: string
  itemId: string
  fileName: string
  fileSize: number
  chunkSize: number
  totalChunks: number
  status: string
  uploadedChunks: number[]
  uploadedCount: number
}

export interface UploadSessionProgress {
  sessionId: string
  totalChunks: number
  uploadedCount: number
  status: string
}

export interface UploadProcess {
  videoFaststartApplied: boolean
  videoFaststartFallback: boolean
  videoPreviewAttached: boolean
  videoPreviewFallback: boolean
}

interface UploadChunkResponse {
  progress: UploadSessionProgress
  uploadProcess?: UploadProcess | null
}

interface CompleteUploadResponse {
  item: ItemDTO
  uploadProcess?: UploadProcess | null
}

interface CreateUploadBatchResponse {
  batchId: string
  job?: TransferJobSummary | null
}

interface CreateUploadFolderResponse {
  batchId: string
  rootItemId: string
  job?: TransferJobSummary | null
}

interface CreateUploadSessionResponse {
  session: UploadSession
  transferJobId?: string | null
  transferJob?: TransferJobSummary | null
}

export interface UploadFolderWorkItem {
  relativePath: string
  sessionId: string
  parentItemId: string
  fileName: string
  chunkSize: number
  totalChunks: number
}

interface UploadFolderWorkResponse {
  items: UploadFolderWorkItem[]
  nextCursor?: string | null
}

function normalizeUploadProcess(input?: UploadProcess | null): UploadProcess | undefined {
  if (!input) return undefined
  return {
    videoFaststartApplied: !!input.videoFaststartApplied,
    videoFaststartFallback: !!input.videoFaststartFallback,
    videoPreviewAttached: !!input.videoPreviewAttached,
    videoPreviewFallback: !!input.videoPreviewFallback,
  }
}

export async function createUploadBatch(name: string, itemCount: number, totalSize: number) {
  const payload = { name, itemCount, totalSize }
  const response = await apiFetchJson<CreateUploadBatchResponse>("/api/uploads/batches", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  return response
}

export async function createUploadFolder(
  input: {
    parentId: string | null
    rootName: string
    directories: string[]
    files: Array<{ relativePath: string; size: number; mimeType: string | null }>
  },
) {
  const payload = {
    parentId: input.parentId,
    rootName: input.rootName,
    directories: input.directories.map((relativePath) => ({ relativePath })),
    files: input.files,
  }
  return apiFetchJson<CreateUploadFolderResponse>("/api/uploads/folders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export async function createUploadSession(file: File, parentId: string | null, transferBatchId?: string) {
  const payload = {
    parentId,
    transferBatchId: transferBatchId || null,
    name: file.name,
    mimeType: file.type || null,
    size: file.size,
  }
  const response = await apiFetchJson<CreateUploadSessionResponse>("/api/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  return response
}

export async function fetchUploadFolderWork(batchId: string, cursor?: string | null, limit = 200) {
  const params = new URLSearchParams()
  params.set("limit", String(limit))
  if (cursor) {
    params.set("cursor", cursor)
  }
  return apiFetchJson<UploadFolderWorkResponse>(`/api/uploads/folders/${encodeURIComponent(batchId)}/work?${params.toString()}`)
}

export async function fetchUploadSession(sessionId: string) {
  const response = await apiFetchJson<{ session: UploadSession }>(`/api/uploads/${sessionId}`)
  return response.session
}

export async function uploadSessionChunk(sessionId: string, chunkIndex: number, chunk: Blob, fileName: string) {
  const formData = new FormData()
  const chunkName = `${fileName}.part${String(chunkIndex).padStart(5, "0")}`
  formData.append("chunk", chunk, chunkName)

  const response = await apiFetchJson<UploadChunkResponse>(`/api/uploads/${sessionId}/chunks/${chunkIndex}`, {
    method: "POST",
    body: formData,
  })

  return {
    progress: response.progress,
    uploadProcess: normalizeUploadProcess(response.uploadProcess),
  }
}

export async function completeUploadSession(sessionId: string) {
  const response = await apiFetchJson<CompleteUploadResponse>(`/api/uploads/${sessionId}/complete`, {
    method: "POST",
  })

  return {
    item: dtoToFileItem(response.item) as FileItem,
    uploadProcess: normalizeUploadProcess(response.uploadProcess),
  }
}
