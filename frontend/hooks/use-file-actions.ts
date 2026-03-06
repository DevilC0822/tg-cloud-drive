import { useCallback, useMemo, useState } from "react"
import {
  deleteFileItem,
  moveFileItem,
  renameFileItem,
  setFileStarred,
  setFileVaulted,
  shareFileItem,
  unshareFileItem,
} from "@/lib/files-api"
import { startDownloadTransfer } from "@/lib/transfers-api"
import type { FileItem } from "@/lib/files"
import type { filesMessages } from "@/lib/i18n"
import { useToast } from "@/hooks/use-toast"
import type { FileAction } from "@/components/files/file-actions-menu"
import {
  buildShareUrl,
  copyToClipboard,
  defaultMoveTarget,
  type DeleteState,
  getErrorMessage,
  type MoveState,
  pickActionTargets,
  type RenameState,
} from "@/hooks/file-actions-utils"

interface UseFileActionsOptions {
  items: FileItem[]
  selectedIds: string[]
  text: (typeof filesMessages)["en"]
  openFolder: (folderId: string) => void
  openPreview: (itemId: string) => void
  refreshItems: () => Promise<void>
  refreshFolders: () => Promise<void>
  clearSelection: () => void
}

interface FileOperationState {
  active: boolean
  label: string
  targetIds: string[]
}

const IDLE_OPERATION: FileOperationState = {
  active: false,
  label: "",
  targetIds: [],
}

function operationLabel(base: string) {
  return `${base}...`
}

