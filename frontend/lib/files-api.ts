import { ApiError, apiFetchJson } from "@/lib/api"
import type { FileItem, FilesPagination, FilesQuery, ItemDTO } from "@/lib/files"
import { dtoToFileItem } from "@/lib/files"

interface ItemsResponse {
  items: ItemDTO[]
  pagination: FilesPagination
}

interface FoldersResponse {
  items: ItemDTO[]
}

interface ItemResponse {
  item: ItemDTO
}

interface SetItemVaultRawResponse extends ItemResponse {
  spoilerApplied?: boolean
  spoilerEligible?: boolean
  summary?: VaultFolderSyncSummary
}

interface ShareResponse {
  shareCode: string
  shareUrl: string
}

interface VaultStatusResponse {
  enabled: boolean
  unlocked: boolean
  expiresAt?: string
}

export interface VaultFolderSyncFailure {
  id: string
  name: string
  error: string
}

export interface VaultFolderSyncSummary {
  totalItems: number
  updatedItems: number
  eligibleSpoilerFiles: number
  appliedSpoilerFiles: number
  skippedSpoilerFiles: number
  failedSpoilerFiles: number
  failures: VaultFolderSyncFailure[]
}

export interface SetFileVaultResponse {
  item: FileItem
  spoilerApplied: boolean
  spoilerEligible: boolean
  summary?: VaultFolderSyncSummary
}

interface VaultProgressEventBase {
  type: "init" | "progress" | "finalizing" | "done" | "error"
  totalItems: number
  eligibleSpoilerFiles: number
  processedEligibleFiles: number
  appliedSpoilerFiles: number
  skippedSpoilerFiles: number
  failedSpoilerFiles: number
  percent: number
  updatedItems: number
  itemId?: string
  enabled?: boolean
}

export interface VaultProgressInitEvent extends VaultProgressEventBase {
  type: "init"
}

export interface VaultProgressUpdateEvent extends VaultProgressEventBase {
  type: "progress" | "finalizing"
}

export interface VaultProgressDoneEvent extends VaultProgressEventBase {
  type: "done"
  item?: FileItem
  summary?: VaultFolderSyncSummary
}

export interface VaultProgressErrorEvent extends VaultProgressEventBase {
  type: "error"
  message: string
}

export type VaultProgressEvent =
  | VaultProgressInitEvent
  | VaultProgressUpdateEvent
  | VaultProgressDoneEvent
  | VaultProgressErrorEvent

export type FoldersScope = "files" | "vault" | "all"

const FOLDER_SCAN_PAGE_SIZE = 200

function createItemsQueryString(query: FilesQuery): string {
  const params = new URLSearchParams()
  params.set("view", query.view ?? "files")
  params.set("sortBy", query.sortBy)
  params.set("sortOrder", query.sortOrder)
  params.set("page", String(query.page))
  params.set("pageSize", String(query.pageSize))

  const trimmedSearch = query.search?.trim()
  if (trimmedSearch) {
    params.set("search", trimmedSearch)
  }
  if (query.parentId) {
    params.set("parentId", query.parentId)
  }

  return params.toString()
}

function mapItems(items: ItemDTO[]): FileItem[] {
  return items.map(dtoToFileItem)
}

export async function fetchFilesItems(query: FilesQuery) {
  const search = createItemsQueryString(query)
  const response = await apiFetchJson<ItemsResponse>(`/api/items?${search}`)
  return {
    items: mapItems(response.items || []),
    pagination: response.pagination,
  }
}

export async function fetchFoldersIndex(scope: FoldersScope = "files") {
  const params = new URLSearchParams()
  params.set("scope", scope)
  const response = await apiFetchJson<FoldersResponse>(`/api/folders?${params.toString()}`)
  return mapItems(response.items || []).filter((item) => item.type === "folder")
}

export async function createFolderItem(parentId: string | null, name: string) {
  const response = await apiFetchJson<ItemResponse>("/api/folders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ parentId, name: name.trim() }),
  })
  return dtoToFileItem(response.item)
}

export async function fetchFileItemById(itemId: string) {
  const response = await apiFetchJson<ItemResponse>(`/api/items/${encodeURIComponent(itemId)}`)
  return dtoToFileItem(response.item)
}

export async function fetchFolderTotalSize(folderId: string) {
  const queue = [folderId]
  const visited = new Set<string>()
  let totalSize = 0

  while (queue.length > 0) {
    const currentFolderId = queue.shift()
    if (!currentFolderId || visited.has(currentFolderId)) {
      continue
    }
    visited.add(currentFolderId)

    let page = 1
    let totalPages = 1
    while (page <= totalPages) {
      const response = await fetchFilesItems({
        view: "files",
        parentId: currentFolderId,
        sortBy: "name",
        sortOrder: "asc",
        page,
        pageSize: FOLDER_SCAN_PAGE_SIZE,
      })

      response.items.forEach((item) => {
        if (item.type === "folder") {
          queue.push(item.id)
          return
        }
        totalSize += Math.max(0, item.size)
      })

      totalPages = Math.max(1, response.pagination.totalPages)
      page += 1
    }
  }

  return totalSize
}

