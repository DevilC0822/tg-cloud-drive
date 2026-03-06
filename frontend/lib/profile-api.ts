import { apiFetchJson } from "@/lib/api"

export type StorageTypeKey = "image" | "video" | "audio" | "document" | "archive" | "code" | "other"

export interface StorageTypeStats {
  bytes: number
  count: number
}

export interface StorageStats {
  totalBytes: number
  totalFiles: number
  byType: Record<StorageTypeKey, StorageTypeStats>
}

export type SetupAccessMethod = "official_bot_api" | "self_hosted_bot_api" | "mtproto"

export interface ServiceAccess {
  accessMethod: SetupAccessMethod
  tgBotToken?: string | null
  tgStorageChatId?: string | null
  tgApiId?: number | null
  tgApiHash?: string | null
  tgApiBaseUrl?: string | null
}

interface StorageStatsDTO {
  totalBytes: number
  totalFiles: number
  byType: Partial<Record<StorageTypeKey, StorageTypeStats>>
}

function isServiceAccess(value: unknown): value is ServiceAccess {
  if (!value || typeof value !== "object") return false
  const payload = value as Partial<ServiceAccess>
  return typeof payload.accessMethod === "string"
}

function emptyStorageStats(): StorageStats {
  return {
    totalBytes: 0,
    totalFiles: 0,
    byType: {
      image: { bytes: 0, count: 0 },
      video: { bytes: 0, count: 0 },
      audio: { bytes: 0, count: 0 },
      document: { bytes: 0, count: 0 },
      archive: { bytes: 0, count: 0 },
      code: { bytes: 0, count: 0 },
      other: { bytes: 0, count: 0 },
    },
  }
}

function normalizeStorageStats(dto?: StorageStatsDTO): StorageStats {
  const empty = emptyStorageStats()
  if (!dto) return empty

  const byType = { ...empty.byType }
  ;(Object.keys(byType) as StorageTypeKey[]).forEach((key) => {
    const source = dto.byType?.[key]
    byType[key] = {
      bytes: Number.isFinite(source?.bytes) ? Math.max(0, source?.bytes || 0) : 0,
      count: Number.isFinite(source?.count) ? Math.max(0, source?.count || 0) : 0,
    }
  })

  return {
    totalBytes: Number.isFinite(dto.totalBytes) ? Math.max(0, dto.totalBytes) : 0,
    totalFiles: Number.isFinite(dto.totalFiles) ? Math.max(0, dto.totalFiles) : 0,
    byType,
  }
}

export async function fetchStorageStats() {
  const result = await apiFetchJson<{ stats: StorageStatsDTO }>("/api/storage/stats")
  return normalizeStorageStats(result.stats)
}

export async function fetchServiceAccess() {
  const result = await apiFetchJson<{ settings: { serviceAccess: ServiceAccess } }>("/api/settings")
  if (!isServiceAccess(result?.settings?.serviceAccess)) {
    throw new Error("Invalid /api/settings response: missing settings.serviceAccess")
  }
  return result.settings.serviceAccess
}
