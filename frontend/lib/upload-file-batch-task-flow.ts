import type { FileItem } from "@/lib/files"
import { createUploadBatch } from "@/lib/uploads-api"
import { runConcurrentWork } from "@/lib/concurrent-work"
import {
  finalizeUploadSession,
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

interface ExecuteFileBatchUploadOptions {
  files: File[]
  parentId: string | null
  addTask: (file: File) => UploadTask
  updateTask: UpdateUploadTask
  uploadConcurrency: number
  onUploaded?: () => void
}

interface FileBatchQueueItem {
  readonly file: File
  readonly parentId: string | null
  readonly transferBatchId?: string
}

export async function executeFileBatchUpload(options: ExecuteFileBatchUploadOptions) {
  const { files, parentId, addTask, updateTask, uploadConcurrency, onUploaded } = options
  const transferBatchId = await maybeCreateTransferBatch(files)
  const queue = buildFileBatchQueue({ files, parentId, transferBatchId })

  const prepared = await uploadFileBatchChunks({
    queue,
    addTask,
    updateTask,
    uploadConcurrency,
  })
  return finalizeFileBatchUploads({
    prepared,
    queueLength: queue.length,
    updateTask,
    uploadConcurrency,
    onUploaded,
  })
}

async function maybeCreateTransferBatch(files: File[]) {
  if (files.length <= 1) return undefined
  const totalSize = files.reduce((sum, file) => sum + file.size, 0)
  const batch = await createUploadBatch(`Batch Upload (${files.length})`, files.length, totalSize)
  return batch.batchId
}

function buildFileBatchQueue(options: {
  files: File[]
  parentId: string | null
  transferBatchId?: string
}): FileBatchQueueItem[] {
  const { files, parentId, transferBatchId } = options
  return files.map((file) => ({ file, parentId, transferBatchId }))
}

async function uploadFileBatchChunks(options: {
  queue: FileBatchQueueItem[]
  addTask: (file: File) => UploadTask
  updateTask: UpdateUploadTask
  uploadConcurrency: number
}) {
  const { queue, addTask, updateTask, uploadConcurrency } = options
  const preparedByIndex: Array<PreparedFileUpload | null> = new Array(queue.length).fill(null)

  await runConcurrentWork(
    resolveWorkerCount(uploadConcurrency, queue.length),
    queue.length,
    async (currentIndex) => {
      preparedByIndex[currentIndex] = await uploadFileBatchChunkAtIndex({
        queue,
        currentIndex,
        addTask,
        updateTask,
      })
    },
  )

  return preparedByIndex.filter((item): item is PreparedFileUpload => item !== null)
}

async function uploadFileBatchChunkAtIndex(options: {
  queue: FileBatchQueueItem[]
  currentIndex: number
  addTask: (file: File) => UploadTask
  updateTask: UpdateUploadTask
}): Promise<PreparedFileUpload | null> {
  const { queue, currentIndex, addTask, updateTask } = options
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
    return {
      index: currentIndex,
      task,
      sessionId: uploaded.session.id,
      totalChunks: uploaded.session.totalChunks,
      uploadProcess: uploaded.uploadProcess,
    }
  } catch (error) {
    updateTask(task.id, (prev) => ({
      ...prev,
      status: "error",
      error: toUploadErrorMessage(error, "Upload failed"),
      finishedAt: Date.now(),
    }))
    return null
  }
}

async function finalizeFileBatchUploads(options: {
  prepared: PreparedFileUpload[]
  queueLength: number
  updateTask: UpdateUploadTask
  uploadConcurrency: number
  onUploaded?: () => void
}) {
  const { prepared, queueLength, updateTask, uploadConcurrency, onUploaded } = options
  const results: Array<FileItem | null> = new Array(queueLength).fill(null)

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
