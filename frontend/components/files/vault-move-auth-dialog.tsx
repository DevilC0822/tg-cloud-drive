import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Loader2 } from "lucide-react"
import type { FileItem } from "@/lib/files"
import type { filesMessages } from "@/lib/i18n"

const PREVIEW_LIMIT = 4

interface VaultMoveAuthDialogProps {
  text: (typeof filesMessages)["en"]
  open: boolean
  pending: boolean
  enabled?: boolean
  password: string
  error: string
  targets: FileItem[]
  onOpenChange: (open: boolean) => void
  onPasswordChange: (value: string) => void
  onConfirm: () => void
}

function renderNamePreview(targets: FileItem[]) {
  const names = targets.slice(0, PREVIEW_LIMIT).map((item) => item.name)
  const omitted = Math.max(0, targets.length - names.length)
  return { names, omitted }
}

export function VaultMoveAuthDialog({
  text,
  open,
  pending,
  enabled = true,
  password,
  error,
  targets,
  onOpenChange,
  onPasswordChange,
  onConfirm,
}: VaultMoveAuthDialogProps) {
  const preview = renderNamePreview(targets)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-border/60 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{enabled ? text.actionVaultIn : text.actionVaultOut}</DialogTitle>
          <DialogDescription>{text.vaultLockedDesc}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-xl border border-border/50 bg-secondary/30 px-3 py-2.5">
            {preview.names.map((name) => (
              <p key={name} className="text-sm text-foreground break-all [overflow-wrap:anywhere]">{name}</p>
            ))}
            {preview.omitted > 0 ? <p className="text-xs text-muted-foreground">+ {preview.omitted}</p> : null}
          </div>
          <Input
            type="password"
            value={password}
            placeholder={text.vaultPasswordLabel}
            onChange={(event) => onPasswordChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onConfirm()
            }}
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            {text.cancel}
          </Button>
          <Button onClick={onConfirm} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {pending ? text.vaultUnlocking : text.vaultUnlockAction}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
