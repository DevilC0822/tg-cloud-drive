import { useCallback, useState } from "react"
import { useToast } from "@/hooks/use-toast"
import type { filesMessages } from "@/lib/i18n"

interface UseFilesPageFeedbackOptions {
  text: (typeof filesMessages)["en"]
  createFolder: (name: string) => Promise<unknown>
  unlockVault: (password: string) => Promise<void>
  lockVault: () => Promise<void>
  refreshItems: () => Promise<void>
  refreshFolders: () => Promise<void>
}

export function useFilesPageFeedback({
  text,
  createFolder,
  unlockVault,
  lockVault,
  refreshItems,
  refreshFolders,
}: UseFilesPageFeedbackOptions) {
  const { toast } = useToast()
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")
  const [newFolderPending, setNewFolderPending] = useState(false)
  const [vaultPassword, setVaultPassword] = useState("")

  const openNewFolderDialog = useCallback(() => {
    setNewFolderDialogOpen(true)
  }, [])

  const closeNewFolderDialog = useCallback(() => {
    setNewFolderDialogOpen(false)
    setNewFolderName("")
  }, [])

  const handleCreateFolder = useCallback(async () => {
    const trimmed = newFolderName.trim()
    if (!trimmed) return
    setNewFolderPending(true)
    try {
      await createFolder(trimmed)
      closeNewFolderDialog()
      toast({ title: text.newFolderSuccess })
    } catch (error: unknown) {
      const message = error instanceof Error && error.message ? error.message : text.operationFailed
      toast({ title: message, variant: "destructive" })
    } finally {
      setNewFolderPending(false)
    }
  }, [closeNewFolderDialog, createFolder, newFolderName, text.newFolderSuccess, text.operationFailed, toast])

  const handleUnlockVault = useCallback(async () => {
    if (!vaultPassword.trim()) {
      toast({ title: text.vaultPasswordRequired, variant: "destructive" })
      return
    }
    try {
      await unlockVault(vaultPassword)
      setVaultPassword("")
      toast({ title: text.vaultUnlockSuccess })
      await refreshItems()
    } catch (error: unknown) {
      const message = error instanceof Error && error.message ? error.message : text.operationFailed
      toast({ title: message, variant: "destructive" })
    }
  }, [refreshItems, text.operationFailed, text.vaultPasswordRequired, text.vaultUnlockSuccess, toast, unlockVault, vaultPassword])

  const handleLockVault = useCallback(async () => {
    try {
      await lockVault()
      toast({ title: text.vaultLockSuccess })
    } catch (error: unknown) {
      const message = error instanceof Error && error.message ? error.message : text.operationFailed
      toast({ title: message, variant: "destructive" })
    }
  }, [lockVault, text.operationFailed, text.vaultLockSuccess, toast])

  const onUploadCompleted = useCallback(() => {
    void refreshFolders()
    void refreshItems()
  }, [refreshFolders, refreshItems])

  return {
    newFolderDialogOpen,
    newFolderName,
    newFolderPending,
    vaultPassword,
    setNewFolderName,
    setVaultPassword,
    openNewFolderDialog,
    closeNewFolderDialog,
    handleCreateFolder,
    handleUnlockVault,
    handleLockVault,
    onUploadCompleted,
  }
}
