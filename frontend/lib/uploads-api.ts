import { ApiError, type ApiErrorPayload, apiFetchJson } from "@/lib/api"
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

export interface UploadChunkProgress {
  loadedBytes: number
  totalBytes: number
}

interface UploadSessionChunkOptions {
  onUploadProgress?: (progress: UploadChunkProgress) => void
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

function buildChunkUploadError(status: number, rawBody: string) {
  const payload = parseChunkUploadPayload(rawBody)
  const message = payload?.message || `请求失败（${status}）`
  return new ApiError(message, status, payload?.error, payload)
}

function parseChunkUploadPayload(rawBody: string): ApiErrorPayload | undefined {
  if (!rawBody.trim()) {
    return undefined
  }

  try {
    const parsed = JSON.parse(rawBody)
    return parsed && typeof parsed === "object" ? (parsed as ApiErrorPayload) : undefined
  } catch {
    return undefined
  }
}

function parseChunkUploadResponse<T>(rawBody: string) {
  if (!rawBody.trim()) {
    return {} as T
  }
  return JSON.parse(rawBody) as T
}

function postUploadChunk<T>(
  path: string,
  body: FormData,
  totalBytes: number,
  onUploadProgress?: (progress: UploadChunkProgress) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("POST", path)
    xhr.withCredentials = true
    xhr.setRequestHeader("Accept", "application/json")

    xhr.upload.addEventListener("progress", (event) => {
      const nextTotalBytes = event.lengthComputable ? event.total : totalBytes
      onUploadProgress?.({
        loadedBytes: Math.min(totalBytes, event.loaded),
        totalBytes: Math.max(totalBytes, nextTotalBytes),
      })
    })

    xhr.onerror = () => reject(new Error("网络请求失败"))
    xhr.onabort = () => reject(new Error("上传已取消"))
    xhr.onload = () => {
      const rawBody = xhr.responseText || ""
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(buildChunkUploadError(xhr.status, rawBody))
        return
      }

      try {
        resolve(parseChunkUploadResponse<T>(rawBody))
      } catch (error) {
        reject(error)
      }
    }

    xhr.send(body)
  })
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

export async function uploadSessionChunk(
  sessionId: string,
  chunkIndex: number,
  chunk: Blob,
  fileName: string,
  options?: UploadSessionChunkOptions,
) {
  const formData = new FormData()
  const chunkName = `${fileName}.part${String(chunkIndex).padStart(5, "0")}`
  formData.append("chunk", chunk, chunkName)

  const response = await postUploadChunk<UploadChunkResponse>(
    `/api/uploads/${sessionId}/chunks/${chunkIndex}`,
    formData,
    chunk.size,
    options?.onUploadProgress,
  )

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
