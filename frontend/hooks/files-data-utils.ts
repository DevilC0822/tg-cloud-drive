import { ApiError } from "@/lib/api"
import type { FileItem } from "@/lib/files"

export function isUnauthorized(error: unknown) {
  return error instanceof ApiError && error.status === 401
}

export function isForbidden(error: unknown) {
  return error instanceof ApiError && error.status === 403
}

export function keepExistingSelectedIds(source: string[], visibleItems: FileItem[]) {
  const allowed = new Set(visibleItems.map((item) => item.id))
  return source.filter((id) => allowed.has(id))
}

export function normalizeFolderParam(raw: string | null) {
  if (!raw) return null
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : null
}
