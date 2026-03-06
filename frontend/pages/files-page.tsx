import { useMemo } from "react"
import { motion } from "framer-motion"
import { useLocation, useNavigate } from "react-router-dom"
import { useFilesData } from "@/hooks/use-files-data"
import { useFileActions } from "@/hooks/use-file-actions"
import { useFilesPageFeedback } from "@/hooks/use-files-page-feedback"
import { useVaultBatchGuard } from "@/hooks/use-vault-batch-guard"
import { useI18n } from "@/components/i18n-provider"
import type { FileAction } from "@/components/files/file-actions-menu"
import { FilesBreadcrumbs } from "@/components/files/files-breadcrumbs"
import { FilesContentPanel } from "@/components/files/files-content-panel"
import { FilesPaginationFooter } from "@/components/files/files-pagination-footer"
import { FileOperationDialogs } from "@/components/files/file-operation-dialogs"
import { NewFolderDialog } from "@/components/files/new-folder-dialog"
import { VaultMoveAuthDialog } from "@/components/files/vault-move-auth-dialog"
import { FilesSidebar } from "@/components/files/files-sidebar"
import { VaultStatePanel } from "@/components/files/vault-state-panel"
import { SelectionActionBar } from "@/components/files/selection-action-bar"
import { UploadZone } from "@/components/files/upload-zone"
import { FilesOperationLoadingOverlay } from "@/components/files/files-operation-loading-overlay"
import { VaultBatchProgressDialog } from "@/components/files/vault-batch-progress-dialog"
import { I18nFade } from "@/components/i18n-fade"
import { filesMessages } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { FileItem } from "@/lib/files"
const PAGE_SIZE_OPTIONS = [12, 24, 48]
export default function FilesPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { locale } = useI18n()
  const text = filesMessages[locale]

  const {
    viewMode,
    section,
    searchQuery,
    loading,
    error,
    pagination,
    breadcrumbs,
    displayItems,
    selectedIds,
    toggleSelectFile,
    clearSelection,
    folders,
    openFolder,
    navigateBreadcrumb,
    changePage,
    changePageSize,
    refreshItems,
    refreshFolders,
    createFolder,
    vaultStatusLoading,
    vaultUnlocking,
    vaultEnabled,
    vaultUnlocked,
    vaultExpiresAt,
    unlockVault,
    lockVault,
  } = useFilesData()
  const pageFeedback = useFilesPageFeedback({
    text,
    createFolder,
    unlockVault,
    lockVault,
    refreshItems,
    refreshFolders,
  })
  const isVaultSection = section === "vault"
  const canRenderFiles = !isVaultSection || (vaultEnabled && vaultUnlocked)

  const headerTitle = useMemo(() => {
    if (section === "vault") return text.vaultFiles
    if (section === "shared") return text.sharedFiles
    if (section === "starred") return text.starredFiles
    return text.allFiles
  }, [section, text.allFiles, text.sharedFiles, text.starredFiles, text.vaultFiles])

  const openPreview = (itemId: string) => {
    navigate({ pathname: `/files/preview/${itemId}`, search: location.search })
  }

  const actions = useFileActions({
    items: displayItems,
    selectedIds,
    text,
    openFolder,
    openPreview,
    refreshItems,
    refreshFolders,
    clearSelection,
  })
  const vaultGuard = useVaultBatchGuard({
    selectedIds,
    selectedItems: actions.selectedItems,
    refreshItems,
    refreshFolders,
    text,
  })

  const hasActiveOperation = actions.pending || vaultGuard.processingActive
  const activeOperationLabel = actions.pending ? actions.operationLabel : vaultGuard.processingLabel

  const handleCardOpen = (file: FileItem) => {
    if (file.type === "folder") {
      openFolder(file.id)
      return
    }
    openPreview(file.id)
  }

  const handleMenuAction = (action: FileAction, file: FileItem) => {
    if (action === "vaultIn") {
      void vaultGuard.moveToVault(file)
      return
    }
    if (action === "vaultOut") {
      void vaultGuard.removeFromVault(file)
      return
    }
    void actions.handleAction(action, file)
  }

  return (
    <div className="relative mt-24 flex h-[calc(100vh-6rem)] gap-3 px-3 pb-3 md:mt-28 md:h-[calc(100vh-7rem)] md:gap-4 md:px-4 md:pb-4 lg:gap-5 lg:px-5 lg:pb-5">
      <FilesSidebar
        onCreateFolder={pageFeedback.openNewFolderDialog}
        createFolderDisabled={isVaultSection}
        createFolderDisabledReason={text.newFolderDisabledInVault}
      />

      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <motion.main layout className="glass-card flex flex-1 flex-col overflow-hidden rounded-2xl p-5 md:p-6">
          <FilesOperationLoadingOverlay
            visible={hasActiveOperation}
            label={activeOperationLabel || `${text.actionMove}...`}
          />
          <I18nFade locale={locale} className="flex h-full flex-col">
            <div className="mb-4 flex items-center gap-2 text-sm">
              <FilesBreadcrumbs text={text} isVaultSection={isVaultSection} breadcrumbs={breadcrumbs} onNavigate={navigateBreadcrumb} />
            </div>

            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-foreground">{headerTitle}</h1>
                <p className="text-sm text-muted-foreground">{text.itemCount(pagination.totalCount)}</p>
              </div>

              <div className="hidden items-center gap-2 md:flex">
                <span className="text-xs text-muted-foreground">{text.pageSize}</span>
                <Select value={String(pagination.pageSize)} onValueChange={(value) => changePageSize(Number(value))}>
                  <SelectTrigger size="sm" className="h-8 min-w-[78px] border-border/50 bg-secondary/65 text-xs text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="glass border-border/50">
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <SelectItem key={size} value={String(size)}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {error ? (
              <div className="mb-4 flex items-center justify-between rounded-xl border border-destructive/35 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
                <span>{text.failedLoad}: {error}</span>
                <Button size="sm" variant="outline" onClick={() => void refreshItems()}>
                  {text.retry}
                </Button>
              </div>
            ) : null}

            {isVaultSection ? (
              <VaultStatePanel
                text={text}
                locale={locale}
                loading={vaultStatusLoading}
                enabled={vaultEnabled}
                unlocked={vaultUnlocked}
                expiresAt={vaultExpiresAt}
                password={pageFeedback.vaultPassword}
                unlocking={vaultUnlocking}
                onPasswordChange={pageFeedback.setVaultPassword}
                onUnlock={() => void pageFeedback.handleUnlockVault()}
                onLock={() => void pageFeedback.handleLockVault()}
              />
            ) : null}

            <div className="-mx-2 flex-1 overflow-y-auto px-2 pt-1">
              {canRenderFiles ? (
                <FilesContentPanel
                  text={text}
                  viewMode={viewMode}
                  loading={loading}
                  searchQuery={searchQuery}
                  displayItems={displayItems}
                  selectedIds={selectedIds}
                  isItemBusy={(itemId) => actions.isItemPending(itemId) || vaultGuard.isItemProcessing(itemId)}
                  onSelect={toggleSelectFile}
                  onOpen={handleCardOpen}
                  onAction={handleMenuAction}
                />
              ) : null}
            </div>

            {canRenderFiles ? (
              <>
                <FilesPaginationFooter text={text} pagination={pagination} onPageChange={changePage} />

                <SelectionActionBar
                  text={text}
                  pending={actions.pending || vaultGuard.processingActive}
                  onDownload={() => void actions.triggerSelectionAction("download")}
                  onShare={() => void actions.triggerSelectionAction("share")}
                  onToggleStar={() => void actions.triggerSelectionAction("toggleStar")}
                  onMove={() => void actions.triggerSelectionAction("move")}
                  onDelete={() => void actions.triggerSelectionAction("delete")}
                />
              </>
            ) : null}

            <FileOperationDialogs
              text={text}
              folders={folders}
              rename={{
                open: actions.rename.open,
                value: actions.rename.value,
                target: actions.rename.target,
                pending: actions.pending,
              }}
              move={{
                open: actions.move.open,
                targetFolderId: actions.move.targetFolderId,
                targets: actions.move.targets,
                pending: actions.pending,
              }}
              remove={{
                open: actions.remove.open,
                targets: actions.remove.targets,
                pending: actions.pending,
              }}
              infoTarget={actions.infoTarget}
              onRenameOpenChange={(open) => {
                if (!open) actions.closeRename()
              }}
              onMoveOpenChange={(open) => {
                if (!open) actions.closeMove()
              }}
              onDeleteOpenChange={(open) => {
                if (!open) actions.closeDelete()
              }}
              onInfoOpenChange={(open) => {
                if (!open) actions.closeInfo()
              }}
              onRenameChange={actions.updateRenameValue}
              onMoveTargetChange={actions.updateMoveTarget}
              onConfirmRename={() => void actions.confirmRename()}
              onConfirmMove={() => void actions.confirmMove()}
              onConfirmDelete={() => void actions.confirmDelete()}
            />
          </I18nFade>
        </motion.main>
      </div>

      <NewFolderDialog
        text={text}
        open={pageFeedback.newFolderDialogOpen}
        name={pageFeedback.newFolderName}
        pending={pageFeedback.newFolderPending}
        onNameChange={pageFeedback.setNewFolderName}
        onOpenChange={(open) => (open ? pageFeedback.openNewFolderDialog() : pageFeedback.closeNewFolderDialog())}
        onConfirm={() => void pageFeedback.handleCreateFolder()}
      />
      <VaultMoveAuthDialog
        text={text}
        open={vaultGuard.dialogOpen}
        pending={vaultGuard.dialogPending}
        enabled={vaultGuard.dialogEnabled}
        password={vaultGuard.dialogPassword}
        error={vaultGuard.dialogError}
        targets={vaultGuard.dialogTargets}
        onOpenChange={(open) => {
          if (!open) vaultGuard.closeDialog()
        }}
        onPasswordChange={vaultGuard.setDialogPassword}
        onConfirm={() => void vaultGuard.confirmUnlockAndRun()}
      />
      <VaultBatchProgressDialog
        text={text}
        open={vaultGuard.progress.open}
        pending={vaultGuard.progress.pending}
        enabled={vaultGuard.progress.enabled}
        stage={vaultGuard.progress.stage}
        totalTargets={vaultGuard.progress.totalTargets}
        doneTargets={vaultGuard.progress.doneTargets}
        succeededTargets={vaultGuard.progress.succeededTargets}
        failedTargets={vaultGuard.progress.failedTargets}
        percent={vaultGuard.progress.percent}
        currentItemName={vaultGuard.progress.currentItemName}
        currentItemType={vaultGuard.progress.currentItemType}
        currentItemPercent={vaultGuard.progress.currentItemPercent}
        totalItems={vaultGuard.progress.totalItems}
        eligibleSpoilerFiles={vaultGuard.progress.eligibleSpoilerFiles}
        processedEligibleFiles={vaultGuard.progress.processedEligibleFiles}
        appliedSpoilerFiles={vaultGuard.progress.appliedSpoilerFiles}
        skippedSpoilerFiles={vaultGuard.progress.skippedSpoilerFiles}
        failedSpoilerFiles={vaultGuard.progress.failedSpoilerFiles}
        failures={vaultGuard.progress.failures}
        message={vaultGuard.progress.message}
        onOpenChange={(open) => {
          if (!open && !vaultGuard.progress.pending) {
            vaultGuard.closeProgress()
          }
        }}
        onClose={vaultGuard.closeProgress}
      />

      <UploadZone onUploaded={pageFeedback.onUploadCompleted} />
    </div>
  )
}
