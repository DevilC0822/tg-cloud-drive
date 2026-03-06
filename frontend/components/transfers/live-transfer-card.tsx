import { motion } from "framer-motion"
import { ArrowRight, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import type { TransferJobSummary } from "@/lib/transfers-api"
import type { transferMessages } from "@/lib/i18n"
import { semanticToneClasses, themeToneClasses } from "@/lib/palette"
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
      <motion.div
        className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-transparent via-[var(--surface-sheen)] to-transparent opacity-70"
        animate={{ 
          x: ["-100%", "200%"],
          opacity: [0.3, 0.7, 0.3]
        }}
        transition={{ 
          duration: 2, 
          repeat: Infinity, 
          ease: "linear" 
        }}
        style={{ width: "30%" }}
      />
    </div>
  )
}

export function LiveTransferCard({ item, text, onOpenDetail }: LiveTransferCardProps) {
  const DirectionIcon = getTransferDirectionIcon(item.direction)
  const SourceIcon = getTransferSourceIcon(item.sourceKind)
  const infoTone = themeToneClasses.info

  return (
    <motion.article
      layout
      initial={{ opacity: 0, scale: 0.98, filter: "blur(4px)" }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, scale: 0.98, filter: "blur(4px)" }}
      whileHover={{ 
        scale: 1.02, 
        y: -4,
      }}
      transition={{ 
        layout: { duration: 0.3 },
        default: { type: "spring", stiffness: 400, damping: 25 }
      }}
      className="group relative bg-secondary/30 rounded-3xl p-5 md:p-6 border border-border/50 hover:border-primary/30 hover:bg-secondary/50 transition-all duration-300 cursor-pointer overflow-hidden shadow-sm hover:shadow-xl hover:shadow-primary/5"
    >
      <motion.div 
        className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent"
        animate={{ 
          opacity: [0.4, 1, 0.4],
          scaleX: [0.8, 1.2, 0.8]
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />
      
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-4">
              <motion.div 
                whileHover={{ rotate: 10, scale: 1.1 }}
                className={cn(
                  "relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border transition-colors",
                  infoTone.iconWrap,
                  "group-hover:bg-[var(--tone-info-bg-strong)]",
                )}
              >
                <SourceIcon className="h-6 w-6" />
                <span className="animate-pulse-glow absolute -right-1 -top-1 h-3 w-3 rounded-full bg-primary shadow-[0_0_12px_var(--tone-info-glow)]" />
              </motion.div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-xl font-bold tracking-tight text-foreground group-hover:text-primary transition-colors duration-300">{item.name}</h3>
                  <Badge variant="outline" className={cn("rounded-full px-3 py-1 font-medium shadow-sm", getTransferStatusTone(item.status))}>
                    {getTransferStatusLabel(item.status, text)}
                  </Badge>
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] font-medium text-muted-foreground/90">
                  <Badge variant="outline" className="rounded-full border-border/60 bg-secondary/60 px-2.5 py-0.5 text-muted-foreground group-hover:border-primary/30 group-hover:bg-primary/5 transition-colors">
                    <DirectionIcon className="mr-1 h-3.5 w-3.5" />
                    {getTransferDirectionLabel(item.direction, text)}
                  </Badge>
                  <Badge variant="outline" className="rounded-full border-border/60 bg-secondary/60 px-2.5 py-0.5 text-muted-foreground group-hover:border-primary/30 group-hover:bg-primary/5 transition-colors">
                    <SourceIcon className="mr-1 h-3.5 w-3.5" />
                    {getTransferSourceLabel(item.sourceKind, text)}
                  </Badge>
                  <span className="flex items-center text-foreground/80">{getTransferPhaseLabel(item.phase, text)}</span>
                  <span className="text-muted-foreground/40">|</span>
                  <span>{getTransferStartedLabel(item)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 lg:shrink-0 lg:flex-col lg:items-end lg:gap-1">
            <div className="text-right">
              <motion.div 
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="font-mono text-3xl font-bold tracking-tighter text-foreground"
              >
                {item.progress.percent}%
              </motion.div>
              <div className="text-[13px] font-medium text-muted-foreground">{getTransferProgressLabel(item)}</div>
            </div>
            <Button variant="ghost" size="sm" className="hidden h-8 rounded-full bg-primary/5 hover:bg-primary/10 lg:flex group-hover:bg-primary/20" onClick={() => onOpenDetail(item.id)}>
              {text.openDetail}
              <ArrowRight className="ml-1.5 h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </Button>
          </div>
        </div>

        <ProgressRail percent={item.progress.percent} />

        <div className="grid gap-3 text-sm font-medium lg:grid-cols-2">
          <motion.div 
            whileHover={{ x: 3 }}
            className="flex items-center gap-2 rounded-2xl border border-border/50 bg-secondary/30 px-4 py-3 text-foreground/90 group-hover:bg-secondary/40 transition-colors"
          >
            <span className="text-muted-foreground">{text.itemCount}:</span>
            {getTransferCountsLabel(item, text)}
          </motion.div>
          <motion.div 
            whileHover={{ x: 3 }}
            className="flex items-center gap-2 rounded-2xl border border-border/50 bg-secondary/30 px-4 py-3 text-foreground/90 group-hover:bg-secondary/40 transition-colors"
          >
            <span className="text-muted-foreground">{text.totalSize}:</span>
            {item.totalSize > 0 ? formatFileSize(item.totalSize) : "—"}
          </motion.div>
        </div>

        {item.previewItems.length > 0 ? (
          <div className="rounded-[22px] border border-border/50 bg-[var(--surface-overlay-soft)] p-4 transition-colors group-hover:bg-[var(--surface-overlay-medium)]">
            <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70">
              <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse" />
              {text.recentItems}
            </div>
            <div className="grid gap-2.5">
              {item.previewItems.slice(0, 4).map((preview) => (
                <motion.div 
                  key={preview.id} 
                  whileHover={{ x: 4 }}
                  className="flex items-center justify-between gap-4 rounded-xl border border-border/40 bg-background/40 px-3.5 py-2.5 transition-colors hover:bg-[var(--tone-info-bg)]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-foreground/90">{preview.relativePath || preview.name}</p>
                    <p className={cn("mt-0.5 text-xs", preview.error?.trim() ? semanticToneClasses.error.text : "text-muted-foreground")}>
                      {preview.percent}% · {preview.error?.trim() || text.noIssues}
                    </p>
                  </div>
                  <Badge variant="outline" className="shrink-0 rounded-full border-border/50 bg-background/50 px-2 py-0 text-[10px] font-bold uppercase">
                    {preview.status}
                  </Badge>
                </motion.div>
              ))}
            </div>
          </div>
        ) : null}
        
        <Button variant="ghost" size="sm" className="w-full rounded-full bg-primary/5 py-5 text-sm font-semibold lg:hidden group-hover:bg-primary/10" onClick={() => onOpenDetail(item.id)}>
          {text.openDetail}
          <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Button>
      </div>
    </motion.article>
  )
}
