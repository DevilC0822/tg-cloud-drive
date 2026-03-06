"use client"

import { motion } from "framer-motion"
import {
  Archive,
  Check,
  Code2,
  FileText,
  Film,
  FolderOpen,
  Image,
  Loader2,
  MoreHorizontal,
  Music,
  Star,
  Share2,
} from "lucide-react"
import { FileActionsDropdown, type FileAction } from "@/components/files/file-actions-menu"
import { cn } from "@/lib/utils"
import type { FileItem } from "@/lib/files"
import { formatFileSize, formatRelativeTime } from "@/lib/files"
import type { filesMessages } from "@/lib/i18n"

export type { FileItem } from "@/lib/files"

interface FileCardProps {
  file: FileItem
  viewMode: "grid" | "list"
  isSelected?: boolean
  onSelect?: () => void
  onOpen?: () => void
  busy?: boolean
  menuSelectionCount: number
  actionText: (typeof filesMessages)["en"]
  onAction?: (action: FileAction, file: FileItem) => void
}

function getFileIcon(type: FileItem["type"]) {
  if (type === "folder") return FolderOpen
  if (type === "image") return Image
  if (type === "document") return FileText
  if (type === "video") return Film
  if (type === "audio") return Music
  if (type === "archive") return Archive
  if (type === "code") return Code2
  return FileText
}

function getIconStyle(type: FileItem["type"]) {
  if (type === "folder") return { bg: "bg-amber-500/12", icon: "text-amber-500" }
  if (type === "image") return { bg: "bg-emerald-500/12", icon: "text-emerald-500" }
  if (type === "document") return { bg: "bg-blue-500/12", icon: "text-blue-500" }
  if (type === "video") return { bg: "bg-rose-500/12", icon: "text-rose-500" }
  if (type === "audio") return { bg: "bg-violet-500/12", icon: "text-violet-500" }
  if (type === "archive") return { bg: "bg-orange-500/12", icon: "text-orange-500" }
  if (type === "code") return { bg: "bg-cyan-500/12", icon: "text-cyan-500" }
  return { bg: "bg-muted/40", icon: "text-muted-foreground" }
}

export function FileCard({
  file,
  viewMode,
  isSelected,
  onSelect,
  onOpen,
  busy = false,
  menuSelectionCount,
  actionText,
  onAction,
}: FileCardProps) {
  const Icon = getFileIcon(file.type)
  const iconStyle = getIconStyle(file.type)
  const sizeLabel = file.type === "folder" ? "—" : formatFileSize(file.size)
  const updatedLabel = formatRelativeTime(file.updatedAt)

  if (viewMode === "list") {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={onSelect}
        onDoubleClick={onOpen}
        className={cn(
          "group grid cursor-pointer grid-cols-[20px_40px_minmax(0,1fr)_120px_120px_48px] items-center gap-3 rounded-xl px-3 py-2.5 transition-all",
          "hover:bg-secondary/45",
          isSelected && "bg-primary/10 ring-1 ring-primary/30",
        )}
      >
        <div
          className={cn(
            "flex h-5 w-5 items-center justify-center rounded-md border text-primary transition-all",
            isSelected ? "border-primary bg-primary text-primary-foreground" : "border-border/70",
          )}
        >
          {isSelected ? <Check className="h-3.5 w-3.5" /> : null}
        </div>

        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", iconStyle.bg)}>
          <Icon className={cn("h-5 w-5", iconStyle.icon)} />
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-foreground">{file.name}</span>
            {file.starred ? <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" /> : null}
            {file.isShared ? <Share2 className="h-3.5 w-3.5 text-primary" /> : null}
          </div>
        </div>

        <span className="text-right text-xs text-muted-foreground">{sizeLabel}</span>
        <span className="text-right text-xs text-muted-foreground">{updatedLabel}</span>
        <div className="flex justify-end opacity-0 transition-opacity group-hover:opacity-100">
          {busy ? (
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-primary/12 text-primary">
              <Loader2 className="h-4 w-4 animate-spin" />
            </span>
          ) : null}
          {onAction ? (
            <FileActionsDropdown
              file={file}
              selectedCount={menuSelectionCount}
              text={actionText}
              onAction={onAction}
              trigger={
                <button
                  disabled={busy}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
                  onClick={(event) => event.stopPropagation()}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              }
            />
          ) : null}
        </div>
      </motion.div>
    )
  }

  return (
    <motion.article
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -2 }}
      onClick={onSelect}
      onDoubleClick={onOpen}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border/50 bg-card/90 p-3 transition-all",
        "hover:border-border hover:shadow-lg hover:shadow-black/10 dark:hover:shadow-black/30",
        isSelected && "ring-2 ring-primary/45",
      )}
    >
      <div
        className={cn(
          "absolute left-3 top-3 flex h-5 w-5 items-center justify-center rounded-md border text-primary transition-all",
          isSelected ? "border-primary bg-primary text-primary-foreground" : "border-border/80 bg-background/80 opacity-0 group-hover:opacity-100",
        )}
      >
        {isSelected ? <Check className="h-3.5 w-3.5" /> : null}
      </div>

      <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
        {busy ? (
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/12 text-primary">
            <Loader2 className="h-4 w-4 animate-spin" />
          </span>
        ) : null}
        {onAction ? (
          <FileActionsDropdown
            file={file}
            selectedCount={menuSelectionCount}
            text={actionText}
            onAction={onAction}
            trigger={
              <button
                disabled={busy}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
                onClick={(event) => event.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            }
          />
        ) : null}
      </div>

      <div className={cn("mb-3 flex aspect-[4/3] items-center justify-center rounded-xl", iconStyle.bg)}>
        <Icon className={cn("h-10 w-10", iconStyle.icon)} />
      </div>

      <div className="space-y-1">
        <div className="flex items-start gap-2">
          <h4 className="line-clamp-2 min-h-[2.5rem] flex-1 text-sm font-medium text-foreground">{file.name}</h4>
          <div className="flex items-center gap-1">
            {file.starred ? <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" /> : null}
            {file.isShared ? <Share2 className="h-3.5 w-3.5 text-primary" /> : null}
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{sizeLabel}</span>
          <span>{updatedLabel}</span>
        </div>
      </div>
    </motion.article>
  )
}
