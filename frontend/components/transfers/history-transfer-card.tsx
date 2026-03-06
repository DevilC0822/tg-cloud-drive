import { Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { TransferJobSummary } from "@/lib/transfers-api"
import type { transferMessages } from "@/lib/i18n"
import { formatFileSize } from "@/lib/files"
import {
  getTransferCountsLabel,
  getTransferDirectionIcon,
  getTransferDirectionLabel,
  getTransferPhaseLabel,
  getTransferSourceIcon,
  getTransferSourceLabel,
  getTransferStartedLabel,
  getTransferStatusLabel,
  getTransferStatusTone,
  getTransferUpdatedLabel,
} from "@/components/transfers/transfer-presenters"
import { cn } from "@/lib/utils"

interface HistoryTransferCardProps {
  item: TransferJobSummary
  text: (typeof transferMessages)["en"]
  onOpenDetail: (id: string) => void
  onDelete: (id: string) => void
}

export function HistoryTransferCard({ item, text, onOpenDetail, onDelete }: HistoryTransferCardProps) {
  const DirectionIcon = getTransferDirectionIcon(item.direction)
  const SourceIcon = getTransferSourceIcon(item.sourceKind)

  return (
    <article className="glass-card rounded-[26px] border border-border/60 p-4 transition-transform duration-300 hover:-translate-y-1">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold text-foreground">{item.name}</h3>
            <Badge variant="outline" className={cn("rounded-full px-2.5 py-1", getTransferStatusTone(item.status))}>
              {getTransferStatusLabel(item.status, text)}
            </Badge>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="rounded-full border-border/60 bg-secondary/45 text-muted-foreground">
              <DirectionIcon className="h-3 w-3" />
              {getTransferDirectionLabel(item.direction, text)}
            </Badge>
            <Badge variant="outline" className="rounded-full border-border/60 bg-secondary/45 text-muted-foreground">
              <SourceIcon className="h-3 w-3" />
              {getTransferSourceLabel(item.sourceKind, text)}
            </Badge>
            <span>{getTransferPhaseLabel(item.phase, text)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenDetail(item.id)}>
            {text.openDetail}
          </Button>
          <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive" onClick={() => onDelete(item.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
        <div className="rounded-2xl border border-border/50 bg-secondary/20 px-3 py-2.5">{getTransferCountsLabel(item, text)}</div>
        <div className="rounded-2xl border border-border/50 bg-secondary/20 px-3 py-2.5">
          {text.totalSize}: {item.totalSize > 0 ? formatFileSize(item.totalSize) : "—"}
        </div>
        <div className="rounded-2xl border border-border/50 bg-secondary/20 px-3 py-2.5">
          {text.startedAt}: {getTransferStartedLabel(item)}
        </div>
        <div className="rounded-2xl border border-border/50 bg-secondary/20 px-3 py-2.5">
          {text.updatedAt}: {getTransferUpdatedLabel(item)}
        </div>
      </div>

      {item.lastError ? (
        <div className="mt-3 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-200">
          {text.lastError}: {item.lastError}
        </div>
      ) : null}
    </article>
  )
}
