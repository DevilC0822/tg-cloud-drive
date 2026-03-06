import { motion } from "framer-motion"
import { ArrowRight, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import type { TransferJobSummary } from "@/lib/transfers-api"
import type { transferMessages } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { formatFileSize } from "@/lib/files"
import {
  getTransferCountsLabel,
  getTransferDirectionIcon,
  getTransferDirectionLabel,
  getTransferPhaseLabel,
  getTransferProgressLabel,
  getTransferSourceIcon,
  getTransferSourceLabel,
  getTransferStartedLabel,
  getTransferStatusLabel,
  getTransferStatusTone,
  getTransferUpdatedLabel,
} from "@/components/transfers/transfer-presenters"

interface LiveTransferCardProps {
  item: TransferJobSummary
  text: (typeof transferMessages)["en"]
  onOpenDetail: (id: string) => void
}

function ProgressRail({ percent }: { percent: number }) {
  return (
    <div className="relative">
      <Progress value={percent} className="h-2.5 bg-primary/12" />
      <div
        className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-transparent via-white/35 to-transparent opacity-70"
        style={{
          width: `${Math.max(percent, 12)}%`,
          transform: "translateX(-30%)",
        }}
      />
    </div>
  )
}

export function LiveTransferCard({ item, text, onOpenDetail }: LiveTransferCardProps) {
  const DirectionIcon = getTransferDirectionIcon(item.direction)
  const SourceIcon = getTransferSourceIcon(item.sourceKind)

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="group glass-card relative overflow-hidden rounded-[28px] border border-border/60 p-4 md:p-5"
    >
      <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-3">
              <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/35 bg-primary/10 text-primary">
                <SourceIcon className="h-5 w-5" />
                <span className="animate-pulse-glow absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-lg font-semibold text-foreground">{item.name}</h3>
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
                  <span>·</span>
                  <span>{text.startedAt}: {getTransferStartedLabel(item)}</span>
                  <span>·</span>
                  <span>{text.updatedAt}: {getTransferUpdatedLabel(item)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 lg:shrink-0">
            <div className="text-right">
              <div className="font-mono text-2xl font-semibold text-foreground">{item.progress.percent}%</div>
              <div className="text-xs text-muted-foreground">{getTransferProgressLabel(item)}</div>
            </div>
            <Button variant="ghost" size="sm" className="rounded-full" onClick={() => onOpenDetail(item.id)}>
              {text.openDetail}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <ProgressRail percent={item.progress.percent} />

          <div className="grid gap-2 text-sm text-muted-foreground lg:grid-cols-[1.25fr_1fr]">
          <div className="rounded-2xl border border-border/50 bg-secondary/20 px-3 py-2.5">
            {getTransferCountsLabel(item, text)}
          </div>
          <div className="rounded-2xl border border-border/50 bg-secondary/20 px-3 py-2.5">
            {text.totalSize}: {item.totalSize > 0 ? formatFileSize(item.totalSize) : "—"}
          </div>
        </div>

        {item.previewItems.length > 0 ? (
          <div className="rounded-2xl border border-border/50 bg-black/10 px-3 py-3">
            <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              {text.recentItems}
            </div>
            <div className="grid gap-2">
              {item.previewItems.slice(0, 4).map((preview) => (
                <div key={preview.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border/40 bg-secondary/20 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">{preview.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {preview.percent}% · {preview.error?.trim() || text.noIssues}
                    </p>
                  </div>
                  <Badge variant="outline" className="rounded-full border-border/50 bg-background/50 text-xs">
                    {preview.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </motion.article>
  )
}