async function patchItem(itemId: string, payload: { name?: string; parentId?: string | null }) {
  const response = await apiFetchJson<ItemResponse>(`/api/items/${encodeURIComponent(itemId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  return dtoToFileItem(response.item)
}

export async function renameFileItem(itemId: string, nextName: string) {
  return patchItem(itemId, { name: nextName.trim() })
}

export async function moveFileItem(itemId: string, parentId: string | null) {
  return patchItem(itemId, { parentId })
}

export async function deleteFileItem(itemId: string) {
  await apiFetchJson<{ ok: boolean }>(`/api/items/${encodeURIComponent(itemId)}`, {
    method: "DELETE",
  })
}

export async function setFileStarred(itemId: string, enabled: boolean) {
  const response = await apiFetchJson<ItemResponse>(`/api/items/${encodeURIComponent(itemId)}/star`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  })
  return dtoToFileItem(response.item)
}

export async function shareFileItem(itemId: string) {
  return apiFetchJson<ShareResponse>(`/api/items/${encodeURIComponent(itemId)}/share`, {
    method: "POST",
  })
}

export async function unshareFileItem(itemId: string) {
  await apiFetchJson<{ ok: boolean }>(`/api/items/${encodeURIComponent(itemId)}/share`, {
    method: "DELETE",
  })
}

export async function setFileVaulted(itemId: string, enabled: boolean) {
  const response = await apiFetchJson<SetItemVaultRawResponse>(`/api/items/${encodeURIComponent(itemId)}/vault`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  })
  return mapVaultResponse(response)
}

export async function setFileVaultedWithProgress(
  itemId: string,
  enabled: boolean,
  onEvent: (event: VaultProgressEvent) => void,
) {
  const response = await fetch(`/api/items/${encodeURIComponent(itemId)}/vault?progress=1`, {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/x-ndjson",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ enabled }),
  })

  if (!response.ok) {
    throw await buildStreamApiError(response)
  }
  if (!response.body) {
    throw new Error("Vault progress stream is unavailable")
  }

  let donePayload: SetFileVaultResponse | null = null
  await consumeNdjsonStream(response.body, (line) => {
    const event = parseVaultProgressEvent(line)
    onEvent(event)
    if (event.type === "done") {
      if (!event.item) {
        throw new Error("Vault progress result missing item")
      }
      donePayload = {
        item: event.item,
        spoilerApplied: event.appliedSpoilerFiles > 0,
        spoilerEligible: event.eligibleSpoilerFiles > 0,
        summary: event.summary,
      }
    }
  })

  if (!donePayload) {
    throw new Error("Vault progress stream ended unexpectedly")
  }
  return donePayload
}

export async function fetchVaultStatus() {
  return apiFetchJson<VaultStatusResponse>("/api/vault/status")
}

export async function unlockVaultSession(password: string) {
  return apiFetchJson<{ ok: boolean; expiresAt?: string }>("/api/vault/unlock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  })
}

export async function lockVaultSession() {
  return apiFetchJson<{ ok: boolean }>("/api/vault/lock", {
    method: "POST",
  })
}

export function buildFileContentUrl(itemId: string, download = false) {
  const path = `/api/items/${encodeURIComponent(itemId)}/content`
  return download ? `${path}?download=1` : path
}

function mapVaultResponse(response: SetItemVaultRawResponse): SetFileVaultResponse {
  return {
    item: dtoToFileItem(response.item),
    spoilerApplied: !!response.spoilerApplied,
    spoilerEligible: !!response.spoilerEligible,
    summary: response.summary,
  }
}

async function buildStreamApiError(response: Response) {
  const status = response.status
  try {
    const payload = (await response.json()) as { error?: string; message?: string; details?: unknown }
    return new ApiError(payload.message || `请求失败（${status}）`, status, payload.error, payload)
  } catch {
    return new ApiError(`请求失败（${status}）`, status)
  }
}

async function consumeNdjsonStream(stream: ReadableStream<Uint8Array>, onLine: (line: string) => void) {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    buffer += decoder.decode(value, { stream: true })
    buffer = flushNdjsonLines(buffer, onLine)
  }
  buffer += decoder.decode()
  flushNdjsonLines(buffer, onLine)
}

function flushNdjsonLines(buffer: string, onLine: (line: string) => void) {
  let next = buffer
  while (true) {
    const newlineIndex = next.indexOf("\n")
    if (newlineIndex < 0) {
      break
    }
    const line = next.slice(0, newlineIndex).trim()
    next = next.slice(newlineIndex + 1)
    if (line) {
      onLine(line)
    }
  }
  return next
}

function parseVaultProgressEvent(line: string): VaultProgressEvent {
  const raw = JSON.parse(line) as Record<string, unknown>
  const base = {
    totalItems: toEventNumber(raw.totalItems),
    eligibleSpoilerFiles: toEventNumber(raw.eligibleSpoilerFiles),
    processedEligibleFiles: toEventNumber(raw.processedEligibleFiles),
    appliedSpoilerFiles: toEventNumber(raw.appliedSpoilerFiles),
    skippedSpoilerFiles: toEventNumber(raw.skippedSpoilerFiles),
    failedSpoilerFiles: toEventNumber(raw.failedSpoilerFiles),
    percent: toEventNumber(raw.percent),
    updatedItems: toEventNumber(raw.updatedItems),
    itemId: typeof raw.itemId === "string" ? raw.itemId : undefined,
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : undefined,
  }

  const type = typeof raw.type === "string" ? raw.type : "error"
  if (type === "init") return { type: "init", ...base }
  if (type === "progress" || type === "finalizing") return { type, ...base }
  if (type === "done") {
    return {
      type: "done",
      ...base,
      item: parseDoneItem(raw.item),
      summary: parseDoneSummary(raw.summary),
    }
  }
  return {
    type: "error",
    ...base,
    message: typeof raw.message === "string" ? raw.message : "Vault progress failed",
  }
}

function parseDoneItem(raw: unknown) {
  if (!raw || typeof raw !== "object") {
    return undefined
  }
  return dtoToFileItem(raw as ItemDTO)
}

function parseDoneSummary(raw: unknown) {
  if (!raw || typeof raw !== "object") {
    return undefined
  }
  return raw as VaultFolderSyncSummary
}

function toEventNumber(value: unknown) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0
  }
  return value
}
