import type {
  TransferJobSummary,
  TransferStreamEvent,
  TransferStreamStatus,
} from "@/lib/transfers-api"

type TransferStreamHandlers = {
  onEvent: (event: TransferStreamEvent) => void
  onStatusChange: (status: TransferStreamStatus) => void
}

const STREAM_CLOSE_DELAY_MS = 250

const transferStreamSubscribers = new Set<TransferStreamHandlers>()

let transferStreamSource: EventSource | null = null
let transferActiveSnapshot: TransferJobSummary[] | null = null
let transferStreamStatus: TransferStreamStatus = "reconnecting"
let transferStreamCloseTimer: number | null = null

export function connectTransferStream(handlers: TransferStreamHandlers) {
  if (transferStreamCloseTimer !== null) {
    window.clearTimeout(transferStreamCloseTimer)
    transferStreamCloseTimer = null
  }

  transferStreamSubscribers.add(handlers)
  if (transferStreamSource) {
    handlers.onStatusChange(transferStreamStatus)
    if (transferActiveSnapshot) {
      handlers.onEvent({ type: "active_snapshot", items: transferActiveSnapshot })
    }
  } else {
    ensureTransferStream()
  }

  return () => {
    transferStreamSubscribers.delete(handlers)
    if (transferStreamSubscribers.size === 0) {
      scheduleTransferStreamClose()
    }
  }
}

function ensureTransferStream() {
  if (transferStreamSource) {
    return
  }

  setTransferStreamStatus("reconnecting")
  transferActiveSnapshot = null
  const source = new EventSource("/api/transfers/stream", { withCredentials: true })
  transferStreamSource = source

  source.onopen = () => {
    setTransferStreamStatus("connected")
  }

  source.onmessage = (message) => {
    try {
      const event = JSON.parse(message.data) as TransferStreamEvent
      transferActiveSnapshot = patchActiveSnapshot(transferActiveSnapshot, event)
      for (const subscriber of transferStreamSubscribers) {
        subscriber.onEvent(event)
      }
    } catch {
      setTransferStreamStatus("error")
    }
  }

  source.onerror = () => {
    setTransferStreamStatus("reconnecting")
  }
}

function scheduleTransferStreamClose() {
  if (transferStreamCloseTimer !== null) {
    return
  }

  transferStreamCloseTimer = window.setTimeout(() => {
    transferStreamCloseTimer = null
    if (transferStreamSubscribers.size > 0 || !transferStreamSource) {
      return
    }
    transferStreamSource.close()
    transferStreamSource = null
    transferActiveSnapshot = null
    transferStreamStatus = "reconnecting"
  }, STREAM_CLOSE_DELAY_MS)
}

function setTransferStreamStatus(status: TransferStreamStatus) {
  transferStreamStatus = status
  for (const subscriber of transferStreamSubscribers) {
    subscriber.onStatusChange(status)
  }
}

function patchActiveSnapshot(snapshot: TransferJobSummary[] | null, event: TransferStreamEvent) {
  if (event.type === "active_snapshot") {
    return event.items ?? []
  }
  if (event.type === "job_upsert" && event.item) {
    const nextItem = event.item
    const current = snapshot ?? []
    return [nextItem, ...current.filter((item) => item.id !== nextItem.id)]
  }
  if (event.type === "job_remove" && event.id) {
    return (snapshot ?? []).filter((item) => item.id !== event.id)
  }
  return snapshot
}
