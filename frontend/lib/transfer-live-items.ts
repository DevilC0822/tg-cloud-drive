import type { TransferJobSummary } from "@/lib/transfers-api"
import type { UploadTask } from "@/stores/upload-atoms"

export interface TransferLiveMetrics {
  transferredBytes: number
  totalBytes: number
  currentSpeedBytesPerSecond: number
}

export interface TransferJobListItem extends TransferJobSummary {
  liveMetrics?: TransferLiveMetrics
}

interface AggregatedUploadMetrics {
  transferredBytes: number
  totalBytes: number
  currentSpeedBytesPerSecond: number
}

function inferTransferredBytes(task: UploadTask) {
  if (Number.isFinite(task.transferredBytes)) {
    return Math.min(task.totalBytes, Math.max(0, task.transferredBytes ?? 0))
  }
  if (task.totalChunkCount && task.totalChunkCount > 0 && task.uploadedChunkCount != null) {
    return Math.round((task.totalBytes * task.uploadedChunkCount) / task.totalChunkCount)
  }
  if (task.totalBytes > 0 && task.progress > 0) {
    return Math.round((task.totalBytes * task.progress) / 100)
  }
  return 0
}

function aggregateUploadMetrics(tasks: UploadTask[]) {
  const metricsByTransferId = new Map<string, AggregatedUploadMetrics>()

  for (const task of tasks) {
    if (!task.transferJobId) {
      continue
    }

    const current = metricsByTransferId.get(task.transferJobId) ?? {
      transferredBytes: 0,
      totalBytes: 0,
      currentSpeedBytesPerSecond: 0,
    }
    current.transferredBytes += inferTransferredBytes(task)
    current.totalBytes += Math.max(0, task.totalBytes)
    if (task.status === "uploading") {
      current.currentSpeedBytesPerSecond += Math.max(0, task.currentSpeedBytesPerSecond ?? 0)
    }
    metricsByTransferId.set(task.transferJobId, current)
  }

  return metricsByTransferId
}

function buildLocalPhaseProgress(transferredBytes: number, totalBytes: number) {
  if (totalBytes <= 0) {
    return null
  }

  const clampedBytes = Math.min(totalBytes, Math.max(0, transferredBytes))
  return {
    percent: clampedBytes >= totalBytes ? 100 : Math.round((clampedBytes / totalBytes) * 100),
    current: clampedBytes,
    total: totalBytes,
    unit: "bytes" as const,
  }
}

function overlayTransferItem(item: TransferJobSummary, metrics?: AggregatedUploadMetrics): TransferJobListItem {
  if (item.direction !== "upload") {
    return item
  }

  if (!metrics || item.phase !== "uploading_chunks") {
    return item
  }

  const phaseDetail = item.phaseDetail ?? "local_chunk_uploading"
  if (phaseDetail !== "local_chunk_uploading") {
    return item
  }

  const totalBytes = item.totalSize > 0 ? item.totalSize : metrics.totalBytes
  const phaseProgress = buildLocalPhaseProgress(metrics.transferredBytes, totalBytes)
  return {
    ...item,
    phaseDetail,
    phaseProgress,
    phaseProgressMode: "determinate",
    phaseSpeedBytesPerSecond: Math.max(0, metrics.currentSpeedBytesPerSecond),
    liveMetrics: {
      transferredBytes: Math.max(0, metrics.transferredBytes),
      totalBytes,
      currentSpeedBytesPerSecond: metrics.currentSpeedBytesPerSecond,
    },
  }
}

export function mergeActiveTransfersWithUploadTasks(items: TransferJobSummary[], tasks: UploadTask[]) {
  const metricsByTransferId = aggregateUploadMetrics(tasks)
  return items.map((item) => overlayTransferItem(item, metricsByTransferId.get(item.id)))
}
