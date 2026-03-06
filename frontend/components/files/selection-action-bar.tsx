"use client"

import { useEffect, useMemo, useState } from "react"
import { useAtom, useAtomValue } from "jotai"
import { AnimatePresence, motion } from "framer-motion"
import { Download, Loader2, Share2, Star, Trash2, X, FolderInput } from "lucide-react"
import { Button } from "@/components/ui/button"
import { fetchFolderTotalSize } from "@/lib/files-api"
import { formatFileSize, type FileItem } from "@/lib/files"
import type { filesMessages } from "@/lib/i18n"
import { filesSelectedFileIdsAtom, filesSelectedItemsAtom } from "@/stores/files-atoms"

interface SelectionActionBarProps {
  text: (typeof filesMessages)["en"]
  pending?: boolean
  onDownload: () => void
  onShare: () => void
  onToggleStar: () => void
  onMove: () => void
  onDelete: () => void
}

function hasAnyFolder(items: FileItem[]) {
  return items.some((item) => item.type === "folder")
}

function canShare(items: FileItem[]) {
  return items.length === 1 && items[0].type !== "folder"
}

export function SelectionActionBar({
  text,
  pending = false,
  onDownload,
  onShare,
  onToggleStar,
  onMove,
  onDelete,
}: SelectionActionBarProps) {
  const selectedItems = useAtomValue(filesSelectedItemsAtom)
  const [, setSelectedIds] = useAtom(filesSelectedFileIdsAtom)
  const [resolvedTotalBytes, setResolvedTotalBytes] = useState(0)
  const [resolvingFolderSize, setResolvingFolderSize] = useState(false)

  const selectedCount = selectedItems.length
  const allStarred = selectedCount > 0 && selectedItems.every((item) => item.starred)
  const containsFolder = hasAnyFolder(selectedItems)
  const shareEnabled = canShare(selectedItems)
  const totalSizeLabel = useMemo(() => formatFileSize(resolvedTotalBytes), [resolvedTotalBytes])

  useEffect(() => {
    let cancelled = false

    async function resolveTotalSize() {
      const directFileBytes = selectedItems.reduce((sum, item) => {
        if (item.type === "folder") return sum
        return sum + Math.max(0, item.size)
      }, 0)

      const folderItems = selectedItems.filter((item) => item.type === "folder")
      if (folderItems.length === 0) {
        setResolvedTotalBytes(directFileBytes)
        setResolvingFolderSize(false)
        return
      }

      setResolvingFolderSize(true)
      try {
        const folderSizes = await Promise.all(folderItems.map((folder) => fetchFolderTotalSize(folder.id)))
        if (cancelled) return
        const nestedSize = folderSizes.reduce((sum, size) => sum + Math.max(0, size), 0)
        setResolvedTotalBytes(directFileBytes + nestedSize)
      } finally {
        if (!cancelled) {
          setResolvingFolderSize(false)
        }
      }
    }

    void resolveTotalSize()
    return () => {
      cancelled = true
    }
  }, [selectedItems])

  return (
    <AnimatePresence>
      {selectedCount > 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 14, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 360, damping: 32 }}
          className="absolute bottom-5 left-1/2 z-40 -translate-x-1/2"
        >
          <div className="glass flex items-center gap-2 rounded-2xl border border-border/55 px-3 py-2 shadow-2xl shadow-black/20">
            <div className="px-2">
              <p className="text-sm font-medium text-foreground">{text.selectedCount(selectedCount)}</p>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                {resolvingFolderSize ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                <span>{totalSizeLabel}</span>
              </p>
            </div>

            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5 text-muted-foreground"
              disabled={pending || containsFolder}
              onClick={onDownload}
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">{text.actionDownload}</span>
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5 text-muted-foreground"
              disabled={pending || !shareEnabled}
              onClick={onShare}
            >
              <Share2 className="h-4 w-4" />
              <span className="hidden sm:inline">{text.actionShare}</span>
            </Button>

            <Button size="sm" variant="ghost" className="gap-1.5" disabled={pending} onClick={onToggleStar}>
              <Star className={allStarred ? "h-4 w-4 fill-amber-500 text-amber-500" : "h-4 w-4 text-muted-foreground"} />
              <span className="hidden sm:inline">{allStarred ? text.actionUnstar : text.actionStar}</span>
            </Button>

            <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground" disabled={pending} onClick={onMove}>
              <FolderInput className="h-4 w-4" />
              <span className="hidden sm:inline">{text.actionMove}</span>
            </Button>

            <Button size="sm" variant="ghost" className="gap-1.5 text-destructive" disabled={pending} onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">{text.actionDelete}</span>
            </Button>

            <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" onClick={() => setSelectedIds([])} disabled={pending}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
