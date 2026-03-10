import type { LocalFolderManifest } from "@/lib/upload-folder-manifest"
import type { UpdateUploadTask } from "@/lib/upload-task-utils"

const IN_PROGRESS_MAX_PERCENT = 99

export interface FolderProgressTracker {
  applyFolderProgress: (relativePath: string, transferredBytes: number, speedBytesPerSecond: number) => void
  clearFileProgress: (relativePath: string) => void
  getUploadedBytes: () => number
}

interface CreateFolderProgressTrackerOptions {
  folder: LocalFolderManifest
  taskId: string
  updateTask: UpdateUploadTask
  batchId: string
  rootItemId: string
  transferJobId?: string | null
  getCompletedItems: () => number
}

export function createFolderProgressTracker(options: CreateFolderProgressTrackerOptions): FolderProgressTracker {
  const uploadedBytesByPath = new Map<string, number>()
  const speedByPath = new Map<string, number>()
  let uploadedBytes = 0
  let totalSpeedBytesPerSecond = 0

  const pushTaskSnapshot = () => {
    const progressPercent =
      options.folder.totalSize > 0
        ? Math.min(
            IN_PROGRESS_MAX_PERCENT,
            Math.round((uploadedBytes / options.folder.totalSize) * 100),
          )
        : IN_PROGRESS_MAX_PERCENT

    options.updateTask(options.taskId, (prev) => ({
      ...prev,
      transferJobId: options.transferJobId ?? prev.transferJobId,
      transferBatchId: options.batchId,
      rootItemId: options.rootItemId,
      completedItems: options.getCompletedItems(),
      totalItems: options.folder.files.length,
      transferredBytes: uploadedBytes,
      currentSpeedBytesPerSecond: Math.max(0, totalSpeedBytesPerSecond),
      progress: progressPercent,
    }))
  }

  const applyFolderProgress = (relativePath: string, nextBytes: number, speedBytesPerSecond: number) => {
    const previousBytes = uploadedBytesByPath.get(relativePath) ?? 0
    const clampedBytes = Math.max(previousBytes, nextBytes)
    const previousSpeed = speedByPath.get(relativePath) ?? 0
    const normalizedSpeed = Math.max(0, speedBytesPerSecond)

    if (clampedBytes > previousBytes) {
      uploadedBytesByPath.set(relativePath, clampedBytes)
      uploadedBytes += clampedBytes - previousBytes
    }
    if (normalizedSpeed !== previousSpeed) {
      speedByPath.set(relativePath, normalizedSpeed)
      totalSpeedBytesPerSecond += normalizedSpeed - previousSpeed
    }
    if (clampedBytes === previousBytes && normalizedSpeed === previousSpeed) {
      return
    }

    pushTaskSnapshot()
  }

  const clearFileProgress = (relativePath: string) => {
    const previousSpeed = speedByPath.get(relativePath) ?? 0
    if (previousSpeed <= 0) {
      return
    }

    speedByPath.delete(relativePath)
    totalSpeedBytesPerSecond -= previousSpeed
    pushTaskSnapshot()
  }

  return {
    applyFolderProgress,
    clearFileProgress,
    getUploadedBytes: () => uploadedBytes,
  }
}