export function useFileActions({
  items,
  selectedIds,
  text,
  openFolder,
  openPreview,
  refreshItems,
  refreshFolders,
  clearSelection,
}: UseFileActionsOptions) {
  const { toast } = useToast()
  const [operation, setOperation] = useState<FileOperationState>(IDLE_OPERATION)
  const [rename, setRename] = useState<RenameState>({ open: false, value: "", target: null })
  const [move, setMove] = useState<MoveState>({ open: false, targetFolderId: "", targets: [] })
  const [remove, setRemove] = useState<DeleteState>({ open: false, targets: [] })
  const [infoTarget, setInfoTarget] = useState<FileItem | null>(null)

  const itemIndex = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])
  const selectedItems = useMemo(
    () => selectedIds.map((id) => itemIndex.get(id)).filter((item): item is FileItem => !!item),
    [itemIndex, selectedIds],
  )
  const showError = useCallback(
    (error: unknown) => {
      toast({
        variant: "destructive",
        title: text.operationFailed,
        description: getErrorMessage(error, text.operationFailed),
      })
    },
    [text.operationFailed, toast],
  )
  const showFailureMessage = useCallback(
    (message: string) => {
      toast({
        variant: "destructive",
        title: text.operationFailed,
        description: message,
      })
    },
    [text.operationFailed, toast],
  )
  const showSuccess = useCallback(
    (message: string) => {
      toast({ title: message })
    },
    [toast],
  )
  const refreshAll = useCallback(async () => {
    await refreshFolders()
    await refreshItems()
  }, [refreshFolders, refreshItems])
  const runWithPending = useCallback(async (
    task: () => Promise<void>,
    options: { label: string; targetIds: string[] },
  ) => {
    setOperation({
      active: true,
      label: operationLabel(options.label),
      targetIds: options.targetIds,
    })
    try {
      await task()
    } finally {
      setOperation(IDLE_OPERATION)
    }
  }, [])
  const startMoveDialog = useCallback((targets: FileItem[]) => {
    setMove({ open: true, targets, targetFolderId: defaultMoveTarget(targets) })
  }, [])
  const startDeleteDialog = useCallback((targets: FileItem[]) => {
    setRemove({ open: true, targets })
  }, [])
  const handleShare = useCallback(async (file: FileItem) => {
    if (file.type === "folder") {
      showFailureMessage(text.operationUnsupportedFolderShare)
      return
    }
    const shareCode = file.isShared && file.sharedCode ? file.sharedCode : (await shareFileItem(file.id)).shareCode
    await copyToClipboard(buildShareUrl(shareCode))
    await refreshItems()
    showSuccess(text.copiedShareLink)
  }, [refreshItems, showFailureMessage, showSuccess, text.copiedShareLink, text.operationUnsupportedFolderShare])
  const handleUnshare = useCallback(async (file: FileItem) => {
    if (file.type === "folder") return
    await unshareFileItem(file.id)
    await refreshItems()
    showSuccess(text.statusUnshared)
  }, [refreshItems, showSuccess, text.statusUnshared])
  const applyStarAction = useCallback(async (targets: FileItem[], enabled: boolean) => {
    await Promise.all(targets.map((item) => setFileStarred(item.id, enabled)))
    await refreshItems()
    showSuccess(enabled ? text.statusStarred : text.statusUnstarred)
  }, [refreshItems, showSuccess, text.statusStarred, text.statusUnstarred])
  const applyVaultAction = useCallback(async (targets: FileItem[], enabled: boolean, notify = true) => {
    await Promise.all(targets.map((item) => setFileVaulted(item.id, enabled)))
    await refreshItems()
    if (notify) {
      showSuccess(enabled ? text.statusVaulted : text.statusUnvaulted)
    }
  }, [refreshItems, showSuccess, text.statusUnvaulted, text.statusVaulted])
  const handleAction = useCallback(async (action: FileAction, file: FileItem) => {
    const targets = pickActionTargets(file, selectedIds, itemIndex)
    if (action === "preview") {
      if (file.type === "folder") openFolder(file.id)
      else openPreview(file.id)
      return
    }
    if (action === "download") {
      if (targets.some((item) => item.type === "folder")) {
        showFailureMessage(text.operationUnsupportedFolderDownload)
        return
      }
      await Promise.all(
        targets.map(async (item) => {
          const transfer = await startDownloadTransfer(item.id)
          window.open(transfer.downloadUrl, "_blank", "noopener")
        }),
      )
      return
    }
    if (action === "rename") {
      setRename({ open: true, target: file, value: file.name })
      return
    }
    if (action === "move") {
      startMoveDialog(targets)
      return
    }
    if (action === "info") {
      setInfoTarget(file)
      return
    }
    if (action === "delete") {
      startDeleteDialog(targets)
      return
    }
    await runWithPending(async () => {
      if (action === "share") return handleShare(file)
      if (action === "unshare") return handleUnshare(file)
      if (action === "star") return applyStarAction(targets, true)
      if (action === "unstar") return applyStarAction(targets, false)
      if (action === "vaultIn") return applyVaultAction(targets, true, false)
      if (action === "vaultOut") return applyVaultAction(targets, false)
    }, {
      label: resolveActionLoadingLabel(text, action, targets),
      targetIds: targets.map((item) => item.id),
    }).catch(showError)
  }, [
    selectedIds,
    itemIndex,
    runWithPending,
    showFailureMessage,
    text.operationUnsupportedFolderDownload,
    openFolder,
    openPreview,
    startMoveDialog,
    startDeleteDialog,
    handleShare,
    handleUnshare,
    applyStarAction,
    applyVaultAction,
  ])
  const confirmRename = useCallback(async () => {
    const target = rename.target
    if (!target) return
    await runWithPending(async () => {
      await renameFileItem(target.id, rename.value)
      await refreshAll()
      setRename({ open: false, value: "", target: null })
      showSuccess(text.statusRenamed)
    }, {
      label: text.actionRename,
      targetIds: [target.id],
    }).catch(showError)
  }, [refreshAll, rename.target, rename.value, runWithPending, showError, showSuccess, text.statusRenamed])
  const confirmMove = useCallback(async () => {
    const destination = move.targetFolderId || null
    await runWithPending(async () => {
      await Promise.all(move.targets.map((target) => moveFileItem(target.id, destination)))
      await refreshAll()
      clearSelection()
      setMove({ open: false, targetFolderId: "", targets: [] })
      showSuccess(text.statusMoved)
    }, {
      label: text.actionMove,
      targetIds: move.targets.map((target) => target.id),
    }).catch(showError)
  }, [clearSelection, move.targetFolderId, move.targets, refreshAll, runWithPending, showError, showSuccess, text.statusMoved])
  const confirmDelete = useCallback(async () => {
    await runWithPending(async () => {
      await Promise.all(remove.targets.map((target) => deleteFileItem(target.id)))
      await refreshAll()
      clearSelection()
      setRemove({ open: false, targets: [] })
      showSuccess(text.statusDeleted)
    }, {
      label: text.actionDelete,
      targetIds: remove.targets.map((target) => target.id),
    }).catch(showError)
  }, [clearSelection, refreshAll, remove.targets, runWithPending, showError, showSuccess, text.statusDeleted])
  const closeRename = useCallback(() => {
    setRename({ open: false, value: "", target: null })
  }, [])

  const closeMove = useCallback(() => {
    setMove({ open: false, targetFolderId: "", targets: [] })
  }, [])

  const closeDelete = useCallback(() => {
    setRemove({ open: false, targets: [] })
  }, [])

  const closeInfo = useCallback(() => {
    setInfoTarget(null)
  }, [])
  const updateRenameValue = useCallback((value: string) => {
    setRename((prev) => ({ ...prev, value }))
  }, [])

  const updateMoveTarget = useCallback((value: string) => {
    setMove((prev) => ({ ...prev, targetFolderId: value }))
  }, [])

  const triggerSelectionAction = useCallback(async (action: "download" | "share" | "toggleStar" | "move" | "delete") => {
    if (action === "move") return startMoveDialog(selectedItems)
    if (action === "delete") return startDeleteDialog(selectedItems)
    if (action === "download") {
      if (selectedItems.some((item) => item.type === "folder")) {
        showFailureMessage(text.operationUnsupportedFolderDownload)
        return
      }
      await Promise.all(
        selectedItems.map(async (item) => {
          const transfer = await startDownloadTransfer(item.id)
          window.open(transfer.downloadUrl, "_blank", "noopener")
        }),
      )
      return
    }
    if (action === "share") {
      if (selectedItems.length !== 1) {
        showFailureMessage(text.operationSelectionShareDisabled)
        return
      }
      await runWithPending(() => handleShare(selectedItems[0]), {
        label: text.actionShare,
        targetIds: [selectedItems[0].id],
      }).catch(showError)
      return
    }
    const allStarred = selectedItems.length > 0 && selectedItems.every((item) => item.starred)
    await runWithPending(() => applyStarAction(selectedItems, !allStarred), {
      label: allStarred ? text.actionUnstar : text.actionStar,
      targetIds: selectedItems.map((item) => item.id),
    }).catch(showError)
  }, [
    selectedItems,
    showFailureMessage,
    text.operationSelectionShareDisabled,
    text.operationUnsupportedFolderDownload,
    runWithPending,
    handleShare,
    applyStarAction,
    startMoveDialog,
    startDeleteDialog,
    text.operationUnsupportedFolderDownload,
  ])

  const pending = operation.active
  const isItemPending = useCallback(
    (itemId: string) => operation.active && operation.targetIds.includes(itemId),
    [operation.active, operation.targetIds],
  )

  return {
    pending,
    operationLabel: operation.label,
    operationTargetIds: operation.targetIds,
    isItemPending,
    selectedItems,
    rename,
    move,
    remove,
    infoTarget,
    closeRename,
    closeMove,
    closeDelete,
    closeInfo,
    updateRenameValue,
    updateMoveTarget,
    handleAction,
    confirmRename,
    confirmMove,
    confirmDelete,
    triggerSelectionAction,
  }
}

function resolveActionLoadingLabel(
  text: (typeof filesMessages)["en"],
  action: FileAction,
  targets: FileItem[],
) {
  if (action === "share") return text.actionShare
  if (action === "unshare") return text.actionUnshare
  if (action === "star") return text.actionStar
  if (action === "unstar") return text.actionUnstar
  if (action === "vaultIn") return text.actionVaultIn
  if (action === "vaultOut") return text.actionVaultOut
  if (action === "move") return text.actionMove
  if (action === "rename") return text.actionRename
  if (action === "delete") {
    return targets.length > 1 ? text.actionDeleteSelected(targets.length) : text.actionDelete
  }
  return text.operationFailed
}
