import type { FileItem } from "@/lib/files"
import {
  createUploadBatch,
  createUploadFolder,
  fetchUploadFolderWork,
} from "@/lib/uploads-api"
import type { LocalFolderManifest } from "@/lib/upload-folder-manifest"
import { runConcurrentWork } from "@/lib/concurrent-work"
import {
  finalizeUploadSession,
  uploadFileChunksToExistingSession,
  uploadFileChunksToNewSession,
} from "@/lib/upload-runner"
import type { UploadTask } from "@/stores/upload-atoms"
import {
  applyUploadProcess,
  createUploadTaskCallbacks,
  resolveWorkerCount,
  toUploadErrorMessage,
  type UpdateUploadTask,
} from "@/lib/upload-task-utils"

interface PreparedFileUpload {
  index: number
  task: UploadTask
  sessionId: string
  totalChunks: number
  uploadProcess?: import("@/lib/uploads-api").UploadProcess
}

interface PreparedFolderUpload {
  relativePath: string
  sessionId: string
}

interface ExecuteFolderUploadOptions {
  folder: LocalFolderManifest
  parentId: string | null
  task: UploadTask
  updateTask: UpdateUploadTask
  uploadConcurrency: number
  onUploaded?: () => void
}

export async function executeFolderUpload(options: ExecuteFolderUploadOptions) {
  const { folder, parentId, task, updateTask, uploadConcurrency, onUploaded } = options
  updateTask(task.id, (prev) => ({
    ...prev,
    status: "uploading",
    error: undefined,
    targetParentId: parentId,
  }))

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

  updateTask(task.id, (prev) => ({
    ...prev,
    transferJobId: created.job?.id ?? prev.transferJobId,
    transferBatchId: created.batchId,
    rootItemId: created.rootItemId,
  }))

  const fileLookup = new Map(folder.files.map((item) => [item.relativePath, item.file]))
  const uploadedBytesByPath = new Map<string, number>()
  const prepared: PreparedFolderUpload[] = []
  let uploadedBytes = 0
  let completedItems = 0
  let failedItems = 0
  let firstError = ""
  let cursor: string | null | undefined

  const applyFolderProgress = (relativePath: string, nextBytes: number) => {
    const previous = uploadedBytesByPath.get(relativePath) ?? 0
    const clamped = Math.max(previous, nextBytes)
    if (clamped <= previous) return
    uploadedBytesByPath.set(relativePath, clamped)
    uploadedBytes += clamped - previous
    updateTask(task.id, (prev) => ({
      ...prev,
      transferJobId: created.job?.id ?? prev.transferJobId,
      transferBatchId: created.batchId,
      rootItemId: created.rootItemId,
      completedItems,
      totalItems: folder.files.length,
      progress: folder.totalSize > 0 ? Math.min(99, Math.round((uploadedBytes / folder.totalSize) * 100)) : 99,
    }))
  }

  do {
    const response = await fetchUploadFolderWork(created.batchId, cursor)
    await runConcurrentWork(
      resolveWorkerCount(uploadConcurrency, response.items.length),
      response.items.length,
      async (currentIndex) => {
        const workItem = response.items[currentIndex]
        const file = fileLookup.get(workItem.relativePath)
        if (!file) {
          failedItems += 1
          firstError ||= `Missing local file: ${workItem.relativePath}`
          return
        }

        try {
          await uploadFileChunksToExistingSession({
            file,
            sessionId: workItem.sessionId,
            callbacks: {
              onChunkProgress: ({ uploadedCount }) => {
                applyFolderProgress(workItem.relativePath, Math.min(file.size, uploadedCount * workItem.chunkSize))
              },
            },
          })
          applyFolderProgress(workItem.relativePath, file.size)
          prepared.push({ relativePath: workItem.relativePath, sessionId: workItem.sessionId })
        } catch (error) {
          failedItems += 1
          firstError ||= `${workItem.relativePath}: ${toUploadErrorMessage(error, workItem.relativePath)}`
          updateTask(task.id, (prev) => ({
            ...prev,
            completedItems,
            totalItems: folder.files.length,
            error: firstError,
          }))
        }
      },
    )
    cursor = response.nextCursor
  } while (cursor)

  await runConcurrentWork(
    resolveWorkerCount(uploadConcurrency, prepared.length),
    prepared.length,
    async (currentIndex) => {
      const current = prepared[currentIndex]
      try {
        await finalizeUploadSession(current.sessionId)
        completedItems += 1
        updateTask(task.id, (prev) => ({
          ...prev,
          completedItems,
          totalItems: folder.files.length,
        }))
      } catch (error) {
        failedItems += 1
        firstError ||= `${current.relativePath}: ${toUploadErrorMessage(error, current.relativePath)}`
        updateTask(task.id, (prev) => ({
          ...prev,
          completedItems,
          totalItems: folder.files.length,
          error: firstError,
        }))
      }
    },
  )

  updateTask(task.id, (prev) => ({
    ...prev,
    status: failedItems > 0 ? "error" : "completed",
    error: failedItems > 0 ? firstError || `${failedItems} items failed` : undefined,
    progress: failedItems > 0 && folder.totalSize > 0 ? Math.round((uploadedBytes / folder.totalSize) * 100) : 100,
    completedItems,
    totalItems: folder.files.length,
    finishedAt: Date.now(),
  }))
  if (failedItems === 0) {
    onUploaded?.()
  }
}

