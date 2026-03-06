"use client"

import type { ReactNode } from "react"
import {
  Download,
  Eye,
  FolderInput,
  Info,
  Lock,
  LockOpen,
  Pencil,
  Share2,
  Star,
  Trash2,
} from "lucide-react"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { FileItem } from "@/lib/files"
import type { filesMessages } from "@/lib/i18n"

export type FileAction =
  | "preview"
  | "download"
  | "share"
  | "unshare"
  | "rename"
  | "move"
  | "vaultIn"
  | "vaultOut"
  | "info"
  | "delete"
  | "star"
  | "unstar"

interface ActionEntry {
  key: FileAction
  label: string
  icon: typeof Eye
  danger?: boolean
  disabled?: boolean
  separate?: boolean
}

interface FileActionMenuProps {
  file: FileItem
  selectedCount: number
  text: (typeof filesMessages)["en"]
  onAction: (action: FileAction, file: FileItem) => void
}

interface FileActionsDropdownProps extends FileActionMenuProps {
  trigger: ReactNode
  align?: "start" | "center" | "end"
}

interface FileActionsContextMenuProps extends FileActionMenuProps {
  children: ReactNode
}

function buildActions(file: FileItem, selectedCount: number, text: (typeof filesMessages)["en"]): ActionEntry[] {
  const multiple = selectedCount > 1
  const shareDisabled = file.type === "folder" || multiple
  const vaultAction = file.isVaulted
    ? { key: "vaultOut" as const, label: text.actionVaultOut, icon: LockOpen }
    : { key: "vaultIn" as const, label: text.actionVaultIn, icon: Lock }
  const starAction = file.starred
    ? { key: "unstar" as const, label: text.actionUnstar, icon: Star }
    : { key: "star" as const, label: text.actionStar, icon: Star }

  const actions: ActionEntry[] = [
    {
      key: "preview",
      label: file.type === "folder" ? text.actionOpen : text.actionPreview,
      icon: Eye,
      disabled: multiple,
    },
    { key: "download", label: text.actionDownload, icon: Download, disabled: file.type === "folder" },
    { key: "share", label: text.actionShare, icon: Share2, disabled: shareDisabled },
    { key: "unshare", label: text.actionUnshare, icon: Share2, disabled: shareDisabled, separate: true },
    { key: "rename", label: text.actionRename, icon: Pencil, disabled: multiple, separate: true },
    { key: "move", label: text.actionMove, icon: FolderInput },
    { ...vaultAction },
    { key: "info", label: text.actionInfo, icon: Info, disabled: multiple, separate: true },
    { ...starAction },
    {
      key: "delete",
      label: multiple ? text.actionDeleteSelected(selectedCount) : text.actionDelete,
      icon: Trash2,
      danger: true,
      separate: true,
    },
  ]

  if (!file.isShared) {
    return actions.filter((action) => action.key !== "unshare")
  }
  return actions
}

function handleClick(handler: (action: FileAction, file: FileItem) => void, action: FileAction, file: FileItem) {
  handler(action, file)
}

export function FileActionsDropdown({ file, selectedCount, text, trigger, onAction, align = "end" }: FileActionsDropdownProps) {
  const actions = buildActions(file, selectedCount, text)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="glass w-56 border-border/55">
        {actions.map((entry) => (
          <div key={entry.key}>
            {entry.separate ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem
              disabled={entry.disabled}
              variant={entry.danger ? "destructive" : "default"}
              className="cursor-pointer gap-2"
              onClick={() => handleClick(onAction, entry.key, file)}
            >
              <entry.icon className="h-4 w-4" />
              {entry.label}
            </DropdownMenuItem>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function FileActionsContextMenu({ file, selectedCount, text, children, onAction }: FileActionsContextMenuProps) {
  const actions = buildActions(file, selectedCount, text)

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="glass w-56 border-border/55">
        {actions.map((entry) => (
          <div key={entry.key}>
            {entry.separate ? <ContextMenuSeparator /> : null}
            <ContextMenuItem
              disabled={entry.disabled}
              variant={entry.danger ? "destructive" : "default"}
              className="cursor-pointer gap-2"
              onClick={() => handleClick(onAction, entry.key, file)}
            >
              <entry.icon className="h-4 w-4" />
              {entry.label}
            </ContextMenuItem>
          </div>
        ))}
      </ContextMenuContent>
    </ContextMenu>
  )
}
