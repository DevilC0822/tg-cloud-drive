import {
  createUploadFolder,
  fetchUploadFolderWork,
  type UploadFolderWorkItem,
} from "@/lib/uploads-api"
import type { LocalFolderManifest } from "@/lib/upload-folder-manifest"
import { runConcurrentWork } from "@/lib/concurrent-work"
import {
  finalizeUploadSession,
  uploadFileChunksToExistingSession,
} from "@/lib/upload-runner"
import { createFolderProgressTracker, type FolderProgressTracker } from "@/lib/upload-folder-progress"
import { buildFolderFileLookup, createFolderUploadState } from "@/lib/upload-folder-state"
import type { UploadTask } from "@/stores/upload-atoms"
import {
  resolveWorkerCount,
  toUploadErrorMessage,
  type UpdateUploadTask,
} from "@/lib/upload-task-utils"

interface ExecuteFolderUploadOptions {
  folder: LocalFolderManifest
  parentId: string | null
  task: UploadTask
  updateTask: UpdateUploadTask
  uploadConcurrency: number
  onUploaded?: () => void
}

interface FolderUploadCreated {
  readonly batchId: string
  readonly rootItemId: string
  readonly transferJobId?: string | null
}

interface FolderUploadResult {
  readonly uploadedBytes: number
  readonly completedItems: number
  readonly failedItems: number
  readonly firstError: string
}

export async function executeFolderUpload(options: ExecuteFolderUploadOptions) {
  const { folder, parentId, task, updateTask, uploadConcurrency, onUploaded } = options

  markFolderTaskUploading({ taskId: task.id, updateTask, parentId })
  const created = await createRemoteFolderUpload({ folder, parentId })
  markFolderTaskCreated({ taskId: task.id, updateTask, created })

  const fileLookup = buildFolderFileLookup(folder)
  const result = await runFolderUploadLoop({
    folder,
    taskId: task.id,
    updateTask,
    created,
    fileLookup,
    uploadConcurrency,
  })

  finishFolderTask({ folder, taskId: task.id, updateTask, result })
  if (result.failedItems === 0) {
    onUploaded?.()
  }
}

function markFolderTaskUploading(options: {
  taskId: string
  updateTask: UpdateUploadTask
  parentId: string | null
}) {
  const { taskId, updateTask, parentId } = options
  updateTask(taskId, (prev) => ({
    ...prev,
    status: "uploading",
    error: undefined,
    targetParentId: parentId,
    currentSpeedBytesPerSecond: 0,
  }))
}

async function createRemoteFolderUpload(options: {
  folder: LocalFolderManifest
  parentId: string | null
}): Promise<FolderUploadCreated> {
  const { folder, parentId } = options
  const created = await createUploadFolder({
    parentId,
    rootName: folder.rootName,
    directories: folder.directories,
    files: folder.files.map((item) => ({
      relativePath: item.relativePath,
      size: item.file.size,
      mimeType: item.file.type || null,
    })),
  })

  return {
    batchId: created.batchId,
    rootItemId: created.rootItemId,
    transferJobId: created.job?.id,
  }
}

function markFolderTaskCreated(options: {
  taskId: string
  updateTask: UpdateUploadTask
  created: FolderUploadCreated
}) {
  const { taskId, updateTask, created } = options
  updateTask(taskId, (prev) => ({
    ...prev,
    transferJobId: created.transferJobId ?? prev.transferJobId,
    transferBatchId: created.batchId,
    rootItemId: created.rootItemId,
  }))
}

async function runFolderUploadLoop(options: {
  folder: LocalFolderManifest
  taskId: string
  updateTask: UpdateUploadTask
  created: FolderUploadCreated
  fileLookup: Map<string, File>
  uploadConcurrency: number
}): Promise<FolderUploadResult> {
  const { folder, taskId, updateTask, created, fileLookup, uploadConcurrency } = options
  const state = createFolderUploadState()
  const progress = createFolderProgressTracker({
    folder,
    taskId,
    updateTask,
    batchId: created.batchId,
    rootItemId: created.rootItemId,
    transferJobId: created.transferJobId,
    getCompletedItems: state.getCompletedItems,
  })

  let cursor: string | null | undefined
  do {
    const response = await fetchUploadFolderWork(created.batchId, cursor)
    await processFolderWorkItems({
      items: response.items,
      folder,
      fileLookup,
      taskId,
      updateTask,
      uploadConcurrency,
      progress,
      state,
    })
    cursor = response.nextCursor
  } while (cursor)

  return {
    uploadedBytes: progress.getUploadedBytes(),
    completedItems: state.getCompletedItems(),
    failedItems: state.getFailedItems(),
    firstError: state.getFirstError(),
  }
}

