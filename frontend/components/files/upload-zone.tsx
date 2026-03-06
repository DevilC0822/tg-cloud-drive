import { useRef, type ChangeEvent } from "react"
import { useAtom, useAtomValue } from "jotai"
import { AnimatePresence, motion } from "framer-motion"
import {
  CheckCircle2,
  FileUp,
  Loader2,
  RefreshCcw,
  Upload,
  X,
} from "lucide-react"
import { Link } from "react-router-dom"
import { useI18n } from "@/components/i18n-provider"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useTorrentTasks } from "@/hooks/use-torrent-tasks"
import { useUpload } from "@/hooks/use-upload"
import { formatFileSize } from "@/lib/files"
import { uploadMessages } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { filesCurrentFolderIdAtom, filesUploadDialogOpenAtom } from "@/stores/files-atoms"

interface UploadZoneProps {
  onUploaded?: () => void
}

function UploadTaskStateLabel({ status }: { status: "pending" | "uploading" | "completed" | "error" }) {
  if (status === "completed") return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
  if (status === "uploading") return <Loader2 className="h-4 w-4 animate-spin text-primary" />
  if (status === "pending") return <Loader2 className="h-4 w-4 text-muted-foreground" />
  return <span className="text-xs text-destructive">ERR</span>
}

export function UploadZone({ onUploaded }: UploadZoneProps) {
  const [open, setOpen] = useAtom(filesUploadDialogOpenAtom)
  const currentFolderId = useAtomValue(filesCurrentFolderIdAtom)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const { locale } = useI18n()
  const text = uploadMessages[locale]

  const {
    uploadTasks,
    isDragActive,
    uploadFiles,
    retryTask,
    removeTask,
    clearCompletedTasks,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
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

  const closeDialog = () => {
    clearDraft()
    setOpen(false)
  }

  const chooseLocalFiles = () => {
    fileInputRef.current?.click()
  }

  const onLocalFilesChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files && files.length > 0) {
      void uploadFiles(files, currentFolderId)
    }
    event.target.value = ""
  }

  const onTorrentFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null
    setTorrentFile(file)
  }

  const createTorrent = async () => {
    const result = await submitTask(currentFolderId)
    if (result.ok) {
      clearDraft()
      onUploaded?.()
      setOpen(false)
    }
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

                <button
                  className={cn(
                    "relative block w-full rounded-2xl border-2 border-dashed p-8 text-center transition-all",
                    isDragActive ? "border-primary bg-primary/8" : "border-border/60 hover:border-primary/45",
                  )}
                  onClick={chooseLocalFiles}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={(event) => handleDrop(event, currentFolderId)}
                >
                  <div className="pointer-events-none flex flex-col items-center gap-2">
                    <FileUp className="h-10 w-10 text-primary" />
                    <p className="text-base font-medium text-foreground">
                      {isDragActive ? text.localDropActive : text.localDropTitle}
                    </p>
                    <p className="text-sm text-muted-foreground">{text.localDropHint}</p>
                  </div>
                </button>

                <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                  {uploadTasks.map((task) => (
                    <div key={task.id} className="rounded-xl border border-border/50 bg-secondary/35 px-3 py-2.5">
                      <div className="mb-2 flex items-center gap-2">
                        <UploadTaskStateLabel status={task.status} />
                        <span className="line-clamp-1 flex-1 text-sm font-medium text-foreground">{task.file.name}</span>
                        <span className="text-xs text-muted-foreground">{formatFileSize(task.file.size)}</span>
                      </div>

                      <Progress value={task.progress} className="h-1.5" />

                      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {task.status === "completed"
                            ? text.uploaded
                            : task.status === "error"
                              ? text.failed
                              : text.uploading}
                        </span>
                        <div className="flex items-center gap-2">
                          {task.status === "error" ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-xs"
                              onClick={() => void retryTask(task.id)}
                            >
                              <RefreshCcw className="mr-1 h-3 w-3" />
                              {text.retry}
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-xs"
                            onClick={() => removeTask(task.id)}
                          >
                            {text.close}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {uploadTasks.some((task) => task.status === "completed") ? (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Button asChild variant="ghost" size="sm">
                      <Link to="/transfers" onClick={() => setOpen(false)}>
                        {text.viewTransfers}
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" onClick={clearCompletedTasks}>
                      {text.clearCompleted}
                    </Button>
                  </div>
                ) : null}
              </TabsContent>

              <TabsContent value="torrent" className="mt-4 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">{text.torrentUrlLabel}</label>
                    <Input
                      value={torrentUrl}
                      onChange={(event) => setTorrentUrl(event.target.value)}
                      placeholder={text.torrentUrlPlaceholder}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">{text.torrentFileLabel}</label>
                    <Input type="file" accept=".torrent" onChange={onTorrentFileChange} />
                    {torrentFile ? <p className="text-xs text-muted-foreground">{torrentFile.name}</p> : null}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="secondary" disabled={previewLoading} onClick={() => void requestPreview()}>
                    {previewLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {text.torrentPreview}
                  </Button>

                  <Button onClick={() => void createTorrent()} disabled={submitting || !preview || selectedIndexes.length === 0}>
                    {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
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
