import { useCallback } from "react"
import { useAtom } from "jotai"
import { ApiError } from "@/lib/api"
import { createTorrentTask, previewTorrent } from "@/lib/torrent-api"
import {
  torrentErrorAtom,
  torrentFileAtom,
  torrentPreviewAtom,
  torrentPreviewLoadingAtom,
  torrentSelectedIndexesAtom,
  torrentSubmittingAtom,
  torrentUrlAtom,
} from "@/stores/upload-atoms"

function readError(error: unknown, fallback: string) {
  if (error instanceof ApiError && error.message) {
    return error.message
  }
  return fallback
}

export function useTorrentTasks() {
  const [torrentUrl, setTorrentUrl] = useAtom(torrentUrlAtom)
  const [torrentFile, setTorrentFile] = useAtom(torrentFileAtom)
  const [preview, setPreview] = useAtom(torrentPreviewAtom)
  const [selectedIndexes, setSelectedIndexes] = useAtom(torrentSelectedIndexesAtom)
  const [previewLoading, setPreviewLoading] = useAtom(torrentPreviewLoadingAtom)
  const [submitting, setSubmitting] = useAtom(torrentSubmittingAtom)
  const [error, setError] = useAtom(torrentErrorAtom)

  const clearDraft = useCallback(() => {
    setTorrentUrl("")
    setTorrentFile(null)
    setPreview(null)
    setSelectedIndexes([])
    setError("")
  }, [setError, setPreview, setSelectedIndexes, setTorrentFile, setTorrentUrl])

  const resetPreviewState = useCallback(() => {
    setPreview(null)
    setSelectedIndexes([])
    setError("")
  }, [setError, setPreview, setSelectedIndexes])

  const updateTorrentUrl = useCallback((value: string) => {
    setTorrentUrl(value)
    if (value.trim()) {
      setTorrentFile(null)
    }
    resetPreviewState()
  }, [resetPreviewState, setTorrentFile, setTorrentUrl])

  const updateTorrentFile = useCallback((file: File | null) => {
    setTorrentFile(file)
    if (file) {
      setTorrentUrl("")
    }
    resetPreviewState()
  }, [resetPreviewState, setTorrentFile, setTorrentUrl])

  const requestPreview = useCallback(async () => {
    const hasUrl = torrentUrl.trim().length > 0
    if (!hasUrl && !torrentFile) {
      setError("Please provide a torrent URL or choose a .torrent file")
      return null
    }

    setPreviewLoading(true)
    setError("")
    try {
      const result = await previewTorrent({ torrentUrl, torrentFile })
      setPreview(result)
      setSelectedIndexes(result.files.map((item) => item.fileIndex))
      return result
    } catch (err: unknown) {
      setPreview(null)
      setSelectedIndexes([])
      setError(readError(err, "Failed to preview torrent metadata"))
      return null
    } finally {
      setPreviewLoading(false)
    }
  }, [setError, setPreview, setPreviewLoading, setSelectedIndexes, torrentFile, torrentUrl])

  const toggleFileSelection = useCallback(
    (fileIndex: number) => {
      setSelectedIndexes((prev) => {
        if (prev.includes(fileIndex)) {
          return prev.filter((value) => value !== fileIndex)
        }
        return [...prev, fileIndex].sort((a, b) => a - b)
      })
    },
    [setSelectedIndexes],
  )

  const submitTask = useCallback(
    async (parentId: string | null) => {
      if (!preview) {
        setError("Preview torrent metadata first")
        return { ok: false as const }
      }
      if (selectedIndexes.length === 0) {
        setError("Choose at least one file")
        return { ok: false as const }
      }

      setSubmitting(true)
      setError("")
      try {
        const task = await createTorrentTask({
          parentId,
          torrentUrl,
          torrentFile,
          selectedFileIndexes: selectedIndexes,
          submittedBy: "admin",
        })
        return { ok: true as const, task }
      } catch (err: unknown) {
        setError(readError(err, "Failed to create torrent task"))
        return { ok: false as const }
      } finally {
        setSubmitting(false)
      }
    },
    [preview, selectedIndexes, setError, setSubmitting, torrentFile, torrentUrl],
  )

  return {
    torrentUrl,
    setTorrentUrl: updateTorrentUrl,
    torrentFile,
    setTorrentFile: updateTorrentFile,
    preview,
    selectedIndexes,
    toggleFileSelection,
    previewLoading,
    submitting,
    error,
    clearDraft,
    requestPreview,
    submitTask,
  }
}
