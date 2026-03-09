import { ApiError } from "@/lib/api"
import type { SetupAccessMethod } from "@/lib/profile-api"
import type { PatchRuntimeSettingsPayload, RuntimeSettings, ServiceAccessTestDetails, TorrentSourceDeleteMode } from "@/lib/settings-api"
import type { SettingsText } from "@/lib/settings-i18n"

export const BYTES_PER_GB = 1024 * 1024 * 1024
export const BYTES_PER_MB = 1024 * 1024
const MAX_DELETE_MINUTES = 10080

export const DEFAULT_RUNTIME_SETTINGS: RuntimeSettings = {
  uploadConcurrency: 4,
  downloadConcurrency: 1,
  telegramDeleteConcurrency: 12,
  reservedDiskBytes: 0,
  uploadSessionTtlHours: 24,
  uploadSessionCleanupIntervalMinutes: 30,
  thumbnailCacheMaxBytes: 64 * BYTES_PER_MB,
  thumbnailCacheTtlHours: 24,
  thumbnailGenerateConcurrency: 1,
  vaultSessionTtlMinutes: 60,
  vaultPasswordEnabled: false,
  torrentQbtPasswordConfigured: false,
  torrentSourceDeleteMode: "immediate",
  torrentSourceDeleteFixedMinutes: 30,
  torrentSourceDeleteRandomMinMinutes: 30,
  torrentSourceDeleteRandomMaxMinutes: 120,
  chunkSizeBytes: 20 * BYTES_PER_MB,
}

export interface RuntimeFormState {
  uploadConcurrency: string
  downloadConcurrency: string
  telegramDeleteConcurrency: string
  reservedDiskGb: string
  uploadSessionTtlHours: string
  uploadSessionCleanupMinutes: string
  thumbnailCacheMaxMb: string
  thumbnailCacheTtlHours: string
  thumbnailGenerateConcurrency: string
  vaultSessionTtlMinutes: string
  vaultPassword: string
  adminPassword: string
  torrentQbtPassword: string
  torrentDeleteMode: TorrentSourceDeleteMode
  torrentFixedMinutes: string
  torrentRandomMin: string
  torrentRandomMax: string
}

export interface ServiceFormState {
  accessMethod: SetupAccessMethod
  tgBotToken: string
  tgStorageChatId: string
  tgApiId: string
  tgApiHash: string
  tgApiBaseUrl: string
}

export interface ServiceSwitchResult {
  testedAt: string
  message: string
  rolledBack: boolean
  details: ServiceAccessTestDetails | null
}

export function normalizeAccessMethod(method: SetupAccessMethod | string): SetupAccessMethod {
  if (method === "self_hosted_bot_api") return method
  return "official_bot_api"
}

function toDiskGBText(value: number) {
  const gbValue = value / BYTES_PER_GB
  const rounded = Number.isInteger(gbValue) ? gbValue.toString() : gbValue.toFixed(2)
  return rounded.replace(/\.?0+$/, "")
}

function toCacheMBText(value: number) {
  return String(Math.max(1, Math.round(value / BYTES_PER_MB)))
}

export function createRuntimeForm(settings: RuntimeSettings): RuntimeFormState {
  return {
    uploadConcurrency: String(settings.uploadConcurrency),
    downloadConcurrency: String(settings.downloadConcurrency),
    telegramDeleteConcurrency: String(settings.telegramDeleteConcurrency),
    reservedDiskGb: toDiskGBText(settings.reservedDiskBytes),
    uploadSessionTtlHours: String(settings.uploadSessionTtlHours),
    uploadSessionCleanupMinutes: String(settings.uploadSessionCleanupIntervalMinutes),
    thumbnailCacheMaxMb: toCacheMBText(settings.thumbnailCacheMaxBytes),
    thumbnailCacheTtlHours: String(settings.thumbnailCacheTtlHours),
    thumbnailGenerateConcurrency: String(settings.thumbnailGenerateConcurrency),
    vaultSessionTtlMinutes: String(settings.vaultSessionTtlMinutes),
    vaultPassword: "",
    adminPassword: "",
    torrentQbtPassword: "",
    torrentDeleteMode: settings.torrentSourceDeleteMode,
    torrentFixedMinutes: String(settings.torrentSourceDeleteFixedMinutes),
    torrentRandomMin: String(settings.torrentSourceDeleteRandomMinMinutes),
    torrentRandomMax: String(settings.torrentSourceDeleteRandomMaxMinutes),
  }
}

export function createServiceForm(source: ServiceFormState): ServiceFormState {
  return {
    accessMethod: source.accessMethod,
    tgBotToken: source.tgBotToken,
    tgStorageChatId: source.tgStorageChatId,
    tgApiId: source.tgApiId,
    tgApiHash: source.tgApiHash,
    tgApiBaseUrl: source.tgApiBaseUrl,
  }
}

export function serviceToForm(access: {
  accessMethod: SetupAccessMethod
  tgBotToken?: string | null
  tgStorageChatId?: string | null
  tgApiId?: number | null
  tgApiHash?: string | null
  tgApiBaseUrl?: string | null
}): ServiceFormState {
  return {
    accessMethod: normalizeAccessMethod(access.accessMethod),
    tgBotToken: access.tgBotToken ?? "",
    tgStorageChatId: access.tgStorageChatId ?? "",
    tgApiId: access.tgApiId != null ? String(access.tgApiId) : "",
    tgApiHash: access.tgApiHash ?? "",
    tgApiBaseUrl: access.tgApiBaseUrl ?? "",
  }
}

