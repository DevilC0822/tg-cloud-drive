import { useCallback, useEffect, useState } from "react"
import { useAtom, useAtomValue } from "jotai"
import type { FileItem } from "@/lib/files"
import {
  createUploadBatch,
  createUploadFolder,
  fetchUploadFolderWork,
  type UploadProcess,
} from "@/lib/uploads-api"
import type { LocalFolderManifest } from "@/lib/upload-folder-manifest"
import { uploadFileToExistingSession, uploadFileToNewSession } from "@/lib/upload-runner"
import { fetchRuntimeSettings } from "@/lib/settings-api"
import { filesCurrentFolderIdAtom } from "@/stores/files-atoms"
import { uploadDragActiveAtom, uploadTasksAtom, type UploadTask } from "@/stores/upload-atoms"

interface UseUploadOptions {
  onUploaded?: () => void
}

const DEFAULT_UPLOAD_CONCURRENCY = 4
const MIN_UPLOAD_CONCURRENCY = 1

function normalizeUploadConcurrency(value: number | undefined) {
  if (!Number.isInteger(value) || value == null || value < MIN_UPLOAD_CONCURRENCY) {
    return DEFAULT_UPLOAD_CONCURRENCY
  }
  return value
}

function resolveWorkerCount(limit: number, size: number) {
  return Math.min(normalizeUploadConcurrency(limit), Math.max(size, MIN_UPLOAD_CONCURRENCY))
}

function createTask(file: File): UploadTask {
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
  }
}

function createFolderTask(folder: LocalFolderManifest): UploadTask {
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
    completedItems: 0,
    totalItems: folder.files.length,
  }
}

function applyUploadProcess(task: UploadTask, process?: UploadProcess) {
  if (!process) return task
  return {
    ...task,
    error: process.videoFaststartFallback ? "Uploaded with fallback pipeline" : task.error,
  }
}

