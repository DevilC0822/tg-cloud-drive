import type {
  TransferJobDetail,
  TransferJobSummary,
  TransferPreviewItem,
  TransferStreamEvent,
} from "@/lib/transfers-api"

type TransferJobSummaryInput = Omit<TransferJobSummary, "previewItems" | "phaseSteps"> & {
  previewItems?: TransferPreviewItem[] | null
  phaseSteps?: string[] | null
}

type TransferJobDetailInput = Omit<TransferJobDetail, "item"> & {
  item: TransferJobSummaryInput
}

type TransferStreamEventInput = Omit<TransferStreamEvent, "item" | "items"> & {
  item?: TransferJobSummaryInput
  items?: TransferJobSummaryInput[]
}

export function normalizeTransferJobSummary(item: TransferJobSummaryInput): TransferJobSummary {
  return {
    ...item,
    previewItems: item.previewItems ?? [],
    phaseSteps: item.phaseSteps ?? [],
  }
}

export function normalizeTransferJobDetail(detail: TransferJobDetailInput): TransferJobDetail {
  return {
    ...detail,
    item: normalizeTransferJobSummary(detail.item),
  }
}

export function normalizeTransferStreamEvent(event: TransferStreamEventInput): TransferStreamEvent {
  switch (event.type) {
    case "active_snapshot":
      return {
        type: event.type,
        id: event.id,
        items: (event.items ?? []).map(normalizeTransferJobSummary),
      }
    case "job_upsert":
    case "history_upsert":
      return event.item
        ? {
            type: event.type,
            id: event.id,
            item: normalizeTransferJobSummary(event.item),
          }
        : {
            type: event.type,
            id: event.id,
          }
    case "job_remove":
    case "history_remove":
      return {
        type: event.type,
        id: event.id,
      }
  }
}
