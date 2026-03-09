import { useCallback, useEffect, useRef, useState } from "react"
import { useAtom } from "jotai"
import {
  activeTransfersAtom,
  activeTransfersLoadingAtom,
  historyPaginationAtom,
  historyQueryAtom,
  historyTransfersAtom,
  historyTransfersLoadingAtom,
  transferDetailAtom,
  transferStreamStatusAtom,
  type TransferDetailState,
} from "@/stores/transfer-atoms"
import {
  connectTransferStream,
  deleteActiveTransfer,
  deleteTransferHistoryItem,
  fetchTransferDetail,
  fetchTransferHistory,
  type TransferHistoryQuery,
  type TransferJobSummary,
  type TransferStreamEvent,
} from "@/lib/transfers-api"

type RefreshOptions = {
  silent?: boolean
}

function sortTransfers(items: TransferJobSummary[]) {
  return [...items].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
}

function upsertTransfer(items: TransferJobSummary[], next: TransferJobSummary) {
  const filtered = items.filter((item) => item.id !== next.id)
  return sortTransfers([next, ...filtered])
}

function removeTransfer(items: TransferJobSummary[], id: string) {
  return items.filter((item) => item.id !== id)
}

function patchDetailState(prev: TransferDetailState, transferId: string | null) {
  if (!transferId || prev.id !== transferId) {
    return prev
  }
  return { ...prev }
}

function syncDetailItem(prev: TransferDetailState, item: TransferJobSummary) {
  if (!prev.open || prev.id !== item.id || !prev.data) {
    return prev
  }
  return {
    ...prev,
    data: {
      ...prev.data,
      item,
    },
  }
}

function isDetailEventTarget(detail: TransferDetailState, event: TransferStreamEvent) {
  if (!detail.open || !detail.id) {
    return false
  }
  return detail.id === event.id || detail.id === event.item?.id
}

