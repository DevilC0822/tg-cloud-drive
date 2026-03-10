import type { UploadProcess } from "@/lib/uploads-api"
import type { LocalFolderManifest } from "@/lib/upload-folder-manifest"
import type { UploadTask } from "@/stores/upload-atoms"

export const DEFAULT_UPLOAD_CONCURRENCY = 4
const MIN_UPLOAD_CONCURRENCY = 1

export type UpdateUploadTask = (
  taskId: string,
  updater: (prev: UploadTask) => UploadTask,
) => void

export function normalizeUploadConcurrency(value: number | undefined) {
  if (!Number.isInteger(value) || value == null || value < MIN_UPLOAD_CONCURRENCY) {
    return DEFAULT_UPLOAD_CONCURRENCY
  }
  return value
}

export function resolveWorkerCount(limit: number, size: number) {
  return Math.min(normalizeUploadConcurrency(limit), Math.max(size, MIN_UPLOAD_CONCURRENCY))
}

export function createUploadTask(file: File): UploadTask {
  const now = Date.now()
  return {
    id: `${now}-${Math.random().toString(16).slice(2, 10)}`,
    kind: "file",
    displayName: file.name,
    file,
    totalBytes: file.size,
    progress: 0,
    status: "pending",
    startedAt: now,
    updatedAt: now,
    transferredBytes: 0,
    currentSpeedBytesPerSecond: 0,
  }
}

export function createFolderUploadTask(folder: LocalFolderManifest): UploadTask {
  const now = Date.now()
  return {
    id: `${now}-${Math.random().toString(16).slice(2, 10)}`,
    kind: "folder",
    displayName: folder.rootName,
    totalBytes: folder.totalSize,
    progress: 0,
    status: "pending",
    startedAt: now,
    updatedAt: now,
    transferredBytes: 0,
    currentSpeedBytesPerSecond: 0,
    completedItems: 0,
    totalItems: folder.files.length,
  }
}

export function applyUploadProcess(task: UploadTask, process?: UploadProcess) {
  if (!process) return task
  return {
    ...task,
    error: process.videoFaststartFallback ? "Uploaded with fallback pipeline" : task.error,
  }
}

export function toUploadErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function resolveTransferredBytesFromChunks(uploadedChunks: number[], chunkSize: number, totalBytes: number) {
  return uploadedChunks.reduce((sum, chunkIndex) => {
    const from = chunkIndex * chunkSize
    const to = Math.min(totalBytes, from + chunkSize)
    return sum + Math.max(0, to - from)
  }, 0)
}

function resolveTaskProgressPercent(transferredBytes: number, totalBytes: number, totalChunks?: number, uploadedCount?: number) {
  if (totalBytes > 0) {
    return Math.min(99, Math.round((transferredBytes / totalBytes) * 100))
  }
  if (totalChunks && totalChunks > 0 && uploadedCount != null) {
    return Math.min(99, Math.round((uploadedCount / totalChunks) * 100))
  }
  return 0
}

export function createUploadTaskCallbacks(updateTask: UpdateUploadTask, taskId: string) {
  return {
    onSessionResolved: (created: {
      session: { id: string; chunkSize: number; totalChunks: number; uploadedChunks: number[] }
      transferJobId?: string | null
    }) => {
      const uploadedCount = created.session.uploadedChunks?.length ?? 0
      updateTask(taskId, (prev) => {
        const transferredBytes = resolveTransferredBytesFromChunks(
          created.session.uploadedChunks ?? [],
          created.session.chunkSize,
          prev.totalBytes,
        )

        return {
          ...prev,
          uploadSessionId: created.session.id,
          transferJobId: created.transferJobId ?? prev.transferJobId,
          uploadedChunkCount: uploadedCount,
          totalChunkCount: created.session.totalChunks,
          transferredBytes,
          currentSpeedBytesPerSecond: 0,
          progress: resolveTaskProgressPercent(
            transferredBytes,
            prev.totalBytes,
            created.session.totalChunks,
            uploadedCount,
          ),
        }
      })
    },
    onChunkProgress: ({
      uploadedCount,
      totalChunks,
      uploadedBytes,
      speedBytesPerSecond,
    }: {
      uploadedCount: number
      totalChunks: number
      uploadedBytes: number
      speedBytesPerSecond: number
    }) => {
      updateTask(taskId, (prev) => ({
        ...prev,
        uploadedChunkCount: uploadedCount,
        totalChunkCount: totalChunks,
        transferredBytes: Math.min(prev.totalBytes, uploadedBytes),
        currentSpeedBytesPerSecond: Math.max(0, speedBytesPerSecond),
        progress: resolveTaskProgressPercent(
          Math.min(prev.totalBytes, uploadedBytes),
          prev.totalBytes,
          totalChunks,
          uploadedCount,
        ),
      }))
    },
  }
}
