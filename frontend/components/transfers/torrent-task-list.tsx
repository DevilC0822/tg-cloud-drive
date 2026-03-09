import { DatabaseZap, Loader2, Radio, ShieldCheck, TriangleAlert } from "lucide-react"
import { AnimatePresence } from "framer-motion"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TorrentTaskCard } from "@/components/transfers/torrent-task-card"
import { TransferEmptyState } from "@/components/transfers/transfer-empty-state"
import { TransferSkeleton } from "@/components/transfers/transfer-skeleton"
import type { TorrentTaskPagination, TorrentTaskQuery, TorrentTaskStatus, TorrentTaskSummary } from "@/lib/torrent-api"
import type { transferMessages } from "@/lib/i18n"

const PAGE_SIZES = [12, 24, 48]

interface TorrentTaskListProps {
  items: TorrentTaskSummary[]
  query: TorrentTaskQuery
  pagination: TorrentTaskPagination
  initialLoading: boolean
  refreshing: boolean
  text: (typeof transferMessages)["en"]
  onChangeStatus: (status: TorrentTaskStatus | "all") => void
  onChangePage: (page: number) => void
  onChangePageSize: (pageSize: number) => void
  onOpenDetail: (id: string) => void
  onDelete: (id: string) => void
}

function countActive(items: TorrentTaskSummary[]) {
  return items.filter((item) => item.status !== "completed" && item.status !== "error").length
}

function countCompleted(items: TorrentTaskSummary[]) {
  return items.filter((item) => item.status === "completed").length
}

function countNeedsCleanup(items: TorrentTaskSummary[]) {
  return items.filter((item) => !item.sourceCleanupDone).length
}

function statusLabel(status: TorrentTaskStatus | "all", text: (typeof transferMessages)["en"]) {
  if (status === "all") return text.all
  if (status === "queued") return text.torrentStatusQueued
  if (status === "downloading") return text.torrentStatusDownloading
  if (status === "awaiting_selection") return text.torrentStatusAwaitingSelection
  if (status === "uploading") return text.torrentStatusUploading
  if (status === "completed") return text.torrentStatusCompleted
  return text.torrentStatusError
}

function SummaryTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Radio
  label: string
  value: string
}) {
  return (
    <div className="rounded-[24px] border border-border/50 bg-secondary/20 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border/60 bg-background/45 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
          <p className="mt-1 text-xl font-bold tracking-tight text-foreground">{value}</p>
        </div>
      </div>
    </div>
  )
}

function TorrentSummaryGrid({ items, text }: { items: TorrentTaskSummary[]; text: (typeof transferMessages)["en"] }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <SummaryTile icon={DatabaseZap} label={text.torrentSummaryActive} value={text.torrentSummaryActiveValue(countActive(items))} />
      <SummaryTile icon={ShieldCheck} label={text.torrentSummaryCompleted} value={text.torrentSummaryCompletedValue(countCompleted(items))} />
      <SummaryTile icon={TriangleAlert} label={text.torrentSummaryCleanup} value={text.torrentSummaryCleanupValue(countNeedsCleanup(items))} />
    </div>
  )
}

function TorrentToolbar({
  query,
  text,
  onChangeStatus,
  onChangePageSize,
}: {
  query: TorrentTaskQuery
  text: (typeof transferMessages)["en"]
  onChangeStatus: (status: TorrentTaskStatus | "all") => void
  onChangePageSize: (pageSize: number) => void
}) {
  return (
    <div className="flex flex-col gap-3 rounded-[28px] border border-border/50 bg-secondary/15 p-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-2">
        <span className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{text.torrentFiltersStatus}</span>
        <Select value={query.status} onValueChange={(value) => onChangeStatus(value as TorrentTaskStatus | "all")}>
          <SelectTrigger size="sm" className="w-[180px] rounded-xl border-border/60 bg-background/40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="glass border-border/60">
            {(["all", "queued", "downloading", "awaiting_selection", "uploading", "completed", "error"] as const).map((value) => (
              <SelectItem key={value} value={value}>
                {statusLabel(value, text)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{text.pageSize}</span>
        <Select value={String(query.pageSize)} onValueChange={(value) => onChangePageSize(Number(value))}>
          <SelectTrigger size="sm" className="w-20 rounded-xl border-border/60 bg-background/40">
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
    </div>
  )
}

function TorrentPagination({
  pagination,
  text,
  onChangePage,
}: {
  pagination: TorrentTaskPagination
  text: (typeof transferMessages)["en"]
  onChangePage: (page: number) => void
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-border/50 pt-3 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>{pagination.page} / {Math.max(1, pagination.totalPages)}</span>
        <span>·</span>
        <span>{pagination.totalCount}</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="inline-flex h-8 items-center justify-center rounded-xl px-3 text-sm text-muted-foreground transition hover:bg-secondary/35 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          disabled={pagination.page <= 1}
          onClick={() => onChangePage(pagination.page - 1)}
        >
          {text.prevPage}
        </button>
        <button
          type="button"
          className="inline-flex h-8 items-center justify-center rounded-xl px-3 text-sm text-muted-foreground transition hover:bg-secondary/35 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          disabled={pagination.page >= pagination.totalPages}
          onClick={() => onChangePage(pagination.page + 1)}
        >
          {text.nextPage}
        </button>
      </div>
    </div>
  )
}

function TorrentTaskResults({
  items,
  initialLoading,
  text,
  onOpenDetail,
  onDelete,
}: {
  items: TorrentTaskSummary[]
  initialLoading: boolean
  text: (typeof transferMessages)["en"]
  onOpenDetail: (id: string) => void
  onDelete: (id: string) => void
}) {
  if (initialLoading) {
    return <TransferSkeleton count={4} />
  }
  if (items.length === 0) {
    return <TransferEmptyState icon={Radio} title={text.emptyTorrentTitle} description={text.emptyTorrentDescription} />
  }
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <AnimatePresence mode="popLayout" initial={false}>
        {items.map((item) => (
          <TorrentTaskCard key={item.id} item={item} text={text} onOpenDetail={onOpenDetail} onDelete={onDelete} />
        ))}
      </AnimatePresence>
    </div>
  )
}

export function TorrentTaskList({
  items,
  query,
  pagination,
  initialLoading,
  refreshing,
  text,
  onChangeStatus,
  onChangePage,
  onChangePageSize,
  onOpenDetail,
  onDelete,
}: TorrentTaskListProps) {
  return (
    <section className="space-y-6">
      <div className="rounded-[32px] border border-border/60 bg-gradient-to-br from-secondary/35 via-secondary/15 to-background/80 p-6">
        <div className="flex flex-col gap-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-[13px] font-bold uppercase tracking-[0.2em] text-primary/80">{text.torrentArchiveTitle}</h2>
              <p className="mt-2 max-w-2xl text-sm font-medium text-muted-foreground md:text-base">{text.torrentArchiveSubtitle}</p>
            </div>
            {refreshing ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-secondary/35 px-3 py-1 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {text.syncing}
              </div>
            ) : null}
          </div>

          <TorrentSummaryGrid items={items} text={text} />
        </div>
      </div>

      <TorrentToolbar query={query} text={text} onChangeStatus={onChangeStatus} onChangePageSize={onChangePageSize} />
      <TorrentTaskResults items={items} initialLoading={initialLoading} text={text} onOpenDetail={onOpenDetail} onDelete={onDelete} />
      <TorrentPagination pagination={pagination} text={text} onChangePage={onChangePage} />
    </section>
  )
}
