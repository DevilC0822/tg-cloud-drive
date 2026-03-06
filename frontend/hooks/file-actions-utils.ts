import { ApiError } from "@/lib/api"
import type { FileItem } from "@/lib/files"

export interface RenameState {
  open: boolean
  value: string
  target: FileItem | null
}

export interface MoveState {
  open: boolean
  targetFolderId: string
  targets: FileItem[]
}

export interface DeleteState {
  open: boolean
  targets: FileItem[]
}

export function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    return error.message || fallback
  }
  if (error instanceof Error) {
    return error.message
  }
  return fallback
}

export function pickActionTargets(file: FileItem, selectedIds: string[], index: Map<string, FileItem>) {
  const isMultiSelected = selectedIds.length > 1 && selectedIds.includes(file.id)
  if (!isMultiSelected) return [file]
  return selectedIds.map((id) => index.get(id)).filter((item): item is FileItem => !!item)
}

export function buildShareUrl(shareCode: string) {
  return `${window.location.origin}/d/${shareCode}`
}

export async function copyToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }
  const input = document.createElement("input")
  input.value = value
  input.style.position = "fixed"
  input.style.opacity = "0"
  document.body.appendChild(input)
  input.select()
  document.execCommand("copy")
  document.body.removeChild(input)
}

export function defaultMoveTarget(targets: FileItem[]) {
  if (targets.length === 0) return ""
  const parentId = targets[0].parentId || ""
  const sameParent = targets.every((item) => (item.parentId || "") === parentId)
  return sameParent ? parentId : ""
}

