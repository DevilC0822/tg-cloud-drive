import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"
import { useAtom, useAtomValue } from "jotai"
import { AnimatePresence, motion } from "framer-motion"
import {
  FileUp,
  Loader2,
  Upload,
  X,
} from "lucide-react"
import { useI18n } from "@/components/i18n-provider"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useTorrentTasks } from "@/hooks/use-torrent-tasks"
import { useToast } from "@/hooks/use-toast"
import { useUpload } from "@/hooks/use-upload"
import { formatFileSize } from "@/lib/files"
import { uploadMessages } from "@/lib/i18n"
import {
  buildFolderManifestFromDrop,
  buildFolderManifestFromInput,
  pickFolderManifest,
  supportsDirectoryPicker,
  type LocalFolderManifest,
} from "@/lib/upload-folder-manifest"
import { cn } from "@/lib/utils"
import { filesCurrentFolderIdAtom, filesUploadDialogOpenAtom } from "@/stores/files-atoms"

interface UploadZoneProps {
  onUploaded?: () => void
}

type LocalUploadDraft =
  | { kind: "files"; files: File[] }
  | { kind: "folder"; folder: LocalFolderManifest }
  | null

function isPreviewableTorrentUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return false
  }

  try {
    const url = new URL(trimmed)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

export function UploadZone({ onUploaded }: UploadZoneProps) {
  const [open, setOpen] = useAtom(filesUploadDialogOpenAtom)
  const currentFolderId = useAtomValue(filesCurrentFolderIdAtom)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const directoryInputRef = useRef<HTMLInputElement | null>(null)
  const torrentFileInputRef = useRef<HTMLInputElement | null>(null)
  const [draft, setDraft] = useState<LocalUploadDraft>(null)
  const [torrentDragActive, setTorrentDragActive] = useState(false)
  const { toast } = useToast()

  const { locale } = useI18n()
  const text = uploadMessages[locale]

  const {
    isDragActive,
    uploadFiles,
    uploadFolder,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
  } = useUpload({ onUploaded })

  const {
    torrentUrl,
    setTorrentUrl,
    torrentFile,
    setTorrentFile,
    preview,
    selectedIndexes,
    toggleFileSelection,
    previewLoading,
    submitting,
    error,
    clearDraft,
    requestPreview,
    submitTask,
  } = useTorrentTasks()

  const torrentUrlActive = torrentUrl.trim().length > 0
  const torrentFileActive = !!torrentFile

  const closeDialog = () => {
    clearDraft()
    setDraft(null)
    setTorrentDragActive(false)
    setOpen(false)
  }

  const draftTotalSize = useMemo(() => {
    if (!draft) return 0
    if (draft.kind === "folder") return draft.folder.totalSize
    return draft.files.reduce((sum, file) => sum + file.size, 0)
  }, [draft])

  const draftPreviewItems = useMemo(() => {
    if (!draft) return []
    if (draft.kind === "folder") {
      return draft.folder.files.slice(0, 6).map((item) => item.relativePath)
    }
    return draft.files.slice(0, 6).map((file) => file.name)
  }, [draft])

  const chooseLocalFiles = () => {
    fileInputRef.current?.click()
  }

  const chooseLocalFolder = async () => {
    if (supportsDirectoryPicker()) {
      try {
        const folder = await pickFolderManifest()
        setDraft({ kind: "folder", folder })
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return
        }
        window.alert(error instanceof Error ? error.message : text.folderPickerUnsupported)
      }
      return
    }

    directoryInputRef.current?.click()
  }

  const onLocalFilesChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files && files.length > 0) {
      setDraft({ kind: "files", files: Array.from(files) })
    }
    event.target.value = ""
  }

  const onLocalFolderChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) {
      event.target.value = ""
      return
    }

    try {
      const folder = buildFolderManifestFromInput(files)
      setDraft({ kind: "folder", folder })
    } catch (error) {
      window.alert(error instanceof Error ? error.message : text.folderPickerUnsupported)
    }

    event.target.value = ""
  }

  const onLocalDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    try {
      const folder = await buildFolderManifestFromDrop(event.dataTransfer.items)
      if (folder) {
        setDraft({ kind: "folder", folder })
        return
      }
    } catch (error) {
      window.alert(error instanceof Error ? error.message : text.folderDropUnsupported)
      return
    }
    const files = Array.from(event.dataTransfer.files)
    if (files.length > 0) {
      setDraft({ kind: "files", files })
    }
  }

  const onTorrentFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (torrentUrlActive) {
      event.target.value = ""
      return
    }
    const file = event.target.files?.[0] || null
    setTorrentFile(file)
    event.target.value = ""
  }

  const chooseTorrentFile = () => {
    torrentFileInputRef.current?.click()
  }

  const onTorrentDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setTorrentDragActive(false)
    if (torrentUrlActive) {
      return
    }
    const file = Array.from(event.dataTransfer.files).find((item) => item.name.toLowerCase().endsWith(".torrent")) ?? null
    if (file) {
      setTorrentFile(file)
    }
  }

  useEffect(() => {
    if (!open) {
      return
    }
    if (torrentFileActive) {
      void requestPreview()
      return
    }
    if (!isPreviewableTorrentUrl(torrentUrl)) {
      return
    }
    const timer = window.setTimeout(() => {
      void requestPreview()
    }, 500)
    return () => window.clearTimeout(timer)
  }, [open, requestPreview, torrentFileActive, torrentUrl])

  const createTorrent = async () => {
    const result = await submitTask(currentFolderId)
    if (result.ok) {
      clearDraft()
      setTorrentDragActive(false)
      toast({
        title: text.torrentQueuedTitle,
        description: text.torrentQueuedDescription,
      })
      setOpen(false)
    }
  }

  const submitLocalUpload = () => {
    if (!draft) {
      return
    }

    if (draft.kind === "folder") {
      void uploadFolder(draft.folder, currentFolderId).catch((error) => {
        toast({
          title: text.failed,
          description: error instanceof Error ? error.message : text.retry,
          variant: "destructive",
        })
      })
    } else {
      void uploadFiles(draft.files, currentFolderId).catch((error) => {
        toast({
          title: text.failed,
          description: error instanceof Error ? error.message : text.retry,
          variant: "destructive",
        })
      })
    }

    toast({
      title: text.uploadQueuedTitle,
      description: text.uploadQueuedDescription,
    })
    clearDraft()
    setDraft(null)
    setOpen(false)
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-4 py-6 backdrop-blur-sm"
          onClick={closeDialog}
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="glass-card flex w-full max-w-4xl flex-col rounded-3xl p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold text-foreground">{text.title}</h2>
                <p className="text-sm text-muted-foreground">{text.subtitle}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={closeDialog}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <Tabs defaultValue="local" className="flex-1">
              <TabsList className="w-fit">
                <TabsTrigger value="local">{text.tabLocal}</TabsTrigger>
                <TabsTrigger value="torrent">{text.tabTorrent}</TabsTrigger>
              </TabsList>

              <TabsContent value="local" className="mt-4 space-y-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={onLocalFilesChange}
                />
                <input
                  ref={(node) => {
                    directoryInputRef.current = node
                    if (!node) {
                      return
                    }
                    node.setAttribute("webkitdirectory", "")
                    node.setAttribute("directory", "")
                  }}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={onLocalFolderChange}
                />

                <div
                  role="button"
                  tabIndex={0}
                  className={cn(
                    "relative block w-full rounded-2xl border-2 border-dashed p-8 text-center transition-all",
                    isDragActive ? "border-primary bg-primary/8" : "border-border/60 hover:border-primary/45",
                  )}
                  onClick={chooseLocalFiles}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      chooseLocalFiles()
                    }
                  }}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={(event) => void onLocalDrop(event)}
                >
                  <div className="flex flex-col items-center gap-2">
                    <FileUp className="h-10 w-10 text-primary" />
                    <p className="text-base font-medium text-foreground">
                      {isDragActive ? text.localDropActive : text.localDropTitle}
                    </p>
                    <p className="text-sm text-muted-foreground">{text.localDropHint}</p>
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-primary"
                      onClick={(event) => {
                        event.stopPropagation()
                        void chooseLocalFolder()
                      }}
                    >
                      {text.localChooseFolder}
                    </Button>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/50 bg-secondary/25 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{text.localSelectionTitle}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {!draft
                          ? text.localSelectionEmpty
                          : draft.kind === "folder"
                            ? text.localSelectionFolder(
                                draft.folder.rootName,
                                draft.folder.files.length,
                                draft.folder.directories.length + 1,
                              )
                            : text.localSelectionFiles(draft.files.length)}
                      </p>
                    </div>
                    <div className="rounded-full border border-border/50 bg-background/40 px-3 py-1 text-xs text-muted-foreground">
                      {draft ? formatFileSize(draftTotalSize) : "—"}
                    </div>
                  </div>

                  {draftPreviewItems.length > 0 ? (
                    <div className="mt-4 max-h-40 space-y-2 overflow-y-auto pr-1">
                      {draftPreviewItems.map((label) => (
                        <div key={label} className="rounded-xl border border-border/40 bg-background/35 px-3 py-2 text-sm text-foreground/90">
                          {label}
                        </div>
                      ))}
                      {draft &&
                      ((draft.kind === "folder" && draft.folder.files.length > draftPreviewItems.length) ||
                        (draft.kind === "files" && draft.files.length > draftPreviewItems.length)) ? (
                        <p className="text-xs text-muted-foreground">
                          +{" "}
                          {draft.kind === "folder"
                            ? draft.folder.files.length - draftPreviewItems.length
                            : draft.files.length - draftPreviewItems.length}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button onClick={submitLocalUpload} disabled={!draft}>
                      <Upload className="mr-2 h-4 w-4" />
                      {text.confirmUpload}
                    </Button>
                    <Button variant="outline" onClick={() => setDraft(null)} disabled={!draft}>
                      {text.changeSelection}
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="torrent" className="mt-4 space-y-4">
                <input
                  ref={torrentFileInputRef}
                  type="file"
                  accept=".torrent"
                  className="hidden"
                  onChange={onTorrentFileChange}
                />

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">{text.torrentUrlLabel}</label>
                    <Input
                      value={torrentUrl}
                      onChange={(event) => setTorrentUrl(event.target.value)}
                      placeholder={text.torrentUrlPlaceholder}
                      disabled={torrentFileActive}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">{text.torrentFileLabel}</label>
                    <div
                      role="button"
                      tabIndex={0}
                      className={cn(
                        "rounded-2xl border-2 border-dashed p-5 text-center transition-all",
                        torrentUrlActive
                          ? "cursor-not-allowed border-border/40 bg-secondary/15 opacity-60"
                          : torrentDragActive
                            ? "border-primary bg-primary/8"
                            : "border-border/60 hover:border-primary/45",
                      )}
                      onClick={() => {
                        if (!torrentUrlActive) {
                          chooseTorrentFile()
                        }
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault()
                          if (!torrentUrlActive) {
                            chooseTorrentFile()
                          }
                        }
                      }}
                      onDragEnter={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        if (torrentUrlActive) {
                          return
                        }
                        setTorrentDragActive(true)
                      }}
                      onDragLeave={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        setTorrentDragActive(false)
                      }}
                      onDragOver={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                      }}
                      onDrop={onTorrentDrop}
                    >
                      <div className="pointer-events-none flex flex-col items-center gap-2">
                        <FileUp className="h-8 w-8 text-primary" />
                        <p className="text-sm font-medium text-foreground">
                          {torrentDragActive ? text.torrentDropActive : text.torrentDropTitle}
                        </p>
                        <p className="text-xs text-muted-foreground">{text.torrentDropHint}</p>
                      </div>
                    </div>
                    {torrentFile ? (
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground">
                          {text.torrentSelectedSource}: {torrentFile.name}
                        </p>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={clearDraft}>
                          {text.changeSelection}
                        </Button>
                      </div>
                    ) : null}
                    {torrentUrlActive ? (
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground">{torrentUrl}</p>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={clearDraft}>
                          {text.changeSelection}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button onClick={() => void createTorrent()} disabled={submitting || previewLoading || !preview || selectedIndexes.length === 0}>
                    {previewLoading || submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {text.torrentCreate}
                  </Button>
                </div>

                {error ? <p className="text-sm text-destructive">{error}</p> : null}

                <div className="rounded-2xl border border-border/50 bg-secondary/25 p-3">
                  <p className="mb-2 text-sm font-medium text-foreground">{text.torrentChooseFiles}</p>

                  {preview ? (
                    <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                      {preview.files.map((file) => (
                        <label key={file.fileIndex} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-secondary/50">
                          <Checkbox
                            checked={selectedIndexes.includes(file.fileIndex)}
                            onCheckedChange={() => toggleFileSelection(file.fileIndex)}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-1 text-sm text-foreground">{file.filePath}</p>
                            <p className="text-xs text-muted-foreground">{formatFileSize(file.fileSize)}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">{text.torrentNoPreview}</p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
