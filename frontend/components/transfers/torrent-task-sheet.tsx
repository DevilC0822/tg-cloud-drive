import { Rows3, ShieldCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { useIsMobile } from "@/hooks/use-mobile"
import type { TorrentTaskDetail } from "@/lib/torrent-api"
import type { transferMessages } from "@/lib/i18n"
import { formatFileSize, formatRelativeTime } from "@/lib/files"
import { cn } from "@/lib/utils"
import {
  countFailedFiles,
  countSelectedFiles,
  countUploadedFiles,
  getTorrentCleanupPolicyLabel,
  getTorrentCleanupStateLabel,
  getTorrentSourceLabel,
  getTorrentTaskStatusLabel,
  getTorrentTaskStatusTone,
} from "@/components/transfers/torrent-task-presenters"

interface TorrentTaskSheetProps {
  open: boolean
  loading: boolean
  detail: TorrentTaskDetail | null
  text: (typeof transferMessages)["en"]
  onOpenChange: (open: boolean) => void
}

function DetailLoading() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-32 rounded-[28px]" />
      <Skeleton className="h-24 rounded-[24px]" />
      <Skeleton className="h-24 rounded-[24px]" />
    </div>
  )
}

function TaskHeaderCard({ detail, text }: { detail: TorrentTaskDetail; text: (typeof transferMessages)["en"] }) {
  const percent = Math.max(0, Math.min(100, Math.round(detail.progress)))

  return (
    <div className="rounded-[28px] border border-border/60 bg-secondary/15 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={cn("rounded-full px-2.5 py-1", getTorrentTaskStatusTone(detail.status))}>
          {getTorrentTaskStatusLabel(detail.status, text)}
        </Badge>
        <Badge variant="outline" className="rounded-full border-border/50 bg-secondary/25 text-muted-foreground">
          {getTorrentSourceLabel(detail.sourceType, text)}
        </Badge>
        <Badge variant="outline" className="rounded-full border-border/50 bg-secondary/25 text-muted-foreground">
          {getTorrentCleanupPolicyLabel(detail.sourceCleanupPolicy, text)}
        </Badge>
      </div>

      <h3 className="mt-3 text-xl font-semibold text-foreground">{detail.torrentName}</h3>
      <p className="mt-1 break-all text-sm text-muted-foreground">{detail.infoHash}</p>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.24em] text-muted-foreground">
          <span>{text.torrentProgress}</span>
          <span className="font-mono text-sm text-foreground">{percent}%</span>
        </div>
        <Progress value={percent} className="h-2.5 bg-primary/12" />
        <p className="text-sm text-muted-foreground">
          {detail.estimatedSize > 0 ? `${formatFileSize(detail.downloadedBytes)} / ${formatFileSize(detail.estimatedSize)}` : "—"}
        </p>
      </div>

      <div className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
        <div className="rounded-2xl border border-border/50 bg-background/30 px-3 py-2.5">{text.totalSize}: {detail.estimatedSize > 0 ? formatFileSize(detail.estimatedSize) : "—"}</div>
        <div className="rounded-2xl border border-border/50 bg-background/30 px-3 py-2.5">{text.trackerHosts}: {detail.trackerHosts.join(", ") || "—"}</div>
        <div className="rounded-2xl border border-border/50 bg-background/30 px-3 py-2.5">{text.torrentCleanupState}: {getTorrentCleanupStateLabel(detail, text)}</div>
        <div className="rounded-2xl border border-border/50 bg-background/30 px-3 py-2.5">{text.dueAt}: {detail.dueAt ? formatRelativeTime(detail.dueAt) : "—"}</div>
        <div className="rounded-2xl border border-border/50 bg-background/30 px-3 py-2.5">{text.createdAt}: {formatRelativeTime(detail.createdAt)}</div>
        <div className="rounded-2xl border border-border/50 bg-background/30 px-3 py-2.5">{text.updatedAt}: {formatRelativeTime(detail.updatedAt)}</div>
      </div>

      {detail.sourceUrl ? (
        <div className="mt-4 rounded-2xl border border-border/50 bg-background/30 px-3 py-2.5 text-sm text-muted-foreground">
          {text.torrentSourceUrlLabel}: <span className="break-all text-foreground">{detail.sourceUrl}</span>
        </div>
      ) : null}

      {detail.error ? (
        <div className="mt-4 rounded-2xl border border-[var(--semantic-error-border)] bg-[var(--semantic-error-bg)] px-3 py-2.5 text-sm text-[var(--semantic-error-text)]">
          {text.lastError}: {detail.error}
        </div>
      ) : null}
    </div>
  )
}

function TaskOverviewSection({ detail, text }: { detail: TorrentTaskDetail; text: (typeof transferMessages)["en"] }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <ShieldCheck className="h-4 w-4 text-primary" />
        {text.torrentFileOverview}
      </div>
      <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
        <div className="rounded-2xl border border-border/50 bg-secondary/15 px-3 py-2.5">{text.selectedFiles}: {countSelectedFiles(detail)}</div>
        <div className="rounded-2xl border border-border/50 bg-secondary/15 px-3 py-2.5">{text.uploaded}: {countUploadedFiles(detail)}</div>
        <div className="rounded-2xl border border-border/50 bg-secondary/15 px-3 py-2.5">{text.failed}: {countFailedFiles(detail)}</div>
      </div>
    </section>
  )
}

function TaskFilesSection({ detail, text }: { detail: TorrentTaskDetail; text: (typeof transferMessages)["en"] }) {
  const selectedFiles = detail.files.filter((file) => file.selected)

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Rows3 className="h-4 w-4 text-primary" />
        {text.torrentDetail}
      </div>
      <div className="grid gap-2">
        {selectedFiles.map((file) => (
          <div key={`${detail.id}-${file.fileIndex}`} className="rounded-2xl border border-border/50 bg-secondary/15 px-3 py-2.5 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-foreground">{file.fileName}</p>
                <p className="truncate text-xs text-muted-foreground">{file.filePath}</p>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <p>{formatFileSize(file.fileSize)}</p>
                <p>{file.uploaded ? text.statusCompleted : file.error ? text.statusError : text.statusRunning}</p>
              </div>
            </div>
            {file.error ? <p className="mt-2 text-xs text-[var(--semantic-error-text)]">{file.error}</p> : null}
          </div>
        ))}
      </div>
    </section>
  )
}

function DetailBody({ detail, text }: { detail: TorrentTaskDetail; text: (typeof transferMessages)["en"] }) {
  return (
    <ScrollArea className="h-full">
      <div className="space-y-5 p-4">
        <TaskHeaderCard detail={detail} text={text} />
        <TaskOverviewSection detail={detail} text={text} />
        <TaskFilesSection detail={detail} text={text} />
      </div>
    </ScrollArea>
  )
}

export function TorrentTaskSheet({ open, loading, detail, text, onOpenChange }: TorrentTaskSheetProps) {
  const isMobile = useIsMobile()
  const title = detail?.torrentName || text.torrentDetailTitle
  const description = detail ? text.torrentDetailSubtitle : text.torrentDetailTitle

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="glass-card border-border/60 bg-background/95">
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription>{description}</DrawerDescription>
          </DrawerHeader>
          {loading || !detail ? <DetailLoading /> : <DetailBody detail={detail} text={text} />}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="glass-card w-full border-border/60 bg-background/95 p-0 sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        {loading || !detail ? <DetailLoading /> : <DetailBody detail={detail} text={text} />}
      </SheetContent>
    </Sheet>
  )
}
