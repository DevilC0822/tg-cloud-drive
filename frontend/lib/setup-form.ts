import type { SetupAccessMethod } from "@/lib/profile-api"
import type { SetupConnectionPayload, SetupInitPayload } from "@/lib/setup-api"
import type { SetupText } from "@/lib/setup-i18n"

export const DEFAULT_SELF_HOSTED_BASE_URL = "http://telegram-bot-api:8081"

export interface SetupFormState {
  accessMethod: SetupAccessMethod
  tgBotToken: string
  tgStorageChatId: string
  tgApiId: string
  tgApiHash: string
  tgApiBaseUrl: string
  adminPassword: string
}

export function createSetupForm(): SetupFormState {
  return {
    accessMethod: "official_bot_api",
    tgBotToken: "",
    tgStorageChatId: "",
    tgApiId: "",
    tgApiHash: "",
    tgApiBaseUrl: DEFAULT_SELF_HOSTED_BASE_URL,
    adminPassword: "",
  }
}

function parsePositiveInteger(raw: string, label: string, text: SetupText) {
  const parsed = Number.parseInt(raw.trim(), 10)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(text.positiveInteger(label))
  }
  return parsed
}

function trimValue(value: string) {
  return value.trim()
}

export function buildSetupConnectionPayload(
  form: SetupFormState,
  text: SetupText,
): SetupConnectionPayload {
  const tgBotToken = trimValue(form.tgBotToken)
  const tgStorageChatId = trimValue(form.tgStorageChatId)
  if (!tgBotToken) {
    throw new Error(text.requiredField(text.botTokenLabel))
  }
  if (!tgStorageChatId) {
    throw new Error(text.requiredField(text.chatIdLabel))
  }

  const payload: SetupConnectionPayload = {
    accessMethod: form.accessMethod,
    tgBotToken,
    tgStorageChatId,
  }

  if (form.accessMethod !== "self_hosted_bot_api") {
    return payload
  }

  payload.tgApiId = parsePositiveInteger(form.tgApiId, text.apiIdLabel, text)
  payload.tgApiHash = trimValue(form.tgApiHash)
  if (!payload.tgApiHash) {
    throw new Error(text.requiredField(text.apiHashLabel))
  }

  const baseUrl = trimValue(form.tgApiBaseUrl)
  if (baseUrl) {
    payload.tgApiBaseUrl = baseUrl
  }

  return payload
}

export function buildSetupInitPayload(
  form: SetupFormState,
  text: SetupText,
): SetupInitPayload {
  const payload = buildSetupConnectionPayload(form, text)
  const adminPassword = trimValue(form.adminPassword)
  if (!adminPassword) {
    throw new Error(text.requiredField(text.adminPasswordLabel))
  }
  return { ...payload, adminPassword }
}

export function buildSetupFingerprint(form: SetupFormState) {
  const fields = [
    form.accessMethod,
    trimValue(form.tgBotToken),
    trimValue(form.tgStorageChatId),
    trimValue(form.tgApiId),
    trimValue(form.tgApiHash),
    trimValue(form.tgApiBaseUrl),
  ]
  return JSON.stringify(fields)
}

export function maskSecret(value?: string | null, visibleEdge = 4) {
  const source = value?.trim() ?? ""
  if (!source) {
    return "-"
  }
  if (source.length <= visibleEdge * 2) {
    return `${source.slice(0, 1)}${"*".repeat(Math.max(4, source.length - 1))}`
  }
  const start = source.slice(0, visibleEdge)
  const end = source.slice(-visibleEdge)
  return `${start}${"*".repeat(8)}${end}`
}
