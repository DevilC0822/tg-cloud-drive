import type { VaultBatchFailure, VaultBatchProgressEvent } from "@/lib/files-vault-batch-api"
import type { FileItem } from "@/lib/files"
import type { filesMessages } from "@/lib/i18n"

export interface VaultActionDialogState {
  open: boolean
  password: string
  pending: boolean
  error: string
  targets: FileItem[]
  enabled: boolean
}

export interface VaultProcessingState {
  active: boolean
  label: string
  targetIds: string[]
}

export interface VaultBatchProgressState {
  open: boolean
  pending: boolean
  enabled: boolean
  stage: "idle" | "init" | "running" | "done" | "error"
  totalTargets: number
  doneTargets: number
  succeededTargets: number
  failedTargets: number
  percent: number
  currentItemName: string
  currentItemType: string
  currentItemPercent: number
  totalItems: number
  eligibleSpoilerFiles: number
  processedEligibleFiles: number
  appliedSpoilerFiles: number
  skippedSpoilerFiles: number
  failedSpoilerFiles: number
  failures: VaultBatchFailure[]
  message: string
}

export class VaultBatchFlowError extends Error {
  constructor(
    message: string,
    readonly progressHandled: boolean,
    options?: { cause?: unknown },
  ) {
    super(message, options)
    this.name = "VaultBatchFlowError"
  }
}

export const IDLE_DIALOG: VaultActionDialogState = {
  open: false,
  password: "",
  pending: false,
  error: "",
  targets: [],
  enabled: true,
}

export const IDLE_PROCESSING: VaultProcessingState = {
  active: false,
  label: "",
  targetIds: [],
}

export const IDLE_PROGRESS: VaultBatchProgressState = {
  open: false,
  pending: false,
  enabled: true,
  stage: "idle",
  totalTargets: 0,
  doneTargets: 0,
  succeededTargets: 0,
  failedTargets: 0,
  percent: 0,
  currentItemName: "",
  currentItemType: "",
  currentItemPercent: 0,
  totalItems: 0,
  eligibleSpoilerFiles: 0,
  processedEligibleFiles: 0,
  appliedSpoilerFiles: 0,
  skippedSpoilerFiles: 0,
  failedSpoilerFiles: 0,
  failures: [],
  message: "",
}

export function pickTargets(file: FileItem, selectedIds: string[], selectedItems: FileItem[]) {
  const isMultiSelected = selectedIds.length > 1 && selectedIds.includes(file.id)
  return isMultiSelected ? selectedItems : [file]
}

export function resolveLabel(text: (typeof filesMessages)["en"], enabled: boolean) {
  return `${enabled ? text.actionVaultIn : text.actionVaultOut}...`
}

export function shouldShowProgress(targets: FileItem[]) {
  return targets.length > 1 || targets.some((item) => item.type === "folder")
}

export function isFlowError(error: unknown): error is VaultBatchFlowError {
  return error instanceof VaultBatchFlowError
}

export function progressFromEvent(
  current: VaultBatchProgressState,
  event: VaultBatchProgressEvent,
): VaultBatchProgressState {
  return {
    ...current,
    stage: event.type === "error" ? "error" : event.type === "done" ? "done" : event.type === "init" ? "init" : "running",
    pending: event.type !== "done" && event.type !== "error",
    enabled: typeof event.enabled === "boolean" ? event.enabled : current.enabled,
    totalTargets: event.totalTargets,
    doneTargets: event.doneTargets,
    succeededTargets: event.succeededTargets,
    failedTargets: event.failedTargets,
    percent: event.percent,
    currentItemName: event.currentItemName || current.currentItemName,
    currentItemType: event.currentItemType || current.currentItemType,
    currentItemPercent: event.currentItemPercent,
    totalItems: event.totalItems,
    eligibleSpoilerFiles: event.eligibleSpoilerFiles,
    processedEligibleFiles: event.processedEligibleFiles,
    appliedSpoilerFiles: event.appliedSpoilerFiles,
    skippedSpoilerFiles: event.skippedSpoilerFiles,
    failedSpoilerFiles: event.failedSpoilerFiles,
    failures: event.summary?.failures || current.failures,
    message: event.message || "",
  }
}
