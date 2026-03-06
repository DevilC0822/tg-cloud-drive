import { motion, AnimatePresence } from "framer-motion"
import { 
  Archive,
  X, 
  Code2,
  FolderOpen, 
  Image, 
  FileText, 
  Film, 
  Music,
  Download,
  Share2,
  Star,
  Trash2,
  Edit3,
  Clock,
  User,
  HardDrive,
  Link2,
  Copy
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { getFileToneClasses, themeToneClasses } from "@/lib/palette"
import { cn } from "@/lib/utils"
import { formatFileSize, formatRelativeTime } from "@/lib/files"
import type { FileItem } from "./file-card"

interface FileDetailsPanelProps {
  file: FileItem | null
  onClose: () => void
  onStarToggle?: () => void
}

const getFileIcon = (type: FileItem["type"]) => {
  if (type === "folder") return FolderOpen
  if (type === "image") return Image
  if (type === "document") return FileText
  if (type === "video") return Film
  if (type === "audio") return Music
  if (type === "archive") return Archive
  if (type === "code") return Code2
  return FileText
}

const getFileTypeLabel = (type: FileItem["type"]) => {
  if (type === "folder") return "文件夹"
  if (type === "image") return "图片"
  if (type === "document") return "文档"
  if (type === "video") return "视频"
  if (type === "audio") return "音频"
  return "文件"
}

export function FileDetailsPanel({ file, onClose, onStarToggle }: FileDetailsPanelProps) {
  if (!file) return null

  const Icon = getFileIcon(file.type)
  const tone = getFileToneClasses(file.type)
  const starTone = themeToneClasses.archive

  return (
    <AnimatePresence>
      {file && (
        <motion.aside
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          className="w-80 h-full glass-card rounded-2xl p-6 flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-foreground">文件详情</h3>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Preview */}
          <div className={cn("mb-6 flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl border bg-gradient-to-br", tone.border, tone.gradient)}>
            {file.thumbnail ? (
              <img src={file.thumbnail} alt={file.name} className="w-full h-full object-cover" />
            ) : (
              <Icon className={cn("h-20 w-20", tone.text)} />
            )}
          </div>

          {/* File Name */}
          <div className="mb-6">
            <h4 className="text-xl font-semibold text-foreground mb-1 break-words">
              {file.name}
            </h4>
            <div className="flex items-center gap-2">
              <span className={cn("rounded-full border px-2 py-1 text-xs", tone.badge)}>
                {getFileTypeLabel(file.type)}
              </span>
              {file.starred && (
                <span className={cn("flex items-center gap-1 text-xs", starTone.text)}>
                  <Star className={cn("h-3 w-3", starTone.fill)} />
                  已收藏
                </span>
              )}
              {file.isShared && (
                <span className="flex items-center gap-1 text-xs text-primary">
                  <Share2 className="w-3 h-3" />
                  已共享
                </span>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-4 gap-2 mb-6">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex flex-col items-center gap-1 p-3 rounded-xl bg-secondary/70 dark:bg-secondary/50 hover:bg-secondary border border-border/30 dark:border-transparent transition-colors"
            >
              <Download className="w-5 h-5 text-primary" />
              <span className="text-xs text-muted-foreground font-medium">下载</span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex flex-col items-center gap-1 p-3 rounded-xl bg-secondary/70 dark:bg-secondary/50 hover:bg-secondary border border-border/30 dark:border-transparent transition-colors"
            >
              <Share2 className="w-5 h-5 text-accent" />
              <span className="text-xs text-muted-foreground font-medium">分享</span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onStarToggle}
              className="flex flex-col items-center gap-1 p-3 rounded-xl bg-secondary/70 dark:bg-secondary/50 hover:bg-secondary border border-border/30 dark:border-transparent transition-colors"
            >
              <Star className={cn("h-5 w-5", file.starred ? `${starTone.text} ${starTone.fill}` : "text-muted-foreground")} />
              <span className="text-xs text-muted-foreground font-medium">收藏</span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex flex-col items-center gap-1 p-3 rounded-xl bg-secondary/70 dark:bg-secondary/50 hover:bg-secondary border border-border/30 dark:border-transparent transition-colors"
            >
              <Trash2 className="w-5 h-5 text-destructive" />
              <span className="text-xs text-muted-foreground font-medium">删除</span>
            </motion.button>
          </div>

          {/* File Details */}
          <div className="flex-1 space-y-4">
            <h5 className="text-sm font-semibold text-foreground">详细信息</h5>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <HardDrive className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">大小</span>
                <span className="ml-auto text-foreground">{formatFileSize(file.size)}</span>
              </div>
              
              <div className="flex items-center gap-3 text-sm">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">修改时间</span>
                <span className="ml-auto text-foreground">{formatRelativeTime(file.updatedAt)}</span>
              </div>
              
              <div className="flex items-center gap-3 text-sm">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">所有者</span>
                <span className="ml-auto text-foreground">我</span>
              </div>
              
              <div className="flex items-center gap-3 text-sm">
                <FolderOpen className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">位置</span>
                <span className="ml-auto text-foreground truncate max-w-[120px]">/我的文件</span>
              </div>
            </div>
          </div>

          {/* Share Link */}
          <div className="pt-4 border-t border-border/50">
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 bg-secondary/70 dark:bg-secondary/50 rounded-xl px-3 py-2 border border-border/30 dark:border-transparent">
                <Link2 className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground truncate font-mono">
                  nexus.cloud/share/abc123...
                </span>
              </div>
              <Button size="icon" variant="ghost" className="shrink-0 hover:bg-secondary/80">
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Edit Button */}
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="mt-4">
            <Button variant="outline" className="w-full gap-2 border-border/50">
              <Edit3 className="w-4 h-4" />
              编辑文件信息
            </Button>
          </motion.div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