export function readApiMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError && error.message) return error.message
  if (error instanceof Error && error.message) return error.message
  return fallback
}

export function isServiceDetails(value: unknown): value is ServiceAccessTestDetails {
  if (!value || typeof value !== "object") return false
  const payload = value as Partial<ServiceAccessTestDetails>
  return typeof payload.summary === "string" && typeof payload.testedAt === "string"
}

function parsePositiveInteger(raw: string, label: string, min: number, max: number, text: SettingsText) {
  const parsed = Number.parseInt(raw.trim(), 10)
  if (!Number.isInteger(parsed)) throw new Error(text.positiveInteger(label))
  if (parsed < min || parsed > max) throw new Error(text.rangeError(label, min, max))
  return parsed
}

function parseNonNegativeFloat(raw: string, label: string, text: SettingsText) {
  const parsed = Number.parseFloat(raw.trim())
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(text.nonNegative(label))
  return parsed
}

export function buildRuntimePayload(form: RuntimeFormState, text: SettingsText): PatchRuntimeSettingsPayload {
  const payload: PatchRuntimeSettingsPayload = {
    uploadConcurrency: parsePositiveInteger(form.uploadConcurrency, text.transferUploadConcurrency, 1, 16, text),
    downloadConcurrency: parsePositiveInteger(form.downloadConcurrency, text.transferDownloadConcurrency, 1, 32, text),
    telegramDeleteConcurrency: parsePositiveInteger(form.telegramDeleteConcurrency, text.transferDeleteConcurrency, 1, 32, text),
    reservedDiskBytes: Math.round(parseNonNegativeFloat(form.reservedDiskGb, text.transferReservedDiskGb, text) * BYTES_PER_GB),
    uploadSessionTtlHours: parsePositiveInteger(form.uploadSessionTtlHours, text.sessionsTtlHours, 1, 720, text),
    uploadSessionCleanupIntervalMinutes: parsePositiveInteger(form.uploadSessionCleanupMinutes, text.sessionsCleanupMinutes, 1, 1440, text),
    thumbnailCacheMaxBytes: parsePositiveInteger(form.thumbnailCacheMaxMb, text.storageThumbMaxMb, 64, 10 * 1024, text) * BYTES_PER_MB,
    thumbnailCacheTtlHours: parsePositiveInteger(form.thumbnailCacheTtlHours, text.storageThumbTtlHours, 1, 8760, text),
    thumbnailGenerateConcurrency: parsePositiveInteger(form.thumbnailGenerateConcurrency, text.storageThumbConcurrency, 1, 4, text),
    vaultSessionTtlMinutes: parsePositiveInteger(form.vaultSessionTtlMinutes, text.vaultSessionMinutes, 1, 1440, text),
    torrentSourceDeleteMode: form.torrentDeleteMode,
  }

  const vaultPassword = form.vaultPassword.trim()
  const adminPassword = form.adminPassword.trim()
  const qbtPassword = form.torrentQbtPassword.trim()
  if (vaultPassword) {
    if (!adminPassword) throw new Error(text.requiredField(text.adminPassword))
    payload.vaultPassword = vaultPassword
    payload.adminPassword = adminPassword
  }
  if (qbtPassword) payload.torrentQbtPassword = qbtPassword
  if (form.torrentDeleteMode === "fixed") {
    payload.torrentSourceDeleteFixedMinutes = parsePositiveInteger(form.torrentFixedMinutes, text.torrentFixedMinutes, 1, MAX_DELETE_MINUTES, text)
  }
  if (form.torrentDeleteMode === "random") {
    const minValue = parsePositiveInteger(form.torrentRandomMin, text.torrentRandomMin, 1, MAX_DELETE_MINUTES, text)
    const maxValue = parsePositiveInteger(form.torrentRandomMax, text.torrentRandomMax, 1, MAX_DELETE_MINUTES, text)
    if (minValue > maxValue) throw new Error(text.rangeError(text.torrentRandomMax, minValue, MAX_DELETE_MINUTES))
    payload.torrentSourceDeleteRandomMinMinutes = minValue
    payload.torrentSourceDeleteRandomMaxMinutes = maxValue
  }
  return payload
}

export function buildServicePayload(form: ServiceFormState, text: SettingsText) {
  const botToken = form.tgBotToken.trim()
  const chatId = form.tgStorageChatId.trim()
  if (!botToken) throw new Error(text.requiredField(text.serviceBotToken))
  if (!chatId) throw new Error(text.requiredField(text.serviceChatId))

  const payload: {
    accessMethod: SetupAccessMethod
    tgBotToken: string
    tgStorageChatId: string
    tgApiId?: number
    tgApiHash?: string
    tgApiBaseUrl?: string
  } = {
    accessMethod: form.accessMethod,
    tgBotToken: botToken,
    tgStorageChatId: chatId,
  }

  if (form.accessMethod === "self_hosted_bot_api") {
    const apiId = parsePositiveInteger(form.tgApiId, text.serviceApiId, 1, Number.MAX_SAFE_INTEGER, text)
    const apiHash = form.tgApiHash.trim()
    if (!apiHash) throw new Error(text.requiredField(text.serviceApiHash))
    payload.tgApiId = apiId
    payload.tgApiHash = apiHash
    if (form.tgApiBaseUrl.trim()) payload.tgApiBaseUrl = form.tgApiBaseUrl.trim()
  }
  return payload
}
