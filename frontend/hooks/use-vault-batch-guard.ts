import { useCallback, useState } from "react"
import { getErrorMessage } from "@/hooks/file-actions-utils"
import { useToast } from "@/hooks/use-toast"
import { fetchVaultStatus, setFileVaulted, unlockVaultSession } from "@/lib/files-api"
import { setItemsVaultedBatchWithProgress } from "@/lib/files-vault-batch-api"
import type { FileItem } from "@/lib/files"
import type { filesMessages } from "@/lib/i18n"
import {
  IDLE_DIALOG,
  IDLE_PROCESSING,
  IDLE_PROGRESS,
  isFlowError,
  pickTargets,
  progressFromEvent,
  resolveLabel,
  shouldShowProgress,
  VaultBatchFlowError,
  type VaultActionDialogState,
  type VaultBatchProgressState,
  type VaultProcessingState,
} from "@/hooks/vault-batch-guard-types"

interface UseVaultBatchGuardOptions {
  selectedIds: string[]
  selectedItems: FileItem[]
  refreshItems: () => Promise<void>
  refreshFolders: () => Promise<void>
  text: (typeof filesMessages)["en"]
}

export function useVaultBatchGuard({
  selectedIds,
  selectedItems,
  refreshItems,
  refreshFolders,
  text,
}: UseVaultBatchGuardOptions) {
  const { toast } = useToast()
  const [dialog, setDialog] = useState<VaultActionDialogState>(IDLE_DIALOG)
  const [processing, setProcessing] = useState<VaultProcessingState>(IDLE_PROCESSING)
  const [progress, setProgress] = useState<VaultBatchProgressState>(IDLE_PROGRESS)

  const closeDialog = useCallback(() => {
    setDialog(IDLE_DIALOG)
  }, [])

  const setDialogPassword = useCallback((value: string) => {
    setDialog((prev) => ({ ...prev, password: value, error: "" }))
  }, [])

  const closeProgress = useCallback(() => {
    setProgress((prev) => (prev.pending ? prev : IDLE_PROGRESS))
  }, [])

  const openDialog = useCallback((targets: FileItem[], enabled: boolean, error = "") => {
    setDialog({
      open: true,
      password: "",
      pending: false,
      error,
      targets,
      enabled,
    })
  }, [])

  const applySimpleVaultAction = useCallback(async (targets: FileItem[], enabled: boolean) => {
    await Promise.all(targets.map((item) => setFileVaulted(item.id, enabled)))
  }, [])

  const applyProgressVaultAction = useCallback(async (targets: FileItem[], enabled: boolean) => {
    setProgress({
      ...IDLE_PROGRESS,
      open: true,
      pending: true,
      stage: "init",
      enabled,
      totalTargets: targets.length,
    })

    try {
      const summary = await setItemsVaultedBatchWithProgress(
        targets.map((item) => item.id),
        enabled,
        (event) => {
          setProgress((current) => progressFromEvent(current, event))
        },
      )
      setProgress((current) => ({
        ...current,
        pending: false,
        stage: "done",
        doneTargets: summary.succeededTargets + summary.failedTargets,
        succeededTargets: summary.succeededTargets,
        failedTargets: summary.failedTargets,
        percent: 100,
        failures: summary.failures,
        message: "",
      }))
    } catch (error: unknown) {
      const message = getErrorMessage(error, text.operationFailed)
      setProgress((current) => ({
        ...current,
        pending: false,
        stage: "error",
        message,
      }))
      throw new VaultBatchFlowError(message, true, { cause: error })
    }
  }, [text.operationFailed])

  const runVaultActionFlow = useCallback(async (targets: FileItem[], enabled: boolean) => {
    const showProgress = shouldShowProgress(targets)
    setProcessing({
      active: true,
      label: resolveLabel(text, enabled),
      targetIds: targets.map((item) => item.id),
    })

    try {
      if (showProgress) {
        await applyProgressVaultAction(targets, enabled)
      } else {
        await applySimpleVaultAction(targets, enabled)
      }
      await refreshFolders()
      await refreshItems()
    } catch (error: unknown) {
      const message = getErrorMessage(error, text.operationFailed)
      throw new VaultBatchFlowError(message, showProgress, { cause: error })
    } finally {
      setProcessing(IDLE_PROCESSING)
    }
  }, [applyProgressVaultAction, applySimpleVaultAction, refreshFolders, refreshItems, text])

  const runVaultAction = useCallback(async (file: FileItem, enabled: boolean) => {
    const targets = pickTargets(file, selectedIds, selectedItems)
    if (targets.length === 0) {
      return true
    }

    try {
      const status = await fetchVaultStatus()
      if (!status.unlocked) {
        openDialog(targets, enabled)
        return true
      }
      await runVaultActionFlow(targets, enabled)
      return true
    } catch (error: unknown) {
      if (isFlowError(error) && error.progressHandled) {
        return true
      }
      const message = getErrorMessage(error, text.operationFailed)
      toast({
        variant: "destructive",
        title: text.operationFailed,
        description: message,
      })
      return true
    }
  }, [openDialog, runVaultActionFlow, selectedIds, selectedItems, text.operationFailed, toast])

  const confirmUnlockAndRun = useCallback(async () => {
    const password = dialog.password.trim()
    if (!password) {
      setDialog((prev) => ({ ...prev, error: text.vaultPasswordRequired }))
      return
    }

    const targets = dialog.targets
    const enabled = dialog.enabled
    setDialog((prev) => ({ ...prev, pending: true, error: "" }))

    try {
      await unlockVaultSession(password)
      closeDialog()
      await runVaultActionFlow(targets, enabled)
    } catch (error: unknown) {
      if (isFlowError(error) && error.progressHandled) {
        return
      }
      const message = getErrorMessage(error, text.operationFailed)
      openDialog(targets, enabled, message)
    }
  }, [closeDialog, dialog.enabled, dialog.password, dialog.targets, openDialog, runVaultActionFlow, text.operationFailed, text.vaultPasswordRequired])

  const moveToVault = useCallback((file: FileItem) => runVaultAction(file, true), [runVaultAction])
  const removeFromVault = useCallback((file: FileItem) => runVaultAction(file, false), [runVaultAction])

  const isItemProcessing = useCallback(
    (itemId: string) => processing.active && processing.targetIds.includes(itemId),
    [processing.active, processing.targetIds],
  )

  return {
    dialogOpen: dialog.open,
    dialogPassword: dialog.password,
    dialogPending: dialog.pending,
    dialogError: dialog.error,
    dialogTargets: dialog.targets,
    dialogEnabled: dialog.enabled,
    setDialogPassword,
    closeDialog,
    confirmUnlockAndRun,
    moveToVault,
    removeFromVault,
    processingActive: processing.active,
    processingLabel: processing.label,
    isItemProcessing,
    progress,
    closeProgress,
  }
}
