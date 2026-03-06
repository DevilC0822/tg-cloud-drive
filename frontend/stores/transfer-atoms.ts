import { atom } from "jotai"
import type {
  TransferHistoryPagination,
  TransferHistoryQuery,
  TransferJobDetail,
  TransferJobSummary,
  TransferStreamStatus,
} from "@/lib/transfers-api"

export interface TransferDetailState {
  open: boolean
  id: string | null
  loading: boolean
  data: TransferJobDetail | null
}

export const DEFAULT_TRANSFER_HISTORY_QUERY: TransferHistoryQuery = {
  direction: "all",
  status: "all",
  sourceKind: "all",
  q: "",
  page: 1,
  pageSize: 12,
}

export const DEFAULT_TRANSFER_HISTORY_PAGINATION: TransferHistoryPagination = {
  page: 1,
  pageSize: 12,
  totalCount: 0,
  totalPages: 1,
}

export const activeTransfersAtom = atom<TransferJobSummary[]>([])
export const historyTransfersAtom = atom<TransferJobSummary[]>([])
export const historyQueryAtom = atom<TransferHistoryQuery>(DEFAULT_TRANSFER_HISTORY_QUERY)
export const historyPaginationAtom = atom<TransferHistoryPagination>(DEFAULT_TRANSFER_HISTORY_PAGINATION)
export const transferDetailAtom = atom<TransferDetailState>({
  open: false,
  id: null,
  loading: false,
  data: null,
})
export const transferStreamStatusAtom = atom<TransferStreamStatus>("reconnecting")
export const activeTransfersLoadingAtom = atom(true)
export const historyTransfersLoadingAtom = atom(true)