export function useUpload(options: UseUploadOptions = {}) {
  const [uploadTasks, setUploadTasks] = useAtom(uploadTasksAtom)
  const [isDragActive, setIsDragActive] = useAtom(uploadDragActiveAtom)
  const currentFolderId = useAtomValue(filesCurrentFolderIdAtom)
  const [uploadConcurrency, setUploadConcurrency] = useState(DEFAULT_UPLOAD_CONCURRENCY)

  useEffect(() => {
    let active = true

    void fetchRuntimeSettings()
      .then((runtime) => {
        if (!active) {
          return
        }
        setUploadConcurrency(normalizeUploadConcurrency(runtime.uploadConcurrency))
      })
      .catch((error) => {
        console.warn("load upload concurrency failed", error)
      })

    return () => {
      active = false
    }
  }, [])

  const updateTask = useCallback(
    (taskId: string, updater: (prev: UploadTask) => UploadTask) => {
      setUploadTasks((prev) =>
        prev.map((task) => (task.id === taskId ? { ...updater(task), updatedAt: Date.now() } : task)),
      )
    },
    [setUploadTasks],
  )

  const addTask = useCallback(
    (file: File) => {
      const task = createTask(file)
      setUploadTasks((prev) => [...prev, task])
      return task
    },
    [setUploadTasks],
  )

  const addFolderTask = useCallback(
    (folder: LocalFolderManifest) => {
      const task = createFolderTask(folder)
      setUploadTasks((prev) => [...prev, task])
      return task
    },
    [setUploadTasks],
  )

  const removeTask = useCallback(
    (taskId: string) => {
      setUploadTasks((prev) => prev.filter((task) => task.id !== taskId))
    },
    [setUploadTasks],
  )

  const clearCompletedTasks = useCallback(() => {
    setUploadTasks((prev) => prev.filter((task) => task.status !== "completed"))
  }, [setUploadTasks])

  const clearAllTasks = useCallback(() => {
    setUploadTasks([])
  }, [setUploadTasks])

  const runUpload = useCallback(
    async (task: UploadTask, parentId: string | null, reuseSessionId?: string, transferBatchId?: string) => {
      if (!task.file) {
        return null
      }
      updateTask(task.id, (prev) => ({ ...prev, status: "uploading", error: undefined, targetParentId: parentId }))

      try {
        const callbacks = {
          onSessionResolved: (created: { session: { id: string; totalChunks: number; uploadedChunks: number[] }; transferJobId?: string | null }) => {
            const uploadedCount = created.session.uploadedChunks?.length ?? 0
            updateTask(task.id, (prev) => ({
              ...prev,
              uploadSessionId: created.session.id,
              transferJobId: created.transferJobId ?? prev.transferJobId,
              uploadedChunkCount: uploadedCount,
              totalChunkCount: created.session.totalChunks,
              progress: Math.round((uploadedCount / Math.max(1, created.session.totalChunks)) * 100),
            }))
          },
          onChunkProgress: ({ uploadedCount, totalChunks }: { uploadedCount: number; totalChunks: number }) => {
            const percent = totalChunks > 0 ? Math.min(99, Math.round((uploadedCount / totalChunks) * 100)) : 0
            updateTask(task.id, (prev) => ({
              ...prev,
              uploadedChunkCount: uploadedCount,
              totalChunkCount: totalChunks,
              progress: percent,
            }))
          },
        }
        const completed = reuseSessionId
          ? await uploadFileToExistingSession({ file: task.file, sessionId: reuseSessionId, callbacks })
          : await uploadFileToNewSession({ file: task.file, parentId, transferBatchId, callbacks })
        updateTask(task.id, (prev) => ({
          ...applyUploadProcess(prev, completed.uploadProcess),
          status: "completed",
          progress: 100,
          uploadedChunkCount: completed.session.totalChunks,
          totalChunkCount: completed.session.totalChunks,
          finishedAt: Date.now(),
        }))
        options.onUploaded?.()
        return completed.item
      } catch (err: unknown) {
        updateTask(task.id, (prev) => ({
          ...prev,
          status: "error",
          error: err instanceof Error ? err.message : "Upload failed",
          finishedAt: Date.now(),
        }))
        return null
      }
    },
    [options, updateTask],
  )

  const uploadFolder = useCallback(
    async (folder: LocalFolderManifest, parentId?: string | null) => {
      const task = addFolderTask(folder)
      const resolvedParentId = parentId === undefined ? currentFolderId : parentId
      updateTask(task.id, (prev) => ({
        ...prev,
        status: "uploading",
        error: undefined,
        targetParentId: resolvedParentId ?? null,
      }))

      try {
        const created = await createUploadFolder({
          parentId: resolvedParentId ?? null,
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
          let queueIndex = 0
          const worker = async () => {
            while (queueIndex < response.items.length) {
              const currentIndex = queueIndex
              queueIndex += 1
              const workItem = response.items[currentIndex]
              const file = fileLookup.get(workItem.relativePath)
              if (!file) {
                failedItems += 1
                firstError ||= `Missing local file: ${workItem.relativePath}`
                continue
              }

              try {
                await uploadFileToExistingSession({
                  file,
                  sessionId: workItem.sessionId,
                  callbacks: {
                    onChunkProgress: ({ uploadedCount }) => {
                      applyFolderProgress(workItem.relativePath, Math.min(file.size, uploadedCount * workItem.chunkSize))
                    },
                  },
                })
                completedItems += 1
                applyFolderProgress(workItem.relativePath, file.size)
              } catch (error) {
                failedItems += 1
                firstError ||= error instanceof Error ? `${workItem.relativePath}: ${error.message}` : workItem.relativePath
                updateTask(task.id, (prev) => ({
                  ...prev,
                  completedItems,
                  totalItems: folder.files.length,
                  error: firstError,
                }))
              }
            }
          }

          const workers = Array.from({ length: resolveWorkerCount(uploadConcurrency, response.items.length) }, () => worker())
          await Promise.all(workers)
          cursor = response.nextCursor
        } while (cursor)

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
          options.onUploaded?.()
        }
      } catch (error) {
        updateTask(task.id, (prev) => ({
          ...prev,
          status: "error",
          error: error instanceof Error ? error.message : "Folder upload failed",
          finishedAt: Date.now(),
        }))
        throw error
      }
    },
    [addFolderTask, currentFolderId, options, updateTask, uploadConcurrency],
  )

  const uploadFile = useCallback(
    async (file: File, parentId?: string | null) => {
      const task = addTask(file)
      const resolvedParentId = parentId === undefined ? currentFolderId : parentId
      return runUpload(task, resolvedParentId ?? null)
    },
    [addTask, currentFolderId, runUpload],
  )

  const retryTask = useCallback(
    async (taskId: string) => {
      const task = uploadTasks.find((item) => item.id === taskId)
      if (!task || task.kind !== "file") return null
      return runUpload(task, task.targetParentId ?? null, task.uploadSessionId)
    },
    [runUpload, uploadTasks],
  )

  const uploadFiles = useCallback(
    async (files: FileList | File[], parentId?: string | null) => {
      const source = Array.from(files)
      if (source.length === 0) return []

      let transferBatchId: string | undefined
      if (source.length > 1) {
        const totalSize = source.reduce((sum, file) => sum + file.size, 0)
        const batch = await createUploadBatch(`Batch Upload (${source.length})`, source.length, totalSize)
        transferBatchId = batch.batchId
      }

      const queue = source.map((file) => ({ file, parentId: parentId ?? currentFolderId ?? null, transferBatchId }))
      const results: Array<FileItem | null> = new Array(queue.length).fill(null)
      let index = 0

      const worker = async () => {
        while (index < queue.length) {
          const currentIndex = index
          index += 1
          const payload = queue[currentIndex]
          const task = addTask(payload.file)
          const item = await runUpload(task, payload.parentId, undefined, payload.transferBatchId)
          results[currentIndex] = item
        }
      }

      const workers = Array.from({ length: resolveWorkerCount(uploadConcurrency, queue.length) }, () => worker())
      await Promise.all(workers)
      return results
    },
    [addTask, currentFolderId, runUpload, uploadConcurrency],
  )

  const handleDragEnter = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      event.stopPropagation()
      setIsDragActive(true)
    },
    [setIsDragActive],
  )

  const handleDragLeave = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      event.stopPropagation()
      setIsDragActive(false)
    },
    [setIsDragActive],
  )

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
  }, [])

  const handleDrop = useCallback(
    (event: React.DragEvent, parentId?: string | null) => {
      event.preventDefault()
      event.stopPropagation()
      setIsDragActive(false)

      const files = event.dataTransfer.files
      if (files.length > 0) {
        void uploadFiles(files, parentId)
      }
    },
    [setIsDragActive, uploadFiles],
  )

  return {
    uploadTasks,
    isDragActive,
    uploadFile,
    uploadFiles,
    uploadFolder,
    retryTask,
    removeTask,
    clearCompletedTasks,
    clearAllTasks,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
  }
}
