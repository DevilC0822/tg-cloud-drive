import { FileStack, RadioTower, Rows3, Server } from "lucide-react"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { TransferFolderTree } from "@/components/transfers/transfer-folder-tree"
import { TransferPhaseStepper } from "@/components/transfers/transfer-phase-stepper"
import { useIsMobile } from "@/hooks/use-mobile"
import type { TransferJobDetail, TransferUploadSessionItem } from "@/lib/transfers-api"
import type { transferMessages } from "@/lib/i18n"
import { formatFileSize, formatRelativeTime } from "@/lib/files"
import { semanticToneClasses } from "@/lib/palette"
import {
  formatTransferPhaseElapsed,
  getTransferDirectionLabel,
  getTransferPhaseDetailLabel,
  getTransferPhaseLabel,
  getTransferPhaseProgressLabel,
  getTransferPhaseProgressMode,
  getTransferPhaseProgressPercent,
  getTransferProgressLabel,
  getTransferSourceLabel,
  getTransferStatusLabel,
  getTransferStatusTone,
} from "@/components/transfers/transfer-presenters"
import { cn } from "@/lib/utils"

interface TransferDetailSheetProps {
  open: boolean
  loading: boolean
  detail: TransferJobDetail | null
  text: (typeof transferMessages)["en"]
  onOpenChange: (open: boolean) => void
}

function DetailProgress({ percent, indeterminate }: { percent: number | null; indeterminate?: boolean }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-[0.24em] text-muted-foreground">progress</span>
        <span className="font-mono text-sm text-foreground">{indeterminate || percent == null ? "—" : `${percent}%`}</span>
      </div>
      <div className="relative">
        <Progress value={indeterminate ? 36 : percent ?? 0} className="h-2.5 bg-primary/12" />
        {indeterminate ? (
          <div className="pointer-events-none absolute inset-y-0 left-0 w-[42%] animate-pulse rounded-full bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        ) : null}
      </div>
    </div>
  )
}

function SessionRow({ item }: { item: TransferUploadSessionItem }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-secondary/20 px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{item.fileName}</p>
          <p className="text-xs text-muted-foreground">
            {item.uploadedCount}/{item.totalChunks} · {formatFileSize(item.fileSize)}
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-sm text-foreground">{item.progress.percent}%</p>
          <p className="text-xs text-muted-foreground">{formatRelativeTime(item.updatedAt)}</p>
        </div>
      </div>
    </div>
  )
}

