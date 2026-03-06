import { motion } from "framer-motion"
import { Trash2, ArrowRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { TransferJobSummary } from "@/lib/transfers-api"
import type { transferMessages } from "@/lib/i18n"
import { formatFileSize } from "@/lib/files"
import { semanticToneClasses } from "@/lib/palette"
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
  const errorTone = semanticToneClasses.error

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0, scale: 0.95, filter: "blur(8px)" }}
      whileHover={{ 
        scale: 1.02, 
        y: -4,
      }}
      transition={{ 
        layout: { duration: 0.3 },
        default: { type: "spring", stiffness: 400, damping: 25 }
      }}
      className="group relative bg-secondary/25 rounded-3xl p-5 border border-border/50 hover:border-primary/30 hover:bg-secondary/50 transition-all duration-300 cursor-pointer overflow-hidden shadow-sm hover:shadow-xl hover:shadow-primary/5"
    >

      <div className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-lg font-bold tracking-tight text-foreground group-hover:text-primary transition-colors duration-300">{item.name}</h3>
              <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider shadow-sm", getTransferStatusTone(item.status))}>
                {getTransferStatusLabel(item.status, text)}
              </Badge>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] font-medium text-muted-foreground/90">
              <Badge variant="outline" className="rounded-full border-border/60 bg-secondary/40 px-2 py-0 text-muted-foreground group-hover:border-primary/30 group-hover:bg-primary/5 transition-colors">
                <DirectionIcon className="mr-1 h-3 w-3" />
                {getTransferDirectionLabel(item.direction, text)}
              </Badge>
              <Badge variant="outline" className="rounded-full border-border/60 bg-secondary/40 px-2 py-0 text-muted-foreground group-hover:border-primary/30 group-hover:bg-primary/5 transition-colors">
                <SourceIcon className="mr-1 h-3 w-3" />
                {getTransferSourceLabel(item.sourceKind, text)}
              </Badge>
              <span className="text-foreground/70">{getTransferPhaseLabel(item.phase, text)}</span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <Button variant="ghost" size="sm" className="h-8 rounded-full bg-primary/5 px-3 text-xs font-bold hover:bg-primary/10 group-hover:bg-primary/20" onClick={() => onOpenDetail(item.id)}>
              {text.openDetail}
              <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive" onClick={() => onDelete(item.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid gap-2.5 text-[13px] font-medium md:grid-cols-2">
          <motion.div whileHover={{ x: 3 }} className="flex items-center gap-2 rounded-2xl border border-border/40 bg-secondary/20 px-3.5 py-2.5 text-foreground/80 group-hover:bg-secondary/30 transition-colors">
            <span className="text-muted-foreground/70">{text.itemCount}:</span>
            {getTransferCountsLabel(item, text)}
          </motion.div>
          <motion.div whileHover={{ x: 3 }} className="flex items-center gap-2 rounded-2xl border border-border/40 bg-secondary/20 px-3.5 py-2.5 text-foreground/80 group-hover:bg-secondary/30 transition-colors">
            <span className="text-muted-foreground/70">{text.totalSize}:</span>
            {item.totalSize > 0 ? formatFileSize(item.totalSize) : "—"}
          </motion.div>
          <motion.div whileHover={{ x: 3 }} className="flex items-center gap-2 rounded-2xl border border-border/40 bg-secondary/20 px-3.5 py-2.5 text-foreground/80 group-hover:bg-secondary/30 transition-colors">
            <span className="text-muted-foreground/70">{text.startedAt}:</span>
            {getTransferStartedLabel(item)}
          </motion.div>
          <motion.div whileHover={{ x: 3 }} className="flex items-center gap-2 rounded-2xl border border-border/40 bg-secondary/20 px-3.5 py-2.5 text-foreground/80 group-hover:bg-secondary/30 transition-colors">
            <span className="text-muted-foreground/70">{text.updatedAt}:</span>
            {getTransferUpdatedLabel(item)}
          </motion.div>
        </div>

        {item.lastError ? (
          <div className={cn("rounded-2xl border px-4 py-3 text-[13px] leading-relaxed", errorTone.border, errorTone.bg, errorTone.text)}>
            <span className="font-bold uppercase tracking-wider opacity-70">{text.lastError}: </span>
            {item.lastError}
          </div>
        ) : null}
      </div>
      
      {/* Background flare on hover */}
      <div className="absolute -inset-24 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
    </motion.article>
  )
}
