import { useCallback, useEffect, useState } from "react"
import { useSetAtom } from "jotai"
import { ApiError } from "@/lib/api"
import { fetchFileItemById } from "@/lib/files-api"
import type { FileItem } from "@/lib/files"
import { buildItemContentUrl, detectFilePreviewKind, type FilePreviewKind } from "@/lib/file-preview"
import { previewTorrent, type TorrentPreview } from "@/lib/torrent-api"
import { authenticatedAtom } from "@/stores/auth-atoms"

const TEXT_PREVIEW_LIMIT_BYTES = 256 * 1024

interface ItemPreviewState {
  item: FileItem | null
  kind: FilePreviewKind | null
  loading: boolean
  error: string
}

interface TextPreviewState {
  content: string
  loading: boolean
  error: string
  truncated: boolean
}

function isUnauthorized(error: unknown) {
  return error instanceof ApiError && error.status === 401
}

function readError(error: unknown, fallback: string) {
  if (error instanceof ApiError && error.message) {
    return error.message
  }
  if (error instanceof Error && error.message) {
    return error.message
  }
  return fallback
}

function parseRangeTotal(contentRange: string | null) {
  if (!contentRange) {
    return null
  }

  const slashIndex = contentRange.lastIndexOf("/")
  if (slashIndex < 0 || slashIndex === contentRange.length - 1) {
    return null
  }

  const total = Number(contentRange.slice(slashIndex + 1).trim())
  return Number.isFinite(total) ? total : null
}

async function fetchTextPreview(itemId: string, signal: AbortSignal) {
  const response = await fetch(buildItemContentUrl(itemId), {
    credentials: "include",
    signal,
    headers: { Range: `bytes=0-${TEXT_PREVIEW_LIMIT_BYTES - 1}` },
  })

  if (!response.ok) {
    throw new ApiError(`请求失败（${response.status}）`, response.status)
  }

  const content = await response.text()
  const totalBytes = parseRangeTotal(response.headers.get("Content-Range"))
  const truncated = response.status === 206 || (totalBytes !== null && totalBytes > TEXT_PREVIEW_LIMIT_BYTES)
  return { content, truncated }
}

async function fetchTorrentPreviewByItem(item: FileItem) {
  const response = await fetch(buildItemContentUrl(item.id), { credentials: "include" })
  if (!response.ok) {
    throw new ApiError(`请求失败（${response.status}）`, response.status)
  }

  const blob = await response.blob()
  const torrentFile = new File([blob], item.name, { type: item.mimeType || "application/x-bittorrent" })
  return previewTorrent({ torrentFile })
}

function emptyTextState(): TextPreviewState {
  return { content: "", loading: false, error: "", truncated: false }
}

function useItemPreview(
  itemId: string | undefined,
  reloadToken: number,
  setAuthenticated: (value: boolean) => void,
): ItemPreviewState {
  const [state, setState] = useState<ItemPreviewState>({
    item: null,
    kind: null,
    loading: false,
    error: "",
  })

  useEffect(() => {
    if (!itemId) {
      setState({ item: null, kind: null, loading: false, error: "Missing file id" })
      return
    }

    let active = true
    setState((previous) => ({ ...previous, loading: true, error: "" }))

    const run = async () => {
      try {
        const item = await fetchFileItemById(itemId)
        if (active) {
          setState({ item, kind: detectFilePreviewKind(item), loading: false, error: "" })
        }
      } catch (error: unknown) {
        if (isUnauthorized(error)) {
          setAuthenticated(false)
        }
        if (active) {
          setState({
            item: null,
            kind: null,
            loading: false,
            error: readError(error, "Failed to load file details"),
          })
        }
      }
    }

    void run()
    return () => {
      active = false
    }
  }, [itemId, reloadToken, setAuthenticated])

  return state
}

function useTextPreview(
  item: FileItem | null,
  kind: FilePreviewKind | null,
  reloadToken: number,
  setAuthenticated: (value: boolean) => void,
): TextPreviewState {
  const [state, setState] = useState<TextPreviewState>(emptyTextState)

  useEffect(() => {
    if (!item || kind !== "text") {
      setState(emptyTextState())
      return
    }

    const controller = new AbortController()
    let active = true
    setState({ content: "", loading: true, error: "", truncated: false })

    const run = async () => {
      try {
        const result = await fetchTextPreview(item.id, controller.signal)
        if (active) {
          setState({ ...result, loading: false, error: "" })
        }
      } catch (error: unknown) {
        if (isUnauthorized(error)) {
          setAuthenticated(false)
        }
        if (active) {
          setState({
            content: "",
            loading: false,
            truncated: false,
            error: readError(error, "Failed to load text preview"),
          })
        }
      }
    }

    void run()
    return () => {
      active = false
      controller.abort()
    }
  }, [item, kind, reloadToken, setAuthenticated])

  return state
}

function useTorrentPreview(
  item: FileItem | null,
  kind: FilePreviewKind | null,
  reloadToken: number,
  setAuthenticated: (value: boolean) => void,
) {
  const [preview, setPreview] = useState<TorrentPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!item || kind !== "torrent") {
      setPreview(null)
      setLoading(false)
      setError("")
      return
    }

    let active = true
    setPreview(null)
    setLoading(true)
    setError("")

    const run = async () => {
      try {
        const next = await fetchTorrentPreviewByItem(item)
        if (active) {
          setPreview(next)
        }
      } catch (err: unknown) {
        if (isUnauthorized(err)) {
          setAuthenticated(false)
        }
        if (active) {
          setError(readError(err, "Failed to parse torrent metadata"))
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void run()
    return () => {
      active = false
    }
  }, [item, kind, reloadToken, setAuthenticated])

  return { preview, loading, error }
}

export function useFilePreviewData(itemId: string | undefined) {
  const setAuthenticated = useSetAtom(authenticatedAtom)
  const [reloadToken, setReloadToken] = useState(0)

  const itemPreview = useItemPreview(itemId, reloadToken, setAuthenticated)
  const textPreview = useTextPreview(itemPreview.item, itemPreview.kind, reloadToken, setAuthenticated)
  const torrentPreview = useTorrentPreview(itemPreview.item, itemPreview.kind, reloadToken, setAuthenticated)

  const reload = useCallback(() => {
    setReloadToken((previous) => previous + 1)
  }, [])

  return {
    item: itemPreview.item,
    kind: itemPreview.kind,
    loading: itemPreview.loading,
    error: itemPreview.error,
    reload,
    textPreview,
    torrentPreviewData: torrentPreview.preview,
    torrentLoading: torrentPreview.loading,
    torrentError: torrentPreview.error,
    textPreviewLimitBytes: TEXT_PREVIEW_LIMIT_BYTES,
  }
}
