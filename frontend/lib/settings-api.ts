import { apiFetchJson } from "@/lib/api"
import type { ServiceAccess, SetupAccessMethod } from "@/lib/profile-api"

export type TorrentSourceDeleteMode = "never" | "immediate" | "fixed" | "random"

export interface RuntimeSettings {
  uploadConcurrency: number
  downloadConcurrency: number
  telegramDeleteConcurrency: number
  reservedDiskBytes: number
  uploadSessionTtlHours: number
  uploadSessionCleanupIntervalMinutes: number
  thumbnailCacheMaxBytes: number
  thumbnailCacheTtlHours: number
  thumbnailGenerateConcurrency: number
  vaultSessionTtlMinutes: number
  vaultPasswordEnabled: boolean
  torrentQbtPasswordConfigured: boolean
  torrentSourceDeleteMode: TorrentSourceDeleteMode
  torrentSourceDeleteFixedMinutes: number
  torrentSourceDeleteRandomMinMinutes: number
  torrentSourceDeleteRandomMaxMinutes: number
  chunkSizeBytes: number
}

export interface PatchRuntimeSettingsPayload {
  uploadConcurrency?: number
  downloadConcurrency?: number
  telegramDeleteConcurrency?: number
  reservedDiskBytes?: number
  uploadSessionTtlHours?: number
  uploadSessionCleanupIntervalMinutes?: number
  thumbnailCacheMaxBytes?: number
  thumbnailCacheTtlHours?: number
  thumbnailGenerateConcurrency?: number
  vaultSessionTtlMinutes?: number
  vaultPassword?: string
  adminPassword?: string
  torrentQbtPassword?: string
  torrentSourceDeleteMode?: TorrentSourceDeleteMode
  torrentSourceDeleteFixedMinutes?: number
  torrentSourceDeleteRandomMinMinutes?: number
  torrentSourceDeleteRandomMaxMinutes?: number
}

export interface ServiceAccessStep {
  ok: boolean
  id?: number
  username?: string
  isBot?: boolean
  type?: string
  title?: string
  adminCount?: number
  error?: string
}

export interface ServiceAccessTestDetails {
  accessMethod: SetupAccessMethod
  apiBaseUrl?: string
  overallOk: boolean
  summary: string
  testedAt: string
  bot?: ServiceAccessStep
  chat?: ServiceAccessStep
  admin?: ServiceAccessStep
}

export interface PatchServiceAccessPayload {
  accessMethod: SetupAccessMethod
  tgBotToken?: string
  tgStorageChatId?: string
  tgApiId?: number
  tgApiHash?: string
  tgApiBaseUrl?: string
}

export interface ServiceSwitchResult {
  ok: boolean
  rolledBack: boolean
  unchanged?: boolean
  message?: string
  details?: ServiceAccessTestDetails
}

export interface UnifiedSettings {
  runtime: RuntimeSettings
  serviceAccess: ServiceAccess
}

interface SettingsResponse {
  settings: UnifiedSettings
  switchResult?: ServiceSwitchResult
}

interface RuntimeSettingsResponse {
  runtime: RuntimeSettings
}

export interface PatchSettingsPayload {
  runtime?: PatchRuntimeSettingsPayload
  serviceAccess?: PatchServiceAccessPayload
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object"
}

function assertSettingsResponse(response: unknown): asserts response is SettingsResponse {
  if (!isObject(response)) {
    throw new Error("Invalid /api/settings response: payload is not an object")
  }
  const settings = response.settings
  if (!isObject(settings)) {
    throw new Error("Invalid /api/settings response: missing settings")
  }
  if (!isObject(settings.runtime)) {
    throw new Error("Invalid /api/settings response: missing settings.runtime")
  }
  if (!isObject(settings.serviceAccess) || typeof settings.serviceAccess.accessMethod !== "string") {
    throw new Error("Invalid /api/settings response: missing settings.serviceAccess.accessMethod")
  }
}

export async function fetchSettings() {
  const response = await apiFetchJson<SettingsResponse>("/api/settings")
  assertSettingsResponse(response)
  return response.settings
}

export async function fetchRuntimeSettings() {
  const response = await apiFetchJson<RuntimeSettingsResponse>("/api/settings/runtime")
  if (!isObject(response) || !isObject(response.runtime)) {
    throw new Error("Invalid /api/settings/runtime response: missing runtime")
  }
  return response.runtime
}

export async function patchSettings(payload: PatchSettingsPayload) {
  const response = await apiFetchJson<SettingsResponse>("/api/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  assertSettingsResponse(response)
  return response
}
