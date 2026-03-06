import { useCallback, useEffect, useRef } from "react"
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
  deleteTransferHistoryItem,
  fetchActiveTransfers,
  fetchTransferDetail,
  fetchTransferHistory,
  type TransferHistoryQuery,
  type TransferJobSummary,
  type TransferStreamEvent,
} from "@/lib/transfers-api"

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

export function useTransfers() {
  const [activeTransfers, setActiveTransfers] = useAtom(activeTransfersAtom)
  const [historyTransfers, setHistoryTransfers] = useAtom(historyTransfersAtom)
  const [historyQuery, setHistoryQuery] = useAtom(historyQueryAtom)
  const [historyPagination, setHistoryPagination] = useAtom(historyPaginationAtom)
  const [detail, setDetail] = useAtom(transferDetailAtom)
  const [streamStatus, setStreamStatus] = useAtom(transferStreamStatusAtom)
  const [activeLoading, setActiveLoading] = useAtom(activeTransfersLoadingAtom)
  const [historyLoading, setHistoryLoading] = useAtom(historyTransfersLoadingAtom)

  const historyQueryRef = useRef(historyQuery)
  const detailRef = useRef(detail)
  useEffect(() => {
    historyQueryRef.current = historyQuery
  }, [historyQuery])
  useEffect(() => {
    detailRef.current = detail
  }, [detail])

  const refreshActive = useCallback(async () => {
    setActiveLoading(true)
    try {
      const items = await fetchActiveTransfers()
      setActiveTransfers(sortTransfers(items))
    } finally {
      setActiveLoading(false)
    }
  }, [setActiveLoading, setActiveTransfers])

  const refreshHistory = useCallback(async (query: TransferHistoryQuery) => {
    setHistoryLoading(true)
    try {
      const response = await fetchTransferHistory(query)
      setHistoryTransfers(sortTransfers(response.items))
      setHistoryPagination(response.pagination)
    } finally {
      setHistoryLoading(false)
    }
  }, [setHistoryLoading, setHistoryPagination, setHistoryTransfers])

  const reloadHistory = useCallback(async () => {
    await refreshHistory(historyQueryRef.current)
  }, [refreshHistory])

  const openDetail = useCallback(async (transferId: string) => {
    setDetail({ open: true, id: transferId, loading: true, data: null })
    try {
      const data = await fetchTransferDetail(transferId)
      setDetail((prev) => ({ ...patchDetailState(prev, transferId), open: true, id: transferId, loading: false, data }))
    } catch (error) {
      setDetail((prev) => ({ ...patchDetailState(prev, transferId), open: true, id: transferId, loading: false, data: null }))
      throw error
    }
  }, [setDetail])

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

  const handleStreamEvent = useCallback((event: TransferStreamEvent) => {
    if (event.type === "job_upsert" && event.item) {
      setActiveTransfers((prev) => upsertTransfer(prev, event.item!))
      if (detailRef.current.open && detailRef.current.id === event.item.id) {
        void openDetail(event.item.id).catch(() => {})
      }
      return
    }
    if (event.type === "job_remove" && event.id) {
      setActiveTransfers((prev) => removeTransfer(prev, event.id!))
      return
    }
    if ((event.type === "history_upsert" || event.type === "history_remove")) {
      void reloadHistory()
      if (detailRef.current.open && (event.id === detailRef.current.id || event.item?.id === detailRef.current.id)) {
        void openDetail(detailRef.current.id!).catch(() => {})
      }
    }
  }, [openDetail, reloadHistory, setActiveTransfers])

  useEffect(() => {
    void refreshActive()
  }, [refreshActive])

  useEffect(() => {
    void refreshHistory(historyQuery)
  }, [historyQuery, refreshHistory])

  useEffect(() => {
    const disconnect = connectTransferStream({
      onEvent: handleStreamEvent,
      onStatusChange: (status) => {
        setStreamStatus(status)
        if (status === "connected") {
          void refreshActive()
        }
      },
    })
    return disconnect
  }, [handleStreamEvent, refreshActive, setStreamStatus])

  return {
    activeTransfers,
    historyTransfers,
    historyQuery,
    historyPagination,
    detail,
    streamStatus,
    activeLoading,
    historyLoading,
    refreshActive,
    refreshHistory: reloadHistory,
    openDetail,
    closeDetail,
    updateFilters,
    changePage,
    changePageSize,
    removeHistoryItem,
  }
}
