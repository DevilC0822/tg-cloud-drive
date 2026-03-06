import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { TransferHistoryQuery } from "@/lib/transfers-api"
import type { transferMessages } from "@/lib/i18n"

interface HistoryFilterBarProps {
  query: TransferHistoryQuery
  text: (typeof transferMessages)["en"]
  onChange: (patch: Partial<TransferHistoryQuery>) => void
}

export function HistoryFilterBar({ query, text, onChange }: HistoryFilterBarProps) {
  return (
    <div className="glass-card rounded-[28px] border border-border/60 p-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.1fr_0.75fr_0.75fr_1.4fr]">
        <Select value={query.direction} onValueChange={(value) => onChange({ direction: value as TransferHistoryQuery["direction"] })}>
          <SelectTrigger className="w-full rounded-2xl border-border/60 bg-secondary/30">
            <SelectValue placeholder={text.filtersDirection} />
          </SelectTrigger>
          <SelectContent className="glass border-border/60">
            <SelectItem value="all">{text.all}</SelectItem>
            <SelectItem value="upload">{text.directionUpload}</SelectItem>
            <SelectItem value="download">{text.directionDownload}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={query.status} onValueChange={(value) => onChange({ status: value as TransferHistoryQuery["status"] })}>
          <SelectTrigger className="w-full rounded-2xl border-border/60 bg-secondary/30">
            <SelectValue placeholder={text.filtersStatus} />
          </SelectTrigger>
          <SelectContent className="glass border-border/60">
            <SelectItem value="all">{text.all}</SelectItem>
            <SelectItem value="completed">{text.statusCompleted}</SelectItem>
            <SelectItem value="error">{text.statusError}</SelectItem>
            <SelectItem value="canceled">{text.statusCanceled}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={query.sourceKind} onValueChange={(value) => onChange({ sourceKind: value as TransferHistoryQuery["sourceKind"] })}>
          <SelectTrigger className="w-full rounded-2xl border-border/60 bg-secondary/30">
            <SelectValue placeholder={text.filtersSource} />
          </SelectTrigger>
          <SelectContent className="glass border-border/60">
            <SelectItem value="all">{text.all}</SelectItem>
            <SelectItem value="upload_session">{text.sourceUploadSession}</SelectItem>
            <SelectItem value="upload_batch">{text.sourceUploadBatch}</SelectItem>
            <SelectItem value="torrent_task">{text.sourceTorrentTask}</SelectItem>
            <SelectItem value="download_task">{text.sourceDownloadTask}</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query.q}
            onChange={(event) => onChange({ q: event.target.value })}
            placeholder={text.filtersSearchPlaceholder}
            className="rounded-2xl border-border/60 bg-secondary/30 pl-9"
          />
        </div>
      </div>
    </div>
  )
}