async function processFolderWorkItems(options: {
  items: UploadFolderWorkItem[]
  folder: LocalFolderManifest
  fileLookup: Map<string, File>
  taskId: string
  updateTask: UpdateUploadTask
  uploadConcurrency: number
  progress: FolderProgressTracker
  state: ReturnType<typeof createFolderUploadState>
}) {
  const { items, folder, fileLookup, taskId, updateTask, uploadConcurrency, progress, state } = options

  await runConcurrentWork(
    resolveWorkerCount(uploadConcurrency, items.length),
    items.length,
    async (currentIndex) => {
      await processFolderWorkItemAtIndex({
        items,
        currentIndex,
        folder,
        fileLookup,
        taskId,
        updateTask,
        progress,
        state,
      })
    },
  )
}

async function processFolderWorkItemAtIndex(options: {
  items: UploadFolderWorkItem[]
  currentIndex: number
  folder: LocalFolderManifest
  fileLookup: Map<string, File>
  taskId: string
  updateTask: UpdateUploadTask
  progress: FolderProgressTracker
  state: ReturnType<typeof createFolderUploadState>
}) {
  const { items, currentIndex, folder, fileLookup, taskId, updateTask, progress, state } = options
  const item = items[currentIndex]
  const file = fileLookup.get(item.relativePath)
  if (!file) {
    recordFolderItemFailure({
      state,
      taskId,
      updateTask,
      folder,
      message: `Missing local file: ${item.relativePath}`,
    })
    return
  }

  try {
    await uploadAndFinalizeFolderItem({ item, file, progress })
    state.markCompleted()
    updateTask(taskId, (prev) => ({
      ...prev,
      completedItems: state.getCompletedItems(),
      totalItems: folder.files.length,
    }))
  } catch (error) {
    progress.clearFileProgress(item.relativePath)
    recordFolderItemFailure({
      state,
      taskId,
      updateTask,
      folder,
      message: `${item.relativePath}: ${toUploadErrorMessage(error, item.relativePath)}`,
    })
  }
}

async function uploadAndFinalizeFolderItem(options: {
  item: UploadFolderWorkItem
  file: File
  progress: FolderProgressTracker
}) {
  const { item, file, progress } = options
  await uploadFileChunksToExistingSession({
    file,
    sessionId: item.sessionId,
    callbacks: {
      onChunkProgress: ({ uploadedBytes, speedBytesPerSecond }) => {
        progress.applyFolderProgress(item.relativePath, uploadedBytes, speedBytesPerSecond)
      },
    },
  })
  progress.applyFolderProgress(item.relativePath, file.size, 0)
  await finalizeUploadSession(item.sessionId)
}

function recordFolderItemFailure(options: {
  state: ReturnType<typeof createFolderUploadState>
  taskId: string
  updateTask: UpdateUploadTask
  folder: LocalFolderManifest
  message: string
}) {
  const { state, taskId, updateTask, folder, message } = options
  state.markFailed(message)
  updateTask(taskId, (prev) => ({
    ...prev,
    completedItems: state.getCompletedItems(),
    totalItems: folder.files.length,
    error: state.getFirstError(),
  }))
}

function finishFolderTask(options: {
  folder: LocalFolderManifest
  taskId: string
  updateTask: UpdateUploadTask
  result: FolderUploadResult
}) {
  const { folder, taskId, updateTask, result } = options
  const progressPercent =
    result.failedItems > 0 && folder.totalSize > 0
      ? Math.round((result.uploadedBytes / folder.totalSize) * 100)
      : 100

  updateTask(taskId, (prev) => ({
    ...prev,
    status: result.failedItems > 0 ? "error" : "completed",
    error:
      result.failedItems > 0
        ? result.firstError || `${result.failedItems} items failed`
        : undefined,
    progress: progressPercent,
    transferredBytes: result.failedItems > 0 ? result.uploadedBytes : folder.totalSize,
    currentSpeedBytesPerSecond: 0,
    completedItems: result.completedItems,
    totalItems: folder.files.length,
    finishedAt: Date.now(),
  }))
}
