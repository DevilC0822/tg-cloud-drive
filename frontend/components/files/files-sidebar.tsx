import { motion } from "framer-motion"
import { useAtom, useAtomValue } from "jotai"
import { useCallback } from "react"
import { useSearchParams } from "react-router-dom"
import { ChevronDown, FolderPlus, Grid3X3, HardDrive, KeyRound, List, Search, SlidersHorizontal, Star, Upload, Share2, FolderOpen } from "lucide-react"
import { I18nFade } from "@/components/i18n-fade"
import { useI18n } from "@/components/i18n-provider"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { formatFileSize } from "@/lib/files"
import { filesMessages } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import {
  filesFolderRouteClearingAtom,
  filesItemsAtom,
  filesPaginationAtom,
  filesSearchQueryAtom,
  filesSectionAtom,
  filesSelectedFileIdsAtom,
  filesSortByAtom,
  filesSortOrderAtom,
  filesStorageStatsAtom,
  filesUploadDialogOpenAtom,
  filesViewModeAtom,
} from "@/stores/files-atoms"

const SORT_OPTIONS: Array<{ key: "name" | "date" | "size" | "type"; labelKey: "sortName" | "sortDate" | "sortSize" | "sortType" }> = [
  { key: "name", labelKey: "sortName" },
  { key: "date", labelKey: "sortDate" },
  { key: "size", labelKey: "sortSize" },
  { key: "type", labelKey: "sortType" },
]

interface FilesSidebarProps {
  onCreateFolder: () => void
  createFolderDisabled?: boolean
  createFolderDisabledReason?: string
}

