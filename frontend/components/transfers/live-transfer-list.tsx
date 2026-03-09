import { Loader2, Radar } from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import { LiveTransferCard } from "@/components/transfers/live-transfer-card"
import { TransferEmptyState } from "@/components/transfers/transfer-empty-state"
import { TransferSkeleton } from "@/components/transfers/transfer-skeleton"
import type { TransferJobSummary } from "@/lib/transfers-api"
import type { transferMessages } from "@/lib/i18n"

interface LiveTransferListProps {
  items: TransferJobSummary[]
  initialLoading: boolean
  refreshing: boolean
  text: (typeof transferMessages)["en"]
  onOpenDetail: (id: string) => void
  onDelete: (id: string) => void
}

export function LiveTransferList({ items, initialLoading, refreshing, text, onOpenDetail, onDelete }: LiveTransferListProps) {
  return (
    <section className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-[13px] font-bold uppercase tracking-[0.2em] text-primary/80 dark:text-primary/70">{text.liveTitle}</h2>
          <p className="mt-2 text-sm font-medium text-muted-foreground md:text-base">{text.liveSubtitle}</p>
        </div>
        {refreshing ? (
          <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-secondary/35 px-3 py-1 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {text.syncing}
          </div>
        ) : null}
      </div>

      {initialLoading ? <TransferSkeleton count={3} /> : null}
      {!initialLoading && items.length === 0 ? (
        <TransferEmptyState icon={Radar} title={text.emptyLiveTitle} description={text.emptyLiveDescription} />
      ) : null}
      {!initialLoading && items.length > 0 ? (
        <div className="grid gap-4">
          <AnimatePresence mode="popLayout" initial={false}>
            {items.map((item) => (
              <LiveTransferCard key={item.id} item={item} text={text} onOpenDetail={onOpenDetail} onDelete={onDelete} />
            ))}
          </AnimatePresence>
        </div>
      ) : null}
    </section>
  )
}