interface ExecuteFileBatchUploadOptions {
  files: File[]
  parentId: string | null
  addTask: (file: File) => UploadTask
  updateTask: UpdateUploadTask
  uploadConcurrency: number
  onUploaded?: () => void
}

export async function executeFileBatchUpload(
  options: ExecuteFileBatchUploadOptions,
) {
  const { files, parentId, addTask, updateTask, uploadConcurrency, onUploaded } = options
  let transferBatchId: string | undefined
  if (files.length > 1) {
    const totalSize = files.reduce((sum, file) => sum + file.size, 0)
    const batch = await createUploadBatch(`Batch Upload (${files.length})`, files.length, totalSize)
    transferBatchId = batch.batchId
  }

  const queue = files.map((file) => ({ file, parentId, transferBatchId }))
  const results: Array<FileItem | null> = new Array(queue.length).fill(null)
  const prepared: PreparedFileUpload[] = []

  await runConcurrentWork(
    resolveWorkerCount(uploadConcurrency, queue.length),
    queue.length,
    async (currentIndex) => {
      const payload = queue[currentIndex]
      const task = addTask(payload.file)
      updateTask(task.id, (prev) => ({
        ...prev,
        status: "uploading",
        error: undefined,
        targetParentId: payload.parentId,
      }))

      try {
        const uploaded = await uploadFileChunksToNewSession({
          file: payload.file,
          parentId: payload.parentId,
          transferBatchId: payload.transferBatchId,
          callbacks: createUploadTaskCallbacks(updateTask, task.id),
        })
        prepared.push({
          index: currentIndex,
          task,
          sessionId: uploaded.session.id,
          totalChunks: uploaded.session.totalChunks,
          uploadProcess: uploaded.uploadProcess,
        })
      } catch (error) {
        updateTask(task.id, (prev) => ({
          ...prev,
          status: "error",
          error: toUploadErrorMessage(error, "Upload failed"),
          finishedAt: Date.now(),
        }))
      }
    },
  )

  await runConcurrentWork(
    resolveWorkerCount(uploadConcurrency, prepared.length),
    prepared.length,
    async (currentIndex) => {
      const current = prepared[currentIndex]
      try {
        const completed = await finalizeUploadSession(current.sessionId)
        results[current.index] = completed.item
        updateTask(current.task.id, (prev) => ({
          ...applyUploadProcess(prev, completed.uploadProcess ?? current.uploadProcess),
          status: "completed",
          progress: 100,
          uploadedChunkCount: current.totalChunks,
          totalChunkCount: current.totalChunks,
          finishedAt: Date.now(),
        }))
        onUploaded?.()
      } catch (error) {
        updateTask(current.task.id, (prev) => ({
          ...prev,
          status: "error",
          error: toUploadErrorMessage(error, "Upload failed"),
          finishedAt: Date.now(),
        }))
      }
    },
  )

  return results
}
