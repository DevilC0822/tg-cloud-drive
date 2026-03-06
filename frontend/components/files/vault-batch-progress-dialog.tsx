"use client"

import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import type { VaultBatchFailure } from "@/lib/files-vault-batch-api"
import type { filesMessages } from "@/lib/i18n"

const FAILURE_PREVIEW_LIMIT = 3

interface VaultBatchProgressDialogProps {
  text: (typeof filesMessages)["en"]
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
  onOpenChange: (open: boolean) => void
  onClose: () => void
}

function resolveStageText(text: (typeof filesMessages)["en"], stage: VaultBatchProgressDialogProps["stage"]) {
  if (stage === "init") return text.vaultProgressInit
  if (stage === "running") return text.vaultProgressProcessing
  if (stage === "done") return text.vaultProgressDone
  if (stage === "error") return text.vaultProgressError
  return text.vaultProgressProcessing
}

function resolveTitle(text: (typeof filesMessages)["en"], enabled: boolean) {
  return enabled ? text.vaultProgressTitleIn : text.vaultProgressTitleOut
}

function formatTargetLabel(text: (typeof filesMessages)["en"], name: string, itemType: string) {
  if (!name) {
    return text.vaultProgressNoCurrentTarget
  }
  const typeSuffix = itemType ? ` (${itemType})` : ""
  return `${name}${typeSuffix}`
}

export function VaultBatchProgressDialog(props: VaultBatchProgressDialogProps) {
  const {
    text,
    open,
    pending,
    enabled,
    stage,
    totalTargets,
    doneTargets,
    succeededTargets,
    failedTargets,
    percent,
    currentItemName,
    currentItemType,
    currentItemPercent,
    totalItems,
    eligibleSpoilerFiles,
    processedEligibleFiles,
    appliedSpoilerFiles,
    skippedSpoilerFiles,
    failedSpoilerFiles,
    failures,
    message,
    onOpenChange,
    onClose,
  } = props

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-border/60 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{resolveTitle(text, enabled)}</DialogTitle>
          <DialogDescription>{text.vaultProgressTargetsLabel(doneTargets, Math.max(totalTargets, 1))}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{resolveStageText(text, stage)}</span>
              <span>{Math.round(percent)}%</span>
            </div>
            <Progress value={percent} className="h-2" />
          </div>

          <div className="rounded-xl border border-border/50 bg-secondary/30 px-3 py-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{text.vaultProgressOverallLabel}</span>
              <span className="font-medium text-foreground">{doneTargets} / {Math.max(totalTargets, 1)}</span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <p>{text.vaultProgressSucceededTargetsLabel}: <span className="font-medium text-foreground">{succeededTargets}</span></p>
              <p>{text.vaultProgressFailedTargetsLabel}: <span className="font-medium text-foreground">{failedTargets}</span></p>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>{text.vaultProgressCurrentTargetLabel}</span>
              <span>{Math.round(currentItemPercent)}%</span>
            </div>
            <p className="mt-1 text-sm text-foreground break-all [overflow-wrap:anywhere]">{formatTargetLabel(text, currentItemName, currentItemType)}</p>

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <p>{text.vaultProgressTotalItemsLabel}: <span className="font-medium text-foreground">{totalItems}</span></p>
              <p>{text.vaultProgressProcessedLabel}: <span className="font-medium text-foreground">{processedEligibleFiles} / {eligibleSpoilerFiles}</span></p>
              <p>{text.vaultProgressAppliedLabel}: <span className="font-medium text-foreground">{appliedSpoilerFiles}</span></p>
              <p>{text.vaultProgressSkippedLabel}: <span className="font-medium text-foreground">{skippedSpoilerFiles}</span></p>
              <p>{text.vaultProgressFailedLabel}: <span className="font-medium text-foreground">{failedSpoilerFiles}</span></p>
            </div>

            {failures.length > 0 ? (
              <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-2.5 py-2">
                <p className="text-xs font-medium text-destructive">{text.vaultProgressFailuresTitle}</p>
                {failures.slice(0, FAILURE_PREVIEW_LIMIT).map((failure) => (
                  <p key={`${failure.itemId}-${failure.stage}`} className="mt-1 text-xs text-destructive break-all [overflow-wrap:anywhere]">
                    {failure.name}: {failure.error}
                  </p>
                ))}
                {failures.length > FAILURE_PREVIEW_LIMIT ? (
                  <p className="mt-1 text-xs text-destructive">+ {failures.length - FAILURE_PREVIEW_LIMIT}</p>
                ) : null}
              </div>
            ) : null}

            {message ? <p className="mt-3 text-sm text-destructive">{message}</p> : null}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={onClose}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {text.vaultProgressClose}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
