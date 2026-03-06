import { ApiError } from "@/lib/api"

export interface VaultBatchFailure {
  itemId: string
  name: string
  stage: string
  error: string
}

export interface VaultBatchSummary {
  totalTargets: number
  succeededTargets: number
  failedTargets: number
  totalItems: number
  updatedItems: number
  eligibleSpoilerFiles: number
  processedEligibleFiles: number
  appliedSpoilerFiles: number
  skippedSpoilerFiles: number
  failedSpoilerFiles: number
  failures: VaultBatchFailure[]
}

export interface VaultBatchProgressEvent {
  type: "init" | "target_start" | "target_progress" | "target_done" | "done" | "error"
  enabled?: boolean
  stage?: string
  message?: string
  totalTargets: number
  doneTargets: number
  succeededTargets: number
  failedTargets: number
  percent: number
  currentItemId?: string
  currentItemName?: string
  currentItemType?: string
  currentItemPercent: number
  totalItems: number
  eligibleSpoilerFiles: number
  processedEligibleFiles: number
  appliedSpoilerFiles: number
  skippedSpoilerFiles: number
  failedSpoilerFiles: number
  summary?: VaultBatchSummary
}

interface VaultBatchResponse {
  summary: VaultBatchSummary
}

export async function setItemsVaultedBatch(
  itemIds: string[],
  enabled: boolean,
): Promise<VaultBatchSummary> {
  const response = await fetch("/api/items/vault/batch", {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ itemIds, enabled }),
  })

  if (!response.ok) {
    throw await buildApiError(response)
  }

  const payload = (await response.json()) as VaultBatchResponse
  return payload.summary
}

export async function setItemsVaultedBatchWithProgress(
  itemIds: string[],
  enabled: boolean,
  onEvent: (event: VaultBatchProgressEvent) => void,
): Promise<VaultBatchSummary> {
  const response = await fetch("/api/items/vault/batch?progress=1", {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/x-ndjson",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ itemIds, enabled }),
  })

  if (!response.ok) {
    throw await buildApiError(response)
  }
  if (!response.body) {
    throw new Error("Vault batch stream is unavailable")
  }

  let doneSummary: VaultBatchSummary | null = null
  await consumeNdjsonStream(response.body, (line) => {
    const event = parseVaultBatchEvent(line)
    onEvent(event)
    if (event.type === "error") {
      throw new Error(event.message || "Vault batch failed")
    }
    if (event.type === "done") {
      doneSummary = event.summary || null
    }
  })

  if (doneSummary === null) {
    throw new Error("Vault batch stream ended unexpectedly")
  }
  return doneSummary
}

function parseVaultBatchEvent(line: string): VaultBatchProgressEvent {
  const raw = JSON.parse(line) as Record<string, unknown>
  const type = toEventType(raw.type)
  return {
    type,
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : undefined,
    stage: typeof raw.stage === "string" ? raw.stage : undefined,
    message: typeof raw.message === "string" ? raw.message : undefined,
    totalTargets: toNumber(raw.totalTargets),
    doneTargets: toNumber(raw.doneTargets),
    succeededTargets: toNumber(raw.succeededTargets),
    failedTargets: toNumber(raw.failedTargets),
    percent: toNumber(raw.percent),
    currentItemId: typeof raw.currentItemId === "string" ? raw.currentItemId : undefined,
    currentItemName: typeof raw.currentItemName === "string" ? raw.currentItemName : undefined,
    currentItemType: typeof raw.currentItemType === "string" ? raw.currentItemType : undefined,
    currentItemPercent: toNumber(raw.currentItemPercent),
    totalItems: toNumber(raw.totalItems),
    eligibleSpoilerFiles: toNumber(raw.eligibleSpoilerFiles),
    processedEligibleFiles: toNumber(raw.processedEligibleFiles),
    appliedSpoilerFiles: toNumber(raw.appliedSpoilerFiles),
    skippedSpoilerFiles: toNumber(raw.skippedSpoilerFiles),
    failedSpoilerFiles: toNumber(raw.failedSpoilerFiles),
    summary: parseSummary(raw.summary),
  }
}

function parseSummary(raw: unknown) {
  if (!raw || typeof raw !== "object") {
    return undefined
  }

  const payload = raw as Record<string, unknown>
  const failures = Array.isArray(payload.failures)
    ? payload.failures
        .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
        .map((item) => ({
          itemId: typeof item.itemId === "string" ? item.itemId : "",
          name: typeof item.name === "string" ? item.name : "",
          stage: typeof item.stage === "string" ? item.stage : "",
          error: typeof item.error === "string" ? item.error : "",
        }))
    : []

  return {
    totalTargets: toNumber(payload.totalTargets),
    succeededTargets: toNumber(payload.succeededTargets),
    failedTargets: toNumber(payload.failedTargets),
    totalItems: toNumber(payload.totalItems),
    updatedItems: toNumber(payload.updatedItems),
    eligibleSpoilerFiles: toNumber(payload.eligibleSpoilerFiles),
    processedEligibleFiles: toNumber(payload.processedEligibleFiles),
    appliedSpoilerFiles: toNumber(payload.appliedSpoilerFiles),
    skippedSpoilerFiles: toNumber(payload.skippedSpoilerFiles),
    failedSpoilerFiles: toNumber(payload.failedSpoilerFiles),
    failures,
  } satisfies VaultBatchSummary
}

function toEventType(raw: unknown): VaultBatchProgressEvent["type"] {
  if (raw === "init" || raw === "target_start" || raw === "target_progress" || raw === "target_done" || raw === "done") {
    return raw
  }
  return "error"
}

function toNumber(raw: unknown) {
  return typeof raw === "number" && Number.isFinite(raw) ? raw : 0
}

async function consumeNdjsonStream(
  stream: ReadableStream<Uint8Array>,
  onLine: (line: string) => void,
) {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const chunk = await reader.read()
    if (chunk.done) {
      break
    }
    buffer += decoder.decode(chunk.value, { stream: true })
    buffer = flushBuffer(buffer, onLine)
  }

  buffer += decoder.decode()
  flushBuffer(buffer, onLine)
}

function flushBuffer(buffer: string, onLine: (line: string) => void) {
  let next = buffer
  while (true) {
    const index = next.indexOf("\n")
    if (index < 0) {
      break
    }
    const line = next.slice(0, index).trim()
    next = next.slice(index + 1)
    if (line) {
      onLine(line)
    }
  }
  return next
}

async function buildApiError(response: Response) {
  const status = response.status
  try {
    const payload = (await response.json()) as { error?: string; message?: string; details?: unknown }
    return new ApiError(payload.message || `请求失败（${status}）`, status, payload.error, payload)
  } catch {
    return new ApiError(`请求失败（${status}）`, status)
  }
}