function DetailBody({ detail, text }: { detail: TransferJobDetail; text: (typeof transferMessages)["en"] }) {
  const item = detail.item
  const errorTone = semanticToneClasses.error
  const phaseDetailLabel = getTransferPhaseDetailLabel(item.phaseDetail, text)
  const phaseMode = getTransferPhaseProgressMode(item)
  const phasePercent = getTransferPhaseProgressPercent(item)
  const phaseProgressLabel = getTransferPhaseProgressLabel(item, text)
  const phaseElapsed = formatTransferPhaseElapsed(item.phaseStartedAt)
  const showStepper = item.sourceKind === "upload_session" && (item.phaseSteps?.length ?? 0) > 1

  return (
    <ScrollArea className="h-full">
      <div className="space-y-5 p-4">
        <div className="rounded-[28px] border border-border/60 bg-secondary/15 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn("rounded-full px-2.5 py-1", getTransferStatusTone(item.status))}>
              {getTransferStatusLabel(item.status, text)}
            </Badge>
            <Badge variant="outline" className="rounded-full border-border/50 bg-secondary/25 text-muted-foreground">
              {getTransferDirectionLabel(item.direction, text)}
            </Badge>
            <Badge variant="outline" className="rounded-full border-border/50 bg-secondary/25 text-muted-foreground">
              {getTransferSourceLabel(item.sourceKind, text)}
            </Badge>
            <Badge variant="outline" className="rounded-full border-border/50 bg-secondary/25 text-muted-foreground">
              {getTransferPhaseLabel(item.phase, text)}
            </Badge>
          </div>

          <h3 className="mt-3 text-xl font-semibold text-foreground">{item.name}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{phaseProgressLabel}</p>
          <div className="mt-4">
            <DetailProgress percent={phasePercent} indeterminate={phaseMode === "indeterminate"} />
          </div>

          {showStepper ? (
            <div className="mt-4">
              <TransferPhaseStepper
                steps={item.phaseSteps}
                currentStep={item.phaseDetail}
                status={item.status}
                text={text}
              />
            </div>
          ) : null}

          <div className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            <div className="rounded-2xl border border-border/50 bg-background/30 px-3 py-2.5">{text.totalSize}: {item.totalSize > 0 ? formatFileSize(item.totalSize) : "—"}</div>
            <div className="rounded-2xl border border-border/50 bg-background/30 px-3 py-2.5">{text.itemCount}: {item.itemCount}</div>
            <div className="rounded-2xl border border-border/50 bg-background/30 px-3 py-2.5">{text.startedAt}: {formatRelativeTime(item.startedAt)}</div>
            <div className="rounded-2xl border border-border/50 bg-background/30 px-3 py-2.5">{text.updatedAt}: {formatRelativeTime(item.updatedAt)}</div>
            {phaseDetailLabel ? (
              <div className="rounded-2xl border border-border/50 bg-background/30 px-3 py-2.5">{text.currentStage}: {phaseDetailLabel}</div>
            ) : null}
            {phaseMode === "indeterminate" && item.phaseStartedAt ? (
              <div className="rounded-2xl border border-border/50 bg-background/30 px-3 py-2.5">{text.stageElapsed}: {phaseElapsed}</div>
            ) : null}
          </div>

          <div className="mt-4 rounded-2xl border border-border/50 bg-background/30 px-3 py-2.5 text-sm text-muted-foreground">
            {text.lastError}: {item.lastError?.trim() || text.noIssues}
          </div>
        </div>

        {detail.uploadSession ? (
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Rows3 className="h-4 w-4 text-primary" />
              {text.sessionDetail}
            </div>
            <SessionRow item={detail.uploadSession.session} />
            <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              <div className="rounded-2xl border border-border/50 bg-secondary/15 px-3 py-2.5">
                {text.uploadedChunks}: {detail.uploadSession.uploadedChunks.join(", ") || "—"}
              </div>
              <div className="rounded-2xl border border-border/50 bg-secondary/15 px-3 py-2.5">
                {text.missingChunks}: {detail.uploadSession.missingChunks.join(", ") || "—"}
              </div>
            </div>
          </section>
        ) : null}

        {detail.uploadBatch ? (
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <FileStack className="h-4 w-4 text-primary" />
              {text.batchDetail}
            </div>
            <div className="grid gap-2">
              {detail.uploadBatch.sessions.map((session) => (
                <SessionRow key={session.id} item={session} />
              ))}
            </div>
          </section>
        ) : null}

        {detail.folderUpload ? (
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <FileStack className="h-4 w-4 text-primary" />
              {text.folderDetail}
            </div>
            <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              <div className="rounded-2xl border border-border/50 bg-secondary/15 px-3 py-2.5">{text.rootFolder}: {detail.folderUpload.rootName}</div>
              <div className="rounded-2xl border border-border/50 bg-secondary/15 px-3 py-2.5">{text.directoryCount}: {detail.folderUpload.directoryCount}</div>
              <div className="rounded-2xl border border-border/50 bg-secondary/15 px-3 py-2.5">{text.itemCount}: {detail.folderUpload.fileCount}</div>
              <div className="rounded-2xl border border-border/50 bg-secondary/15 px-3 py-2.5">{text.uploaded}: {detail.folderUpload.completedCount}</div>
              <div className="rounded-2xl border border-border/50 bg-secondary/15 px-3 py-2.5">{text.failed}: {detail.folderUpload.failedCount}</div>
              <div className="rounded-2xl border border-border/50 bg-secondary/15 px-3 py-2.5">{text.activeFiles}: {detail.folderUpload.activeCount}</div>
            </div>
            <div className="rounded-[24px] border border-border/50 bg-secondary/10 p-3">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                <FileStack className="h-4 w-4 text-primary" />
                {text.folderEntries}
              </div>
              <TransferFolderTree transferId={detail.item.id} refreshKey={detail.item.updatedAt} text={text} />
            </div>
          </section>
        ) : null}

        {detail.torrentTask ? (
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <RadioTower className="h-4 w-4 text-primary" />
              {text.torrentDetail}
            </div>
            <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              <div className="rounded-2xl border border-border/50 bg-secondary/15 px-3 py-2.5">{text.selectedFiles}: {detail.torrentTask.files.filter((file) => file.selected).length}</div>
              <div className="rounded-2xl border border-border/50 bg-secondary/15 px-3 py-2.5">{text.trackerHosts}: {detail.torrentTask.trackerHosts.join(", ") || "—"}</div>
            </div>
            <div className="grid gap-2">
              {detail.torrentTask.files.filter((file) => file.selected).map((file) => (
                <div key={`${detail.torrentTask!.id}-${file.fileIndex}`} className="rounded-2xl border border-border/50 bg-secondary/15 px-3 py-2.5 text-sm">
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
                  {file.error ? <p className={cn("mt-2 text-xs", errorTone.text)}>{file.error}</p> : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {detail.downloadTask ? (
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Server className="h-4 w-4 text-primary" />
              {text.downloadDetail}
            </div>
            <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              <div className="rounded-2xl border border-border/50 bg-secondary/15 px-3 py-2.5">{text.targetFile}: {detail.downloadTask.fileName}</div>
              <div className="rounded-2xl border border-border/50 bg-secondary/15 px-3 py-2.5">{text.totalSize}: {getTransferProgressLabel({ ...item, progress: detail.downloadTask.progress })}</div>
            </div>
          </section>
        ) : null}
      </div>
    </ScrollArea>
  )
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

export function TransferDetailSheet({ open, loading, detail, text, onOpenChange }: TransferDetailSheetProps) {
  const isMobile = useIsMobile()
  const title = detail?.item.name || text.detailTitle
  const description = detail ? text.detailSubtitle : text.detailTitle

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
