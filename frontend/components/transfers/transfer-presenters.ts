import {
  ArrowDownLeft,
  ArrowUpRight,
  Boxes,
  CircleAlert,
  Clock3,
  Download,
  type LucideIcon,
  Package2,
  Radio,
} from "lucide-react"
import { getTransferStatusToneClasses } from "@/lib/palette"
import type { TransferJobSummary, TransferPhase, TransferSourceKind, TransferJobStatus, TransferDirection } from "@/lib/transfers-api"
import type { transferMessages } from "@/lib/i18n"
import { formatFileSize, formatRelativeTime } from "@/lib/files"

type TransferText = (typeof transferMessages)["en"]

function formatAbsoluteTime(value: string) {
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) {
    return "—"
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp)
}

export function getTransferDirectionIcon(direction: TransferDirection): LucideIcon {
  return direction === "download" ? ArrowDownLeft : ArrowUpRight
}

export function getTransferSourceIcon(sourceKind: TransferSourceKind): LucideIcon {
  if (sourceKind === "upload_batch") return Boxes
  if (sourceKind === "torrent_task") return Radio
  if (sourceKind === "download_task") return Download
  return Package2
}

export function getTransferStatusIcon(status: TransferJobStatus): LucideIcon {
  if (status === "error" || status === "canceled") return CircleAlert
  if (status === "running") return Clock3
  return Package2
}

export function getTransferStatusLabel(status: TransferJobStatus, text: TransferText) {
  if (status === "completed") return text.statusCompleted
  if (status === "error") return text.statusError
  if (status === "canceled") return text.statusCanceled
  return text.statusRunning
}

export function getTransferDirectionLabel(direction: TransferDirection, text: TransferText) {
  return direction === "download" ? text.directionDownload : text.directionUpload
}

export function getTransferSourceLabel(sourceKind: TransferSourceKind, text: TransferText) {
  if (sourceKind === "upload_batch") return text.sourceUploadBatch
  if (sourceKind === "torrent_task") return text.sourceTorrentTask
  if (sourceKind === "download_task") return text.sourceDownloadTask
  return text.sourceUploadSession
}

export function getTransferPhaseLabel(phase: TransferPhase, text: TransferText) {
  if (phase === "uploading_chunks") return text.phaseUploadingChunks
  if (phase === "finalizing") return text.phaseFinalizing
  if (phase === "downloading") return text.phaseDownloading
  if (phase === "queued") return text.phaseQueued
  if (phase === "torrent_downloading") return text.phaseTorrentDownloading
  if (phase === "awaiting_selection") return text.phaseAwaitingSelection
  if (phase === "torrent_uploading") return text.phaseTorrentUploading
  return text.phaseIdle
}

export function getTransferStatusTone(status: TransferJobStatus) {
  return getTransferStatusToneClasses(status)
}

export function getTransferProgressLabel(item: TransferJobSummary) {
  if (item.progress.unit === "bytes") {
    return `${formatFileSize(item.progress.current)} / ${formatFileSize(item.progress.total)}`
  }
  return `${item.progress.current} / ${item.progress.total} ${item.progress.unit}`
}

export function getTransferCountsLabel(item: TransferJobSummary, text: TransferText) {
  if (item.batchMode === "folder") {
    const parts = [
      `${text.itemCount}: ${item.itemCount}`,
      `${text.directoryCount}: ${item.directoryCount ?? 0}`,
      `${text.uploaded}: ${item.completedCount}`,
    ]
    if ((item.activeCount ?? 0) > 0) {
      parts.push(`${text.activeFiles}: ${item.activeCount}`)
    }
    if (item.errorCount > 0) {
      parts.push(`${text.failed}: ${item.errorCount}`)
    }
    return parts.join(" · ")
  }

  const parts = [
    `${text.itemCount}: ${item.itemCount}`,
    `${text.uploaded}: ${item.completedCount}`,
  ]
  if (item.errorCount > 0) {
    parts.push(`${text.failed}: ${item.errorCount}`)
  }
  if (item.canceledCount > 0) {
    parts.push(`${text.canceled}: ${item.canceledCount}`)
  }
  return parts.join(" · ")
}

export function getTransferUpdatedLabel(item: TransferJobSummary) {
  return formatRelativeTime(item.updatedAt)
}

export function getTransferStartedLabel(item: TransferJobSummary) {
  return formatAbsoluteTime(item.startedAt)
}

export function countTransfersFailed(items: TransferJobSummary[]) {
  return items.filter((item) => item.status === "error").length
}

export function countTransfersCompletedLastDay(items: TransferJobSummary[]) {
  const threshold = Date.now() - 24 * 60 * 60 * 1000
  return items.filter((item) => item.status === "completed" && Date.parse(item.finishedAt) >= threshold).length
}
