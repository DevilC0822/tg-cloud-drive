import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ChevronRight, FileText, Folder, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { fetchTransferEntries, type TransferFolderEntry } from "@/lib/transfers-api"
import { formatFileSize } from "@/lib/files"
import type { transferMessages } from "@/lib/i18n"
import { semanticToneClasses, themeToneClasses } from "@/lib/palette"
import { cn } from "@/lib/utils"

interface TransferFolderTreeProps {
  transferId: string
  refreshKey?: string
  text: (typeof transferMessages)["en"]
}

export function TransferFolderTree({ transferId, refreshKey, text }: TransferFolderTreeProps) {
  const [entriesByParent, setEntriesByParent] = useState<Record<string, TransferFolderEntry[]>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [loadingParents, setLoadingParents] = useState<Record<string, boolean>>({ "": true })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const lastRefreshKeyRef = useRef("")

  const loadEntries = useCallback(async (parentPath: string) => {
    setLoadingParents((prev) => ({ ...prev, [parentPath]: true }))
    setErrors((prev) => ({ ...prev, [parentPath]: "" }))

    try {
      const items = await fetchTransferEntries(transferId, parentPath)
      setEntriesByParent((prev) => ({ ...prev, [parentPath]: items }))
    } catch (error) {
      setErrors((prev) => ({
        ...prev,
        [parentPath]: error instanceof Error ? error.message : "Failed to load folder entries",
      }))
    } finally {
      setLoadingParents((prev) => ({ ...prev, [parentPath]: false }))
    }
  }, [transferId])

  useEffect(() => {
    lastRefreshKeyRef.current = ""
    setEntriesByParent({})
    setExpanded({})
    setLoadingParents({ "": true })
    setErrors({})
    void loadEntries("")
  }, [loadEntries, transferId])

  useEffect(() => {
    if (!refreshKey || refreshKey === lastRefreshKeyRef.current) {
      return
    }
    lastRefreshKeyRef.current = refreshKey
    const loadedParents = Object.keys(entriesByParent)
    if (loadedParents.length === 0) {
      return
    }
    for (const parentPath of loadedParents) {
      void loadEntries(parentPath)
    }
  }, [entriesByParent, loadEntries, refreshKey])

  const rootEntries = useMemo(() => entriesByParent[""] ?? [], [entriesByParent])

  const toggleFolder = useCallback((path: string) => {
    setExpanded((prev) => {
      const nextOpen = !prev[path]
      if (nextOpen && !(path in entriesByParent) && !loadingParents[path]) {
        void loadEntries(path)
      }
      return { ...prev, [path]: nextOpen }
    })
  }, [entriesByParent, loadEntries, loadingParents])

  if (loadingParents[""] && rootEntries.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-border/50 bg-secondary/15 px-3 py-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {text.syncing}
      </div>
    )
  }

  if (!loadingParents[""] && rootEntries.length === 0) {
    return (
      <div className="rounded-2xl border border-border/50 bg-secondary/15 px-3 py-3 text-sm text-muted-foreground">
        {text.emptyFolder}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {renderFolderRows({
        entriesByParent,
        errors,
        loadingParents,
        onToggleFolder: toggleFolder,
        rootEntries,
        text,
        expanded,
      })}
    </div>
  )
}

function renderFolderRows(input: {
  rootEntries: TransferFolderEntry[]
  entriesByParent: Record<string, TransferFolderEntry[]>
  loadingParents: Record<string, boolean>
  errors: Record<string, string>
  expanded: Record<string, boolean>
  onToggleFolder: (path: string) => void
  text: (typeof transferMessages)["en"]
}) {
  return input.rootEntries.map((entry) => (
    <FolderRow
      key={entry.relativePath || entry.name}
      depth={0}
      entry={entry}
      entriesByParent={input.entriesByParent}
      loadingParents={input.loadingParents}
      errors={input.errors}
      expanded={input.expanded}
      onToggleFolder={input.onToggleFolder}
      text={input.text}
    />
  ))
}

