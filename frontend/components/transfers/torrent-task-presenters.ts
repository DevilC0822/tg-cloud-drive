import { CircleAlert, Clock3, Link2, Upload, type LucideIcon } from "lucide-react"
import { semanticToneClasses, themeToneClasses } from "@/lib/palette"
import type {
  TorrentCleanupPolicy,
  TorrentSourceType,
  TorrentTaskDetail,
  TorrentTaskStatus,
  TorrentTaskSummary,
} from "@/lib/torrent-api"
import type { transferMessages } from "@/lib/i18n"

type TransferText = (typeof transferMessages)["en"]

export function getTorrentTaskStatusTone(status: TorrentTaskStatus) {
  if (status === "completed") {
    return semanticToneClasses.success.badge
  }
  if (status === "error") {
    return semanticToneClasses.error.badge
  }
  if (status === "queued" || status === "awaiting_selection") {
    return semanticToneClasses.warning.badge
  }
  return themeToneClasses.info.badge
}

export function getTorrentTaskStatusIcon(status: TorrentTaskStatus): LucideIcon {
  if (status === "completed") {
    return Upload
  }
  if (status === "error") {
    return CircleAlert
  }
  return Clock3
}

export function getTorrentTaskStatusLabel(status: TorrentTaskStatus, text: TransferText) {
  if (status === "queued") return text.torrentStatusQueued
  if (status === "downloading") return text.torrentStatusDownloading
  if (status === "awaiting_selection") return text.torrentStatusAwaitingSelection
  if (status === "uploading") return text.torrentStatusUploading
  if (status === "completed") return text.torrentStatusCompleted
  return text.torrentStatusError
}

export function getTorrentSourceIcon(sourceType: TorrentSourceType) {
  return sourceType === "url" ? Link2 : Upload
}

export function getTorrentSourceLabel(sourceType: TorrentSourceType, text: TransferText) {
  return sourceType === "url" ? text.torrentSourceUrl : text.torrentSourceFile
}

export function getTorrentCleanupPolicyLabel(policy: TorrentCleanupPolicy, text: TransferText) {
  if (policy === "never") return text.torrentCleanupNever
  if (policy === "fixed") return text.torrentCleanupFixed
  if (policy === "random") return text.torrentCleanupRandom
  return text.torrentCleanupImmediate
}

export function getTorrentCleanupStateLabel(task: TorrentTaskSummary | TorrentTaskDetail, text: TransferText) {
  return task.sourceCleanupDone ? text.torrentCleanupDone : text.torrentCleanupPending
}

export function countSelectedFiles(task: TorrentTaskDetail) {
  return task.files.filter((file) => file.selected).length
}

export function countUploadedFiles(task: TorrentTaskDetail) {
  return task.files.filter((file) => file.selected && file.uploaded).length
}

export function countFailedFiles(task: TorrentTaskDetail) {
  return task.files.filter((file) => file.selected && file.error).length
}
