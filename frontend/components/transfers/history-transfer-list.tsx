import { Archive } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { HistoryTransferCard } from "@/components/transfers/history-transfer-card"
import { HistoryFilterBar } from "@/components/transfers/history-filter-bar"
import { TransferEmptyState } from "@/components/transfers/transfer-empty-state"
import { TransferSkeleton } from "@/components/transfers/transfer-skeleton"
import type { TransferHistoryPagination, TransferHistoryQuery, TransferJobSummary } from "@/lib/transfers-api"
import type { transferMessages } from "@/lib/i18n"

const PAGE_SIZES = [12, 24, 48]

interface HistoryTransferListProps {
  items: TransferJobSummary[]
  query: TransferHistoryQuery
  pagination: TransferHistoryPagination
  loading: boolean
  text: (typeof transferMessages)["en"]
  onChangeFilters: (patch: Partial<TransferHistoryQuery>) => void
  onChangePage: (page: number) => void
  onChangePageSize: (pageSize: number) => void
  onOpenDetail: (id: string) => void
  onDelete: (id: string) => void
}

export function HistoryTransferList({
  items,
  query,
  pagination,
  loading,
  text,
  onChangeFilters,
  onChangePage,
  onChangePageSize,
  onOpenDetail,
  onDelete,
}: HistoryTransferListProps) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xs uppercase tracking-[0.34em] text-primary/80">{text.historyTitle}</h2>
        <p className="mt-2 text-sm text-muted-foreground md:text-base">{text.historySubtitle}</p>
      </div>

      <HistoryFilterBar query={query} text={text} onChange={onChangeFilters} />

      {loading ? <TransferSkeleton count={4} /> : null}
      {!loading && items.length === 0 ? (
        <TransferEmptyState icon={Archive} title={text.emptyHistoryTitle} description={text.emptyHistoryDescription} />
      ) : null}
      {!loading && items.length > 0 ? (
        <div className="grid gap-3 xl:grid-cols-2">
          {items.map((item) => (
            <HistoryTransferCard key={item.id} item={item} text={text} onOpenDetail={onOpenDetail} onDelete={onDelete} />
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 border-t border-border/50 pt-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{pagination.page} / {Math.max(1, pagination.totalPages)}</span>
          <span>·</span>
          <span>{pagination.totalCount}</span>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{text.pageSize}</span>
            <Select value={String(query.pageSize)} onValueChange={(value) => onChangePageSize(Number(value))}>
              <SelectTrigger size="sm" className="w-20 rounded-xl border-border/60 bg-secondary/35">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="glass border-border/60">
                {PAGE_SIZES.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" disabled={pagination.page <= 1} onClick={() => onChangePage(pagination.page - 1)}>
              {text.prevPage}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => onChangePage(pagination.page + 1)}
            >
              {text.nextPage}
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
