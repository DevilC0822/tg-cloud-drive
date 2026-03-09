import { motion } from "framer-motion"
import { ArrowRight, Radio, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import type { TorrentTaskSummary } from "@/lib/torrent-api"
import type { transferMessages } from "@/lib/i18n"
import { formatFileSize, formatRelativeTime } from "@/lib/files"
import { cn } from "@/lib/utils"
import {
  getTorrentCleanupPolicyLabel,
  getTorrentCleanupStateLabel,
  getTorrentSourceIcon,
  getTorrentSourceLabel,
  getTorrentTaskStatusIcon,
  getTorrentTaskStatusLabel,
  getTorrentTaskStatusTone,
} from "@/components/transfers/torrent-task-presenters"

interface TorrentTaskCardProps {
  item: TorrentTaskSummary
  text: (typeof transferMessages)["en"]
  onOpenDetail: (id: string) => void
  onDelete: (id: string) => void
}

function formatTaskProgress(item: TorrentTaskSummary) {
  const total = item.estimatedSize
  if (total <= 0) {
    return "—"
  }
  return `${formatFileSize(item.downloadedBytes)} / ${formatFileSize(total)}`
}

function TaskCardHeader({
  item,
  text,
  onOpenDetail,
  onDelete,
}: TorrentTaskCardProps) {
  const StatusIcon = getTorrentTaskStatusIcon(item.status)
  const SourceIcon = getTorrentSourceIcon(item.sourceType)

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border/60 bg-background/45 text-primary">
            <Radio className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-lg font-bold tracking-tight text-foreground">{item.torrentName}</h3>
            <p className="mt-1 truncate text-[13px] text-muted-foreground">{item.infoHash}</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider", getTorrentTaskStatusTone(item.status))}>
            <StatusIcon className="mr-1 h-3 w-3" />
            {getTorrentTaskStatusLabel(item.status, text)}
          </Badge>
          <Badge variant="outline" className="rounded-full border-border/60 bg-secondary/40 px-2 py-0 text-muted-foreground">
            <SourceIcon className="mr-1 h-3 w-3" />
            {getTorrentSourceLabel(item.sourceType, text)}
          </Badge>
          <Badge variant="outline" className="rounded-full border-border/60 bg-secondary/40 px-2 py-0 text-muted-foreground">
            {getTorrentCleanupPolicyLabel(item.sourceCleanupPolicy, text)}
          </Badge>
          <span className="text-[13px] font-medium text-muted-foreground">{getTorrentCleanupStateLabel(item, text)}</span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <Button variant="ghost" size="sm" className="h-8 rounded-full bg-primary/5 px-3 text-xs font-bold hover:bg-primary/10" onClick={() => onOpenDetail(item.id)}>
          {text.openDetail}
          <ArrowRight className="ml-1 h-3 w-3" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground/70 hover:bg-destructive/10 hover:text-destructive" onClick={() => onDelete(item.id)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function TaskCardProgress({ item, text }: { item: TorrentTaskSummary; text: (typeof transferMessages)["en"] }) {
  const percent = Math.max(0, Math.min(100, Math.round(item.progress)))

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[13px] font-medium text-muted-foreground">
        <span>{text.torrentProgress}</span>
        <span className="font-mono text-foreground">{percent}%</span>
      </div>
      <Progress value={percent} className="h-2.5 bg-primary/10" />
      <p className="text-[13px] text-muted-foreground">{formatTaskProgress(item)}</p>
    </div>
  )
}

function TaskCardMeta({ item, text }: { item: TorrentTaskSummary; text: (typeof transferMessages)["en"] }) {
  return (
    <div className="grid gap-2.5 text-[13px] font-medium md:grid-cols-2">
      <div className="rounded-2xl border border-border/40 bg-secondary/15 px-3.5 py-2.5 text-foreground/80">
        <span className="text-muted-foreground/75">{text.totalSize}:</span> {item.estimatedSize > 0 ? formatFileSize(item.estimatedSize) : "—"}
      </div>
      <div className="rounded-2xl border border-border/40 bg-secondary/15 px-3.5 py-2.5 text-foreground/80">
        <span className="text-muted-foreground/75">{text.trackerHosts}:</span> {item.trackerHosts.length}
      </div>
      <div className="rounded-2xl border border-border/40 bg-secondary/15 px-3.5 py-2.5 text-foreground/80">
        <span className="text-muted-foreground/75">{text.createdAt}:</span> {formatRelativeTime(item.createdAt)}
      </div>
      <div className="rounded-2xl border border-border/40 bg-secondary/15 px-3.5 py-2.5 text-foreground/80">
        <span className="text-muted-foreground/75">{text.updatedAt}:</span> {formatRelativeTime(item.updatedAt)}
      </div>
    </div>
  )
}

function TaskCardError({ item, text }: { item: TorrentTaskSummary; text: (typeof transferMessages)["en"] }) {
  if (!item.error) {
    return null
  }

  return (
    <div className="rounded-2xl border border-[var(--semantic-error-border)] bg-[var(--semantic-error-bg)] px-4 py-3 text-[13px] text-[var(--semantic-error-text)]">
      <span className="font-bold uppercase tracking-wider opacity-70">{text.lastError}: </span>
      {item.error}
    </div>
  )
}

export function TorrentTaskCard({ item, text, onOpenDetail, onDelete }: TorrentTaskCardProps) {
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0, scale: 0.95, filter: "blur(8px)" }}
      whileHover={{ scale: 1.01, y: -4 }}
      transition={{
        layout: { duration: 0.25 },
        default: { type: "spring", stiffness: 360, damping: 28 },
      }}
      className="group relative overflow-hidden rounded-[28px] border border-border/50 bg-secondary/20 p-5 shadow-sm transition-all duration-300 hover:border-primary/25 hover:bg-secondary/35 hover:shadow-xl hover:shadow-primary/5"
    >
      <div className="absolute -right-12 -top-16 h-36 w-36 rounded-full bg-primary/8 blur-3xl opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      <div className="relative flex flex-col gap-5">
        <TaskCardHeader item={item} text={text} onOpenDetail={onOpenDetail} onDelete={onDelete} />
        <TaskCardProgress item={item} text={text} />
        <TaskCardMeta item={item} text={text} />
        <TaskCardError item={item} text={text} />
      </div>
    </motion.article>
  )
}