export function useTransfers() {
  const [activeTransfers, setActiveTransfers] = useAtom(activeTransfersAtom)
  const [historyTransfers, setHistoryTransfers] = useAtom(historyTransfersAtom)
  const [historyQuery, setHistoryQuery] = useAtom(historyQueryAtom)
  const [historyPagination, setHistoryPagination] = useAtom(historyPaginationAtom)
  const [detail, setDetail] = useAtom(transferDetailAtom)
  const [streamStatus, setStreamStatus] = useAtom(transferStreamStatusAtom)
  const [activeLoading, setActiveLoading] = useAtom(activeTransfersLoadingAtom)
  const [historyLoading, setHistoryLoading] = useAtom(historyTransfersLoadingAtom)
  const [activeReady, setActiveReady] = useState(!activeLoading)
  const [historyReady, setHistoryReady] = useState(!historyLoading)
  const [historyRefreshing, setHistoryRefreshing] = useState(false)

  const detailRef = useRef(detail)
  const historyQueryRef = useRef(historyQuery)
  const historyReadyRef = useRef(!historyLoading)
  const historyRequestSeqRef = useRef(0)

  useEffect(() => {
    detailRef.current = detail
  }, [detail])

  useEffect(() => {
    historyQueryRef.current = historyQuery
  }, [historyQuery])

  const refreshHistory = useCallback(async (query: TransferHistoryQuery, options?: RefreshOptions) => {
    const requestId = historyRequestSeqRef.current + 1
    historyRequestSeqRef.current = requestId
    const showSkeleton = !historyReadyRef.current && !options?.silent
    const showRefreshing = historyReadyRef.current && !options?.silent

    if (showSkeleton) {
      setHistoryLoading(true)
    }
    if (showRefreshing) {
      setHistoryRefreshing(true)
    }

    try {
      const response = await fetchTransferHistory(query)
      if (historyRequestSeqRef.current !== requestId) {
        return
      }
      setHistoryTransfers(sortTransfers(response.items))
      setHistoryPagination(response.pagination)
      historyReadyRef.current = true
      setHistoryReady(true)
    } finally {
      if (historyRequestSeqRef.current !== requestId) {
        return
      }
      if (showSkeleton) {
        setHistoryLoading(false)
      }
      if (showRefreshing) {
        setHistoryRefreshing(false)
      }
    }
  }, [setHistoryLoading, setHistoryPagination, setHistoryTransfers])

  const reloadHistory = useCallback(async (options?: RefreshOptions) => {
    await refreshHistory(historyQueryRef.current, options)
  }, [refreshHistory])

  const refreshDetail = useCallback(async (transferId: string, withLoading: boolean) => {
    if (withLoading) {
      setDetail({ open: true, id: transferId, loading: true, data: null })
    }

    try {
      const data = await fetchTransferDetail(transferId)
      setDetail((prev) => ({ ...patchDetailState(prev, transferId), open: true, id: transferId, loading: false, data }))
    } catch (error) {
      setDetail((prev) => ({ ...patchDetailState(prev, transferId), open: true, id: transferId, loading: false, data: null }))
      throw error
    }
  }, [setDetail])

  const openDetail = useCallback(async (transferId: string) => {
    await refreshDetail(transferId, true)
  }, [refreshDetail])

  const closeDetail = useCallback(() => {
    setDetail((prev) => ({ ...prev, open: false }))
  }, [setDetail])

  const updateFilters = useCallback((patch: Partial<TransferHistoryQuery>) => {
    setHistoryQuery((prev) => ({
      ...prev,
      ...patch,
      page: patch.page ?? (patch.pageSize ? 1 : 1),
    }))
  }, [setHistoryQuery])

  const changePage = useCallback((page: number) => {
    setHistoryQuery((prev) => ({ ...prev, page }))
  }, [setHistoryQuery])

  const changePageSize = useCallback((pageSize: number) => {
    setHistoryQuery((prev) => ({ ...prev, page: 1, pageSize }))
  }, [setHistoryQuery])

  const removeHistoryItem = useCallback(async (transferId: string) => {
    await deleteTransferHistoryItem(transferId)
    setHistoryTransfers((prev) => removeTransfer(prev, transferId))
    await reloadHistory()
  }, [reloadHistory, setHistoryTransfers])

  const removeActiveItem = useCallback(async (transferId: string) => {
    await deleteActiveTransfer(transferId)
    setActiveTransfers((prev) => removeTransfer(prev, transferId))
    setDetail((prev) => (prev.open && prev.id === transferId ? { ...prev, open: false } : prev))
  }, [setActiveTransfers, setDetail])

  const handleStreamEvent = useCallback((event: TransferStreamEvent) => {
    if (event.type === "active_snapshot") {
      setActiveTransfers(sortTransfers(event.items ?? []))
      setActiveLoading(false)
      setActiveReady(true)
      return
    }

    if (event.type === "job_upsert" && event.item) {
      setActiveTransfers((prev) => upsertTransfer(prev, event.item!))
      setDetail((prev) => syncDetailItem(prev, event.item!))
      if (isDetailEventTarget(detailRef.current, event)) {
        void refreshDetail(detailRef.current.id!, false).catch(() => {})
      }
      setActiveLoading(false)
      setActiveReady(true)
      return
    }

    if (event.type === "job_remove" && event.id) {
      setActiveTransfers((prev) => removeTransfer(prev, event.id!))
      setActiveLoading(false)
      setActiveReady(true)
      return
    }

    if (event.type !== "history_upsert" && event.type !== "history_remove") {
      return
    }

    void reloadHistory({ silent: true })
    if (isDetailEventTarget(detailRef.current, event)) {
      void refreshDetail(detailRef.current.id!, false).catch(() => {})
    }
  }, [refreshDetail, reloadHistory, setActiveLoading, setActiveTransfers, setDetail])

  useEffect(() => {
    void refreshHistory(historyQuery)
  }, [historyQuery, refreshHistory])

  useEffect(() => {
    const disconnect = connectTransferStream({
      onEvent: handleStreamEvent,
      onStatusChange: setStreamStatus,
    })
    return disconnect
  }, [handleStreamEvent, setStreamStatus])

  return {
    activeTransfers,
    historyTransfers,
    historyQuery,
    historyPagination,
    detail,
    streamStatus,
    activeLoading,
    activeRefreshing: false,
    activeInitialLoading: activeLoading && !activeReady,
    historyLoading,
    historyRefreshing,
    historyInitialLoading: historyLoading && !historyReady,
    refreshHistory: reloadHistory,
    openDetail,
    closeDetail,
    updateFilters,
    changePage,
    changePageSize,
    removeHistoryItem,
    removeActiveItem,
  }
}
