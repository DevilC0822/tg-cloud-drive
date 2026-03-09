import { ApiError, apiFetchJson } from "@/lib/api"
import type { SetupAccessMethod } from "@/lib/profile-api"

export interface SetupStatus {
  initialized: boolean
}

export interface SetupConnectionStep {
  ok: boolean
  id?: number
  username?: string
  isBot?: boolean
  type?: string
  title?: string
  adminCount?: number
  error?: string
}

export interface SetupConnectionDetails {
  accessMethod: SetupAccessMethod
  apiBaseUrl?: string
  overallOk: boolean
  summary: string
  testedAt: string
  bot?: SetupConnectionStep
  chat?: SetupConnectionStep
  admin?: SetupConnectionStep
}

export interface SetupConnectionPayload {
  accessMethod: SetupAccessMethod
  tgBotToken: string
  tgStorageChatId: string
  tgApiId?: number
  tgApiHash?: string
  tgApiBaseUrl?: string
}

export interface SetupInitPayload extends SetupConnectionPayload {
  adminPassword: string
}

interface SetupConnectionResponse {
  ok: boolean
  details: SetupConnectionDetails
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object"
}

function isSetupConnectionDetails(value: unknown): value is SetupConnectionDetails {
  if (!isObject(value)) {
    return false
  }
  return typeof value.summary === "string" && typeof value.testedAt === "string"
}

function assertSetupStatus(response: unknown): asserts response is SetupStatus {
  if (!isObject(response) || typeof response.initialized !== "boolean") {
    throw new Error("Invalid /api/setup/status response")
  }
}

function assertSetupConnectionResponse(
  response: unknown,
): asserts response is SetupConnectionResponse {
  if (!isObject(response) || typeof response.ok !== "boolean") {
    throw new Error("Invalid setup connection response")
  }
  if (!isSetupConnectionDetails(response.details)) {
    throw new Error("Invalid setup connection details")
  }
}

export async function fetchSetupStatus() {
  const response = await apiFetchJson<SetupStatus>("/api/setup/status")
  assertSetupStatus(response)
  return response
}

export async function testSetupConnection(payload: SetupConnectionPayload) {
  const response = await apiFetchJson<SetupConnectionResponse>(
    "/api/setup/test-connection",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  )
  assertSetupConnectionResponse(response)
  return response
}

export async function initializeSetup(payload: SetupInitPayload) {
  return apiFetchJson<{ ok: boolean }>("/api/setup/init", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export function readSetupConnectionDetails(error: unknown) {
  if (!(error instanceof ApiError)) {
    return null
  }
  return isSetupConnectionDetails(error.payload?.details) ? error.payload.details : null
}
