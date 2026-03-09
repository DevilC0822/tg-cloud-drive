import { useCallback, useEffect, useRef, useState } from "react"
import { ApiError } from "@/lib/api"
import {
  deleteTorrentTask,
  fetchTorrentTask,
  fetchTorrentTasks,
  type TorrentTaskDetail,
  type TorrentTaskPagination,
  type TorrentTaskQuery,
  type TorrentTaskStatus,
  type TorrentTaskSummary,
} from "@/lib/torrent-api"

const DEFAULT_QUERY: TorrentTaskQuery = {
  status: "all",
  page: 1,
  pageSize: 12,
}

const DEFAULT_PAGINATION: TorrentTaskPagination = {
  page: 1,
  pageSize: 12,
  totalCount: 0,
  totalPages: 1,
}

function readError(error: unknown, fallback: string) {
  if (error instanceof ApiError && error.message) {
    return error.message
  }
  return fallback
}

interface TorrentTaskDetailState {
  open: boolean
  id: string | null
  loading: boolean
  data: TorrentTaskDetail | null
}

export function useTorrentTaskHistory() {
  const [items, setItems] = useState<TorrentTaskSummary[]>([])
  const [query, setQuery] = useState<TorrentTaskQuery>(DEFAULT_QUERY)
  const [pagination, setPagination] = useState<TorrentTaskPagination>(DEFAULT_PAGINATION)
  const [loading, setLoading] = useState(true)
  const [ready, setReady] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [detail, setDetail] = useState<TorrentTaskDetailState>({
    open: false,
    id: null,
    loading: false,
    data: null,
  })

  const requestSeqRef = useRef(0)

  const refresh = useCallback(async (nextQuery: TorrentTaskQuery, silent = false) => {
    const requestId = requestSeqRef.current + 1
    requestSeqRef.current = requestId
    const showRefreshing = ready && !silent

    if (!ready && !silent) {
      setLoading(true)
    }
    if (showRefreshing) {
      setRefreshing(true)
    }

    try {
      const response = await fetchTorrentTasks(nextQuery)
      if (requestSeqRef.current !== requestId) {
        return
      }
      setItems(response.items ?? [])
      setPagination(response.pagination ?? DEFAULT_PAGINATION)
      setReady(true)
    } finally {
      if (requestSeqRef.current !== requestId) {
        return
      }
      if (!silent) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [ready])

  useEffect(() => {
    void refresh(query)
  }, [query, refresh])

  const reload = useCallback(async (silent = false) => {
    await refresh(query, silent)
  }, [query, refresh])

  const openDetail = useCallback(async (taskId: string) => {
    setDetail({ open: true, id: taskId, loading: true, data: null })
    try {
      const data = await fetchTorrentTask(taskId)
      setDetail({ open: true, id: taskId, loading: false, data })
    } catch (error) {
      setDetail({ open: true, id: taskId, loading: false, data: null })
      throw error
    }
  }, [])

  const closeDetail = useCallback(() => {
    setDetail((prev) => ({ ...prev, open: false }))
  }, [])

  const changeStatus = useCallback((status: TorrentTaskStatus | "all") => {
    setQuery((prev) => ({ ...prev, status, page: 1 }))
  }, [])

  const changePage = useCallback((page: number) => {
    setQuery((prev) => ({ ...prev, page }))
  }, [])

  const changePageSize = useCallback((pageSize: number) => {
    setQuery((prev) => ({ ...prev, page: 1, pageSize }))
  }, [])

  const removeTask = useCallback(async (taskId: string) => {
    const response = await deleteTorrentTask(taskId)
    setItems((prev) => prev.filter((item) => item.id !== taskId))
    if (detail.id === taskId) {
      setDetail({ open: false, id: null, loading: false, data: null })
    }
    await reload()
    return response.cleanupWarnings ?? []
  }, [detail.id, reload])

  return {
    items,
    query,
    pagination,
    loading,
    initialLoading: loading && !ready,
    refreshing,
    detail,
    reload,
    openDetail,
    closeDetail,
    changeStatus,
    changePage,
    changePageSize,
    removeTask,
    readError,
  }
}