export function FilesSidebar({
  onCreateFolder,
  createFolderDisabled = false,
  createFolderDisabledReason = "",
}: FilesSidebarProps) {
  const { locale } = useI18n()
  const text = filesMessages[locale]
  const [, setSearchParams] = useSearchParams()

  const [section, setSection] = useAtom(filesSectionAtom)
  const [, setFolderRouteClearing] = useAtom(filesFolderRouteClearingAtom)
  const [viewMode, setViewMode] = useAtom(filesViewModeAtom)
  const [searchQuery, setSearchQuery] = useAtom(filesSearchQueryAtom)
  const [sortBy, setSortBy] = useAtom(filesSortByAtom)
  const [sortOrder, setSortOrder] = useAtom(filesSortOrderAtom)
  const [pagination, setPagination] = useAtom(filesPaginationAtom)
  const [, setSelectedIds] = useAtom(filesSelectedFileIdsAtom)
  const [uploadOpen, setUploadOpen] = useAtom(filesUploadDialogOpenAtom)

  const items = useAtomValue(filesItemsAtom)
  const stats = useAtomValue(filesStorageStatsAtom)

  const sharedCount = items.filter((item) => item.isShared).length
  const starredCount = items.filter((item) => item.starred).length
  const vaultCount = items.filter((item) => item.isVaulted).length
  const allCount = pagination.totalCount
  const totalSizeLabel = formatFileSize(stats.totalBytes)
  const totalFilesLabel = stats.totalFiles.toLocaleString(locale === "zh" ? "zh-CN" : "en-US")
  const totalSizeTitle = locale === "zh" ? "总容量" : "Total Size"
  const totalFilesTitle = locale === "zh" ? "总文件数" : "Total Files"
  const handleSectionChange = useCallback((nextSection: "all" | "shared" | "starred" | "vault") => {
    setSection(nextSection)
    setFolderRouteClearing(true)
    setSelectedIds([])
    setPagination((previous) => ({ ...previous, page: 1 }))
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous)
      next.delete("folder")
      return next
    }, { replace: true })
  }, [setFolderRouteClearing, setPagination, setSearchParams, setSection, setSelectedIds])

  return (
    <aside className="glass-card flex h-full w-72 flex-col rounded-2xl p-4">
      <I18nFade locale={locale} className="flex h-full flex-col">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder={text.searchPlaceholder}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="h-9 border-border/60 bg-secondary/70 pl-9 text-sm"
          />
        </div>

        <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} className="mb-4">
          <Button
            onClick={() => setUploadOpen(!uploadOpen)}
            className="w-full gap-2 bg-gradient-to-r from-primary to-accent text-primary-foreground"
          >
            <Upload className="h-4 w-4" />
            {text.uploadButton}
          </Button>
        </motion.div>

        <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} className="mb-4">
          <Button
            variant="outline"
            onClick={onCreateFolder}
            disabled={createFolderDisabled}
            className="w-full gap-2 border-border/55 bg-secondary/55"
            title={createFolderDisabled ? createFolderDisabledReason : undefined}
          >
            <FolderPlus className="h-4 w-4" />
            {text.newFolderButton}
          </Button>
        </motion.div>

        <div className="mb-4 flex items-center gap-2 px-1">
          <div className="flex items-center rounded-lg border border-border/40 bg-secondary/65 p-0.5">
            <button
              onClick={() => setViewMode("grid")}
              className={cn(
                "rounded-md p-1.5 transition-colors",
                viewMode === "grid" ? "bg-primary/18 text-primary" : "text-muted-foreground",
              )}
              aria-label={text.viewGrid}
            >
              <Grid3X3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "rounded-md p-1.5 transition-colors",
                viewMode === "list" ? "bg-primary/18 text-primary" : "text-muted-foreground",
              )}
              aria-label={text.viewList}
            >
              <List className="h-4 w-4" />
            </button>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs text-muted-foreground">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                {text.sortBy}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="glass border-border/50">
              {SORT_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option.key}
                  onClick={() => {
                    if (sortBy === option.key) {
                      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))
                    } else {
                      setSortBy(option.key)
                      setSortOrder("asc")
                    }
                  }}
                  className={cn("cursor-pointer text-sm", sortBy === option.key && "text-primary")}
                >
                  {text[option.labelKey]}
                  {sortBy === option.key ? ` (${sortOrder.toUpperCase()})` : ""}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <nav className="flex-1 space-y-1">
          <button
            onClick={() => handleSectionChange("all")}
            className={cn(
              "group flex w-full items-center justify-between rounded-xl p-3 text-sm transition-all",
              section === "all" ? "bg-primary/14 text-primary" : "text-muted-foreground hover:bg-secondary/60",
            )}
          >
            <span className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              {text.sectionAll}
            </span>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{allCount}</span>
          </button>

          <button
            onClick={() => handleSectionChange("shared")}
            className={cn(
              "group flex w-full items-center justify-between rounded-xl p-3 text-sm transition-all",
              section === "shared" ? "bg-primary/14 text-primary" : "text-muted-foreground hover:bg-secondary/60",
            )}
          >
            <span className="flex items-center gap-2">
              <Share2 className="h-4 w-4" />
              {text.sectionShared}
            </span>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{sharedCount}</span>
          </button>

          <button
            onClick={() => handleSectionChange("starred")}
            className={cn(
              "group flex w-full items-center justify-between rounded-xl p-3 text-sm transition-all",
              section === "starred" ? "bg-primary/14 text-primary" : "text-muted-foreground hover:bg-secondary/60",
            )}
          >
            <span className="flex items-center gap-2">
              <Star className="h-4 w-4" />
              {text.sectionStarred}
            </span>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{starredCount}</span>
          </button>

          <button
            onClick={() => handleSectionChange("vault")}
            className={cn(
              "group flex w-full items-center justify-between rounded-xl p-3 text-sm transition-all",
              section === "vault" ? "bg-primary/14 text-primary" : "text-muted-foreground hover:bg-secondary/60",
            )}
          >
            <span className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              {text.sectionVault}
            </span>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{vaultCount}</span>
          </button>
        </nav>

        <div className="border-border/60 mt-4 border-t pt-4">
          <div className="flex items-center justify-between rounded-xl border border-border/50 bg-secondary/35 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-primary" />
              <div className="leading-tight">
                <p className="text-[11px] text-muted-foreground">{totalSizeTitle}</p>
                <p className="text-sm font-semibold text-foreground">{totalSizeLabel}</p>
              </div>
            </div>

            <div className="text-right leading-tight">
              <p className="text-[11px] text-muted-foreground">{totalFilesTitle}</p>
              <p className="text-sm font-semibold text-foreground">{totalFilesLabel}</p>
            </div>
          </div>
        </div>
      </I18nFade>
    </aside>
  )
}
