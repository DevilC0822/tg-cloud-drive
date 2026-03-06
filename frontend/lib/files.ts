export type BackendItemType =
  | "folder"
  | "image"
  | "video"
  | "audio"
  | "document"
  | "archive"
  | "code"
  | "other"

export type FilesSortBy = "name" | "date" | "size" | "type"
export type FilesSortOrder = "asc" | "desc"
export type FilesSection = "all" | "starred" | "shared" | "vault"
export type FilesViewMode = "grid" | "list"

export interface ItemDTO {
  id: string
  type: string
  name: string
  parentId: string | null
  path: string
  size: number
  mimeType?: string | null
  isVaulted?: boolean
  isStarred?: boolean
  isShared: boolean
  sharedCode?: string | null
  createdAt: string
  updatedAt: string
  lastAccessedAt?: string | null
}

export interface FileItem {
  id: string
  type: BackendItemType
  name: string
  parentId: string | null
  path: string
  size: number
  mimeType: string | null
  isVaulted: boolean
  isShared: boolean
  sharedCode: string | null
  createdAt: string
  updatedAt: string
  lastAccessedAt: string | null
  starred?: boolean
  thumbnail?: string
}

export interface FilesPagination {
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
}

export interface FilesQuery {
  view?: "files" | "vault"
  parentId?: string | null
  search?: string
  sortBy: FilesSortBy
  sortOrder: FilesSortOrder
  page: number
  pageSize: number
}

export interface BreadcrumbItem {
  id: string
  name: string
  path: string
}

const FILE_SIZE_UNITS = ["B", "KB", "MB", "GB", "TB"] as const

const relativeTimeFormatter = new Intl.RelativeTimeFormat("en", {
  numeric: "auto",
  style: "short",
})

function sanitizeItemType(type: string): BackendItemType {
  if (type === "folder") return "folder"
  if (type === "image") return "image"
  if (type === "video") return "video"
  if (type === "audio") return "audio"
  if (type === "document") return "document"
  if (type === "archive") return "archive"
  if (type === "code") return "code"
  return "other"
}

export function dtoToFileItem(dto: ItemDTO): FileItem {
  return {
    id: String(dto.id),
    type: sanitizeItemType(dto.type),
    name: dto.name,
    parentId: dto.parentId,
    path: dto.path,
    size: Number.isFinite(dto.size) ? Math.max(0, dto.size) : 0,
    mimeType: dto.mimeType ?? null,
    isVaulted: !!dto.isVaulted,
    starred: !!dto.isStarred,
    isShared: !!dto.isShared,
    sharedCode: dto.sharedCode ?? null,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    lastAccessedAt: dto.lastAccessedAt ?? null,
  }
}

export function formatFileSize(bytes: number): string {
  const safeBytes = Number.isFinite(bytes) ? Math.max(0, bytes) : 0
  if (safeBytes < 1024) {
    return `${safeBytes} ${FILE_SIZE_UNITS[0]}`
  }

  let size = safeBytes
  let unitIndex = 0
  while (size >= 1024 && unitIndex < FILE_SIZE_UNITS.length - 1) {
    size /= 1024
    unitIndex += 1
  }

  const fixed = size >= 10 || unitIndex === 0 ? size.toFixed(0) : size.toFixed(1)
  return `${fixed} ${FILE_SIZE_UNITS[unitIndex]}`
}

function diffToRelative(diffMs: number) {
  const diffSeconds = Math.round(diffMs / 1000)
  const absSeconds = Math.abs(diffSeconds)

  if (absSeconds < 60) return relativeTimeFormatter.format(-diffSeconds, "second")
  if (absSeconds < 3600) return relativeTimeFormatter.format(-Math.round(diffSeconds / 60), "minute")
  if (absSeconds < 86400) return relativeTimeFormatter.format(-Math.round(diffSeconds / 3600), "hour")
  if (absSeconds < 86400 * 30) return relativeTimeFormatter.format(-Math.round(diffSeconds / 86400), "day")
  if (absSeconds < 86400 * 365) return relativeTimeFormatter.format(-Math.round(diffSeconds / (86400 * 30)), "month")
  return relativeTimeFormatter.format(-Math.round(diffSeconds / (86400 * 365)), "year")
}

export function formatRelativeTime(value: string): string {
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) {
    return "-"
  }
  return diffToRelative(Date.now() - timestamp)
}
