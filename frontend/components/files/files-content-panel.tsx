"use client"

import { AnimatePresence, motion } from "framer-motion"
import { FolderOpen, Loader2 } from "lucide-react"
import { FileActionsContextMenu, type FileAction } from "@/components/files/file-actions-menu"
import { FileCard } from "@/components/files/file-card"
import type { FileItem } from "@/lib/files"
import type { filesMessages } from "@/lib/i18n"

interface FilesContentPanelProps {
  text: (typeof filesMessages)["en"]
  viewMode: "grid" | "list"
  loading: boolean
  searchQuery: string
  displayItems: FileItem[]
  selectedIds: string[]
  isItemBusy: (itemId: string) => boolean
  onSelect: (fileId: string) => void
  onOpen: (file: FileItem) => void
  onAction: (action: FileAction, file: FileItem) => void
}

function resolveMenuSelectionCount(fileId: string, selectedIds: string[]) {
  if (selectedIds.length > 1 && selectedIds.includes(fileId)) {
    return selectedIds.length
  }
  return 1
}

function GridCards({ text, displayItems, selectedIds, isItemBusy, onSelect, onOpen, onAction }: Omit<FilesContentPanelProps, "viewMode" | "loading" | "searchQuery">) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      <AnimatePresence mode="popLayout">
        {displayItems.map((file, index) => (
          <motion.div
            key={file.id}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ delay: index * 0.015 }}
          >
            <FileActionsContextMenu
              file={file}
              selectedCount={resolveMenuSelectionCount(file.id, selectedIds)}
              text={text}
              onAction={onAction}
            >
              <FileCard
                file={file}
                viewMode="grid"
                isSelected={selectedIds.includes(file.id)}
                onSelect={() => onSelect(file.id)}
                onOpen={() => onOpen(file)}
                busy={isItemBusy(file.id)}
                menuSelectionCount={resolveMenuSelectionCount(file.id, selectedIds)}
                actionText={text}
                onAction={onAction}
              />
            </FileActionsContextMenu>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

function ListCards({ text, displayItems, selectedIds, isItemBusy, onSelect, onOpen, onAction }: Omit<FilesContentPanelProps, "viewMode" | "loading" | "searchQuery">) {
  return (
    <div className="space-y-1">
      <div className="grid grid-cols-[20px_40px_minmax(0,1fr)_120px_120px_48px] items-center gap-3 border-b border-border/40 px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground">
        <div />
        <div />
        <div>{text.listName}</div>
        <div className="text-right">{text.listSize}</div>
        <div className="text-right">{text.listUpdated}</div>
        <div />
      </div>

      <AnimatePresence mode="popLayout">
        {displayItems.map((file, index) => (
          <motion.div key={file.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ delay: index * 0.01 }}>
            <FileActionsContextMenu
              file={file}
              selectedCount={resolveMenuSelectionCount(file.id, selectedIds)}
              text={text}
              onAction={onAction}
            >
              <FileCard
                file={file}
                viewMode="list"
                isSelected={selectedIds.includes(file.id)}
                onSelect={() => onSelect(file.id)}
                onOpen={() => onOpen(file)}
                busy={isItemBusy(file.id)}
                menuSelectionCount={resolveMenuSelectionCount(file.id, selectedIds)}
                actionText={text}
                onAction={onAction}
              />
            </FileActionsContextMenu>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

export function FilesContentPanel({ text, viewMode, loading, searchQuery, displayItems, selectedIds, isItemBusy, onSelect, onOpen, onAction }: FilesContentPanelProps) {
  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center py-20 text-center">
        <Loader2 className="mb-3 h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{text.loading}</p>
      </div>
    )
  }

  if (displayItems.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-muted/50 dark:bg-muted/30">
          <FolderOpen className="h-10 w-10 text-muted-foreground/60" />
        </div>
        <h3 className="mb-2 text-lg font-semibold text-foreground">{text.emptyTitle}</h3>
        <p className="max-w-sm text-sm text-muted-foreground">
          {searchQuery ? text.emptySearchDescription(searchQuery) : text.emptyDescription}
        </p>
      </div>
    )
  }

  if (viewMode === "grid") {
    return (
      <GridCards
        text={text}
        displayItems={displayItems}
        selectedIds={selectedIds}
        isItemBusy={isItemBusy}
        onSelect={onSelect}
        onOpen={onOpen}
        onAction={onAction}
      />
    )
  }

  return (
    <ListCards
      text={text}
      displayItems={displayItems}
      selectedIds={selectedIds}
      isItemBusy={isItemBusy}
      onSelect={onSelect}
      onOpen={onOpen}
      onAction={onAction}
    />
  )
}
