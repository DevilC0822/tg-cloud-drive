"use client"

import { useMemo } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatFileSize, formatRelativeTime, type FileItem } from "@/lib/files"
import type { filesMessages } from "@/lib/i18n"

const PREVIEW_NAMES_LIMIT = 4
const ROOT_FOLDER_VALUE = "__root__"

interface RenameDialogState {
  open: boolean
  value: string
  target: FileItem | null
  pending: boolean
}

interface MoveDialogState {
  open: boolean
  targetFolderId: string
  targets: FileItem[]
  pending: boolean
}

interface DeleteDialogState {
  open: boolean
  targets: FileItem[]
  pending: boolean
}

interface FileOperationDialogsProps {
  text: (typeof filesMessages)["en"]
  folders: FileItem[]
  rename: RenameDialogState
  move: MoveDialogState
  remove: DeleteDialogState
  infoTarget: FileItem | null
  onRenameOpenChange: (open: boolean) => void
  onMoveOpenChange: (open: boolean) => void
  onDeleteOpenChange: (open: boolean) => void
  onInfoOpenChange: (open: boolean) => void
  onRenameChange: (value: string) => void
  onMoveTargetChange: (value: string) => void
  onConfirmRename: () => void
  onConfirmMove: () => void
  onConfirmDelete: () => void
}

function renderNamePreview(items: FileItem[]) {
  const names = items.slice(0, PREVIEW_NAMES_LIMIT).map((item) => item.name)
  const omitted = Math.max(0, items.length - names.length)
  return { names, omitted }
}

function buildFolderOptions(folders: FileItem[]) {
  return folders
    .filter((folder) => folder.type === "folder")
    .sort((a, b) => a.path.localeCompare(b.path))
}

function resolveMoveValue(raw: string) {
  return raw === ROOT_FOLDER_VALUE ? "" : raw
}

export function FileOperationDialogs({
  text,
  folders,
  rename,
  move,
  remove,
  infoTarget,
  onRenameOpenChange,
  onMoveOpenChange,
  onDeleteOpenChange,
  onInfoOpenChange,
  onRenameChange,
  onMoveTargetChange,
  onConfirmRename,
  onConfirmMove,
  onConfirmDelete,
}: FileOperationDialogsProps) {
  const folderOptions = useMemo(() => buildFolderOptions(folders), [folders])
  const movePreview = useMemo(() => renderNamePreview(move.targets), [move.targets])
  const deletePreview = useMemo(() => renderNamePreview(remove.targets), [remove.targets])
  const moveValue = move.targetFolderId || ROOT_FOLDER_VALUE

  return (
    <>
      <Dialog open={rename.open} onOpenChange={onRenameOpenChange}>
        <DialogContent className="glass-card border-border/60 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{text.renameTitle}</DialogTitle>
            <DialogDescription>{rename.target?.name || "-"}</DialogDescription>
          </DialogHeader>
          <Input value={rename.value} onChange={(event) => onRenameChange(event.target.value)} placeholder={text.renamePlaceholder} />
          <DialogFooter>
            <Button variant="outline" onClick={() => onRenameOpenChange(false)} disabled={rename.pending}>
              {text.cancel}
            </Button>
            <Button onClick={onConfirmRename} disabled={rename.pending || !rename.value.trim()}>
              {rename.pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {text.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={move.open} onOpenChange={onMoveOpenChange}>
        <DialogContent className="glass-card border-border/60 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{text.moveTitle}</DialogTitle>
            <DialogDescription>{text.moveDescription(move.targets.length)}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-xl border border-border/50 bg-secondary/30 px-3 py-2.5">
              {movePreview.names.map((name) => (
                <p key={name} className="text-sm text-foreground break-all [overflow-wrap:anywhere]">{name}</p>
              ))}
              {movePreview.omitted > 0 ? <p className="text-xs text-muted-foreground">+ {movePreview.omitted}</p> : null}
            </div>

            <div className="min-w-0 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">{text.moveDestination}</p>
              <Select value={moveValue} onValueChange={(value) => onMoveTargetChange(resolveMoveValue(value))}>
                <SelectTrigger className="w-full border-border/55 bg-secondary/35">
                  <SelectValue className="truncate" />
                </SelectTrigger>
                <SelectContent className="glass max-w-[min(32rem,calc(100vw-3rem))] border-border/55">
                  <SelectItem value={ROOT_FOLDER_VALUE}>{text.moveRoot}</SelectItem>
                  {folderOptions.map((folder) => (
                    <SelectItem
                      key={folder.id}
                      value={folder.id}
                      className="whitespace-normal break-all [overflow-wrap:anywhere]"
                      title={folder.path}
                    >
                      <span className="block min-w-0 break-all [overflow-wrap:anywhere]">{folder.path}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onMoveOpenChange(false)} disabled={move.pending}>
              {text.cancel}
            </Button>
            <Button onClick={onConfirmMove} disabled={move.pending}>
              {move.pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {text.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={remove.open} onOpenChange={onDeleteOpenChange}>
        <DialogContent className="glass-card border-border/60 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{text.deleteTitle}</DialogTitle>
            <DialogDescription>{text.deleteDescription(remove.targets.length)}</DialogDescription>
          </DialogHeader>

          <div className="min-w-0 max-w-full rounded-xl border border-border/50 bg-secondary/30 px-3 py-2.5">
            {deletePreview.names.map((name) => (
              <p key={name} className="min-w-0 max-w-full text-sm text-foreground break-all [overflow-wrap:anywhere]">{name}</p>
            ))}
            {deletePreview.omitted > 0 ? <p className="text-xs text-muted-foreground">+ {deletePreview.omitted}</p> : null}
          </div>

          <DialogFooter>
            <Button variant="outline" disabled={remove.pending} onClick={() => onDeleteOpenChange(false)}>
              {text.cancel}
            </Button>
            <Button variant="destructive" disabled={remove.pending} onClick={onConfirmDelete}>
              {remove.pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {text.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!infoTarget} onOpenChange={onInfoOpenChange}>
        <DialogContent className="glass-card border-border/60 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{text.infoTitle}</DialogTitle>
            <DialogDescription className="break-all">{infoTarget?.name || "-"}</DialogDescription>
          </DialogHeader>

          {infoTarget ? (
            <div className="space-y-2 rounded-xl border border-border/50 bg-secondary/30 px-3 py-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Type</span>
                <span className="font-medium text-foreground">{infoTarget.type}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Size</span>
                <span className="font-medium text-foreground">{formatFileSize(infoTarget.size)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Path</span>
                <span className="max-w-[16rem] break-all text-right font-medium text-foreground">{infoTarget.path}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Updated</span>
                <span className="font-medium text-foreground">{formatRelativeTime(infoTarget.updatedAt)}</span>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button onClick={() => onInfoOpenChange(false)}>{text.confirm}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
