import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import { AudioLines, Copy, FileQuestion, Loader2, PlayCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { formatFileSize } from "@/lib/files"
import { SUPPORTED_PREVIEW_FORMATS, type FilePreviewKind } from "@/lib/file-preview"
import type { FilePreviewMessages } from "@/lib/file-preview-i18n"
import type { FileItem } from "@/lib/files"
import type { TorrentPreview } from "@/lib/torrent-api"

interface TextPreviewPayload {
  content: string
  loading: boolean
  error: string
  truncated: boolean
}

interface FilePreviewContentProps {
  item: FileItem
  kind: FilePreviewKind
  contentUrl: string
  text: FilePreviewMessages
  textPreview: TextPreviewPayload
  textPreviewLimitBytes: number
  torrentPreviewData: TorrentPreview | null
  torrentLoading: boolean
  torrentError: string
}

function TextPreviewPanel({
  payload,
  maxBytes,
  text,
}: {
  payload: TextPreviewPayload
  maxBytes: number
  text: FilePreviewMessages
}) {
  const [copied, setCopied] = useState(false)

  const lines = useMemo(() => payload.content.split(/\r?\n/), [payload.content])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(payload.content)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {
      setCopied(false)
    }
  }

  if (payload.loading) {
    return (
      <div className="flex h-[56vh] items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        {text.textLoading}
      </div>
    )
  }

  if (payload.error) {
    return <p className="text-sm text-destructive">{payload.error}</p>
  }

  if (!payload.content.trim()) {
    return <p className="text-sm text-muted-foreground">{text.textEmpty}</p>
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {payload.truncated ? text.textTruncated(formatFileSize(maxBytes)) : null}
        </p>
        <Button size="sm" variant="outline" className="h-8" onClick={() => void handleCopy()}>
          <Copy className="h-3.5 w-3.5" />
          {copied ? text.textCopied : text.textCopy}
        </Button>
      </div>

      <ScrollArea className="h-[55vh] rounded-xl border border-border/60 bg-background/60 font-mono text-xs">
        <div className="min-w-[680px] p-4">
          {lines.map((line, index) => (
            <div key={`${index}-${line.length}`} className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-3 py-0.5 leading-relaxed">
              <span className="select-none text-right text-muted-foreground/75">{index + 1}</span>
              <span className="whitespace-pre-wrap break-words text-foreground/95">{line || " "}</span>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

function TorrentPreviewPanel({
  preview,
  loading,
  error,
  text,
}: {
  preview: TorrentPreview | null
  loading: boolean
  error: string
  text: FilePreviewMessages
}) {
  if (loading) {
    return (
      <div className="flex h-[56vh] items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        {text.torrentLoading}
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-destructive">{text.torrentError}: {error}</p>
  }

  if (!preview) {
    return <p className="text-sm text-muted-foreground">{text.torrentError}</p>
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-border/55 bg-secondary/45 p-3">
          <p className="text-xs text-muted-foreground">{text.torrentFiles(preview.files.length)}</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{preview.torrentName}</p>
        </div>
        <div className="rounded-xl border border-border/55 bg-secondary/45 p-3">
          <p className="text-xs text-muted-foreground">{text.torrentSize}</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{formatFileSize(preview.totalSize)}</p>
        </div>
        <div className="rounded-xl border border-border/55 bg-secondary/45 p-3">
          <p className="text-xs text-muted-foreground">{text.torrentTrackers(preview.trackerHosts.length)}</p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {preview.isPrivate ? text.torrentVisibilityPrivate : text.torrentVisibilityPublic}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border/55 bg-background/55 p-3">
        <p className="text-xs text-muted-foreground">{text.torrentInfoHash}</p>
        <p className="mt-1 break-all font-mono text-xs text-foreground/90">{preview.infoHash}</p>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <ScrollArea className="h-[42vh] rounded-xl border border-border/60 bg-background/55">
          <div className="space-y-1.5 p-3">
            {preview.files.map((file) => (
              <div key={file.fileIndex} className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-secondary/35 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground">{file.filePath}</p>
                  <p className="text-xs text-muted-foreground">#{file.fileIndex}</p>
                </div>
                <p className="shrink-0 text-xs text-muted-foreground">{formatFileSize(file.fileSize)}</p>
              </div>
            ))}
          </div>
        </ScrollArea>

        <ScrollArea className="h-[42vh] rounded-xl border border-border/60 bg-background/55">
          <div className="space-y-2 p-3">
            {preview.trackerHosts.map((tracker) => (
              <div key={tracker} className="rounded-lg border border-border/45 bg-secondary/35 px-3 py-2">
                <p className="break-all text-xs text-foreground/90">{tracker}</p>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}

function UnsupportedPanel({ text }: { text: FilePreviewMessages }) {
  const entries = Object.entries(SUPPORTED_PREVIEW_FORMATS)

  return (
    <div className="mx-auto max-w-3xl rounded-2xl border border-border/60 bg-secondary/45 p-6">
      <div className="mb-5 flex items-start gap-3">
        <div className="rounded-xl border border-border/60 bg-background/70 p-2.5">
          <FileQuestion className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">{text.unsupportedTitle}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{text.unsupportedDescription}</p>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">{text.supportedFormats}</p>
        <div className="grid gap-2 md:grid-cols-2">
          {entries.map(([group, formats]) => (
            <div key={group} className="rounded-lg border border-border/45 bg-background/60 px-3 py-2">
              <p className="mb-1 text-xs font-medium capitalize text-foreground">{group}</p>
              <p className="text-xs text-muted-foreground">{formats.join("  ")}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function FilePreviewContent({
  item,
  kind,
  contentUrl,
  text,
  textPreview,
  textPreviewLimitBytes,
  torrentPreviewData,
  torrentLoading,
  torrentError,
}: FilePreviewContentProps) {
  if (kind === "video") {
    return <video src={contentUrl} controls className="h-[62vh] w-full rounded-2xl border border-border/60 bg-[var(--overlay-backdrop)]" />
  }

  if (kind === "image" || kind === "gif") {
    return (
      <div className="flex h-[62vh] items-center justify-center rounded-2xl border border-border/60 bg-background/50 p-4">
        <motion.img
          src={contentUrl}
          alt={item.name}
          initial={{ opacity: 0.2, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="max-h-full max-w-full rounded-xl object-contain"
        />
      </div>
    )
  }

  if (kind === "audio") {
    return (
      <div className="flex h-[56vh] flex-col items-center justify-center gap-6 rounded-2xl border border-border/60 bg-gradient-to-br from-background via-secondary/35 to-background p-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-border/60 bg-primary/12">
          <AudioLines className="h-9 w-9 text-primary" />
        </div>
        <div className="text-center">
          <p className="text-sm text-muted-foreground">{item.name}</p>
        </div>
        <audio src={contentUrl} controls className="w-full max-w-xl" />
      </div>
    )
  }

  if (kind === "text") {
    return <TextPreviewPanel payload={textPreview} maxBytes={textPreviewLimitBytes} text={text} />
  }

  if (kind === "torrent") {
    return <TorrentPreviewPanel preview={torrentPreviewData} loading={torrentLoading} error={torrentError} text={text} />
  }

  if (kind === "folder") {
    return <UnsupportedPanel text={text} />
  }

  return (
    <div className="space-y-5">
      <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-3xl border border-border/55 bg-secondary/45">
        <PlayCircle className="h-16 w-16 text-muted-foreground/80" />
      </div>
      {kind === "unsupported" ? <UnsupportedPanel text={text} /> : null}
    </div>
  )
}