function FolderRow(props: {
  entry: TransferFolderEntry
  depth: number
  entriesByParent: Record<string, TransferFolderEntry[]>
  loadingParents: Record<string, boolean>
  errors: Record<string, string>
  expanded: Record<string, boolean>
  onToggleFolder: (path: string) => void
  text: (typeof transferMessages)["en"]
}) {
  const { entry, depth, entriesByParent, loadingParents, errors, expanded, onToggleFolder, text } = props
  const isFolder = entry.entryType === "folder"
  const isExpanded = !!expanded[entry.relativePath]
  const children = entriesByParent[entry.relativePath] ?? []
  const statusTone = getFolderEntryTone(entry.status)
  const Icon = isFolder ? Folder : FileText

  return (
    <div className="space-y-2">
      <div
        className="rounded-2xl border border-border/50 bg-secondary/15 px-3 py-3"
        style={{ marginLeft: `${depth * 16}px` }}
      >
        <div className="flex items-start gap-3">
          {isFolder ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 rounded-full"
              onClick={() => onToggleFolder(entry.relativePath)}
            >
              <ChevronRight className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-90")} />
            </Button>
          ) : (
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/50 bg-background/30">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          )}

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className={cn("flex h-9 w-9 items-center justify-center rounded-2xl border", themeToneClasses.info.iconWrap)}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{entry.name}</p>
                <p className="truncate text-xs text-muted-foreground">{entry.relativePath || text.rootFolder}</p>
              </div>
              <Badge variant="outline" className={cn("rounded-full px-2 py-0.5 text-[11px]", statusTone)}>
                {entry.status}
              </Badge>
            </div>

            <Progress value={entry.progress.percent} className="h-1.5 bg-primary/12" />

            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>{formatFileSize(entry.size)}</span>
              <span>{entry.progress.percent}%</span>
              {isFolder ? (
                <span>{text.uploaded}: {entry.completedCount}</span>
              ) : null}
              {entry.activeCount > 0 ? <span>{text.activeFiles}: {entry.activeCount}</span> : null}
              {entry.failedCount > 0 ? <span>{text.failed}: {entry.failedCount}</span> : null}
            </div>

            {entry.error ? <p className={cn("text-xs", semanticToneClasses.error.text)}>{entry.error}</p> : null}
          </div>
        </div>
      </div>

      {isFolder && isExpanded ? (
        <div className="space-y-2">
          {loadingParents[entry.relativePath] ? (
            <div className="flex items-center gap-2 pl-4 text-xs text-muted-foreground" style={{ marginLeft: `${depth * 16}px` }}>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {text.syncing}
            </div>
          ) : null}
          {errors[entry.relativePath] ? (
            <p className={cn("pl-4 text-xs", semanticToneClasses.error.text)} style={{ marginLeft: `${depth * 16}px` }}>
              {errors[entry.relativePath]}
            </p>
          ) : null}
          {children.map((child) => (
            <FolderRow
              key={child.relativePath}
              entry={child}
              depth={depth + 1}
              entriesByParent={entriesByParent}
              loadingParents={loadingParents}
              errors={errors}
              expanded={expanded}
              onToggleFolder={onToggleFolder}
              text={text}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function getFolderEntryTone(status: TransferFolderEntry["status"]) {
  if (status === "completed") {
    return cn(semanticToneClasses.success.border, semanticToneClasses.success.bg, semanticToneClasses.success.text)
  }
  if (status === "failed") {
    return cn(semanticToneClasses.error.border, semanticToneClasses.error.bg, semanticToneClasses.error.text)
  }
  if (status === "uploading") {
    return cn(themeToneClasses.info.border, themeToneClasses.info.bg, themeToneClasses.info.text)
  }
  return "border-border/50 bg-secondary/30 text-muted-foreground"
}
