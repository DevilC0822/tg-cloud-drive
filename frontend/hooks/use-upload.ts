import { useCallback, useEffect, useState } from "react"
import { useAtom, useAtomValue } from "jotai"
import type { LocalFolderManifest } from "@/lib/upload-folder-manifest"
import {
  executeFileBatchUpload,
  executeFolderUpload,
} from "@/lib/upload-task-flow"
import {
  applyUploadProcess,
  createFolderUploadTask,
  createUploadTask,
  createUploadTaskCallbacks,
  DEFAULT_UPLOAD_CONCURRENCY,
  normalizeUploadConcurrency,
  toUploadErrorMessage,
} from "@/lib/upload-task-utils"
import {
  uploadFileToExistingSession,
  uploadFileToNewSession,
} from "@/lib/upload-runner"
import { fetchRuntimeSettings } from "@/lib/settings-api"
import { filesCurrentFolderIdAtom } from "@/stores/files-atoms"
import { uploadDragActiveAtom, uploadTasksAtom, type UploadTask } from "@/stores/upload-atoms"

interface UseUploadOptions {
  onUploaded?: () => void
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
      const task = createUploadTask(file)
      setUploadTasks((prev) => [...prev, task])
      return task
    },
    [setUploadTasks],
  )

  const addFolderTask = useCallback(
    (folder: LocalFolderManifest) => {
      const task = createFolderUploadTask(folder)
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
        const callbacks = createUploadTaskCallbacks(updateTask, task.id)
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
      try {
        await executeFolderUpload({
          folder,
          parentId: resolvedParentId ?? null,
          task,
          updateTask,
          uploadConcurrency,
          onUploaded: options.onUploaded,
        })
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
      return executeFileBatchUpload({
        files: source,
        parentId: parentId ?? currentFolderId ?? null,
        addTask,
        updateTask,
        uploadConcurrency,
        onUploaded: options.onUploaded,
      })
    },
    [addTask, currentFolderId, options, updateTask, uploadConcurrency],
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
