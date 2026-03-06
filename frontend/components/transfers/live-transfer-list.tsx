import { Radar } from "lucide-react"
import { LiveTransferCard } from "@/components/transfers/live-transfer-card"
import { TransferEmptyState } from "@/components/transfers/transfer-empty-state"
import { TransferSkeleton } from "@/components/transfers/transfer-skeleton"
import type { TransferJobSummary } from "@/lib/transfers-api"
import type { transferMessages } from "@/lib/i18n"

interface LiveTransferListProps {
  items: TransferJobSummary[]
  loading: boolean
  text: (typeof transferMessages)["en"]
  onOpenDetail: (id: string) => void
}

export function LiveTransferList({ items, loading, text, onOpenDetail }: LiveTransferListProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xs uppercase tracking-[0.34em] text-primary/80">{text.liveTitle}</h2>
          <p className="mt-2 text-sm text-muted-foreground md:text-base">{text.liveSubtitle}</p>
        </div>
      </div>

      {loading ? <TransferSkeleton count={3} /> : null}
      {!loading && items.length === 0 ? (
        <TransferEmptyState icon={Radar} title={text.emptyLiveTitle} description={text.emptyLiveDescription} />
      ) : null}
      {!loading && items.length > 0 ? (
        <div className="grid gap-3">
          {items.map((item) => (
            <LiveTransferCard key={item.id} item={item} text={text} onOpenDetail={onOpenDetail} />
          ))}
        </div>
      ) : null}
    </section>
  )
}
