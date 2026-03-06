"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Loader2 } from "lucide-react"
import type { filesMessages } from "@/lib/i18n"

interface NewFolderDialogProps {
  text: (typeof filesMessages)["en"]
  open: boolean
  name: string
  pending?: boolean
  onNameChange: (value: string) => void
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export function NewFolderDialog({
  text,
  open,
  name,
  pending = false,
  onNameChange,
  onOpenChange,
  onConfirm,
}: NewFolderDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-border/60 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{text.newFolderTitle}</DialogTitle>
          <DialogDescription>{text.newFolderDescription}</DialogDescription>
        </DialogHeader>
        <Input
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder={text.newFolderPlaceholder}
          onKeyDown={(event) => {
            if (event.key === "Enter") onConfirm()
          }}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            {text.cancel}
          </Button>
          <Button onClick={onConfirm} disabled={pending || !name.trim()}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {text.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
