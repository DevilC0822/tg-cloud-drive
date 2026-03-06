import { useCallback } from "react"
import { useAtom, useAtomValue } from "jotai"
import type { FileItem } from "@/lib/files"
import {
  completeUploadSession,
  createUploadBatch,
  createUploadSession,
  fetchUploadSession,
  type UploadProcess,
  uploadSessionChunk,
} from "@/lib/uploads-api"
import { filesCurrentFolderIdAtom } from "@/stores/files-atoms"
import { uploadDragActiveAtom, uploadTasksAtom, type UploadTask } from "@/stores/upload-atoms"

interface UseUploadOptions {
  onUploaded?: () => void
}

const UPLOAD_CONCURRENCY = 2

function createTask(file: File): UploadTask {
  const now = Date.now()
  return {
    id: `${now}-${Math.random().toString(16).slice(2, 10)}`,
    file,
    progress: 0,
    status: "pending",
    startedAt: now,
    updatedAt: now,
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

  const updateTask = useCallback(
    (taskId: string, updater: (prev: UploadTask) => UploadTask) => {
      setUploadTasks((prev) => prev.map((task) => (task.id === taskId ? updater(task) : task)))
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
      updateTask(task.id, (prev) => ({ ...prev, status: "uploading", error: undefined, targetParentId: parentId }))

      try {
        const created = reuseSessionId
          ? { session: await fetchUploadSession(reuseSessionId), transferJobId: task.transferJobId }
          : await createUploadSession(task.file, parentId, transferBatchId)
        const session = created.session

        const uploadedSet = new Set(session.uploadedChunks || [])
        updateTask(task.id, (prev) => ({
          ...prev,
          uploadSessionId: session.id,
          transferJobId: created.transferJobId ?? prev.transferJobId,
          uploadedChunkCount: uploadedSet.size,
          totalChunkCount: session.totalChunks,
          progress: Math.round((uploadedSet.size / Math.max(1, session.totalChunks)) * 100),
        }))

        let latestProcess: UploadProcess | undefined
        for (let chunkIndex = 0; chunkIndex < session.totalChunks; chunkIndex += 1) {
          if (uploadedSet.has(chunkIndex)) continue

          const from = chunkIndex * session.chunkSize
          const to = Math.min(task.file.size, from + session.chunkSize)
          const chunk = task.file.slice(from, to)
          const uploaded = await uploadSessionChunk(session.id, chunkIndex, chunk, task.file.name)
          if (uploaded.uploadProcess) latestProcess = uploaded.uploadProcess

          uploadedSet.add(chunkIndex)
          const uploadedCount = Math.max(uploadedSet.size, uploaded.progress.uploadedCount)
          updateTask(task.id, (prev) => ({
            ...prev,
            uploadedChunkCount: uploadedCount,
            totalChunkCount: uploaded.progress.totalChunks,
            progress: Math.min(99, Math.round((uploadedCount / Math.max(uploaded.progress.totalChunks, 1)) * 100)),
          }))
        }

        const completed = await completeUploadSession(session.id)
        updateTask(task.id, (prev) => ({
          ...applyUploadProcess(prev, completed.uploadProcess ?? latestProcess),
          status: "completed",
          progress: 100,
          uploadedChunkCount: session.totalChunks,
          totalChunkCount: session.totalChunks,
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
      if (!task) return null
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

      const workers = Array.from({ length: Math.min(UPLOAD_CONCURRENCY, queue.length) }, () => worker())
      await Promise.all(workers)
      return results
    },
    [addTask, currentFolderId, runUpload],
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
