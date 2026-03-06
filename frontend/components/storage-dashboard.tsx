"use client"

import { motion } from "framer-motion"
import { 
  Upload, 
  FolderOpen, 
  Image, 
  FileText, 
  Film, 
  Music,
  MoreVertical,
  Download,
  Share2,
  Trash2,
  HardDrive,
  Clock,
  Star
} from "lucide-react"
import { GlassCard } from "./glass-card"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/components/i18n-provider"
import { dashboardMessages } from "@/lib/dashboard-i18n"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface FileItem {
  id: number
  name: string
  type: "folder" | "image" | "document" | "video" | "audio"
  size: string
  modifiedKey: "hours2" | "day1" | "days3" | "week1" | "weeks2"
  starred?: boolean
}

const files: FileItem[] = [
  { id: 1, name: "Projects", type: "folder", size: "2.4 GB", modifiedKey: "hours2" },
  { id: 2, name: "vacation-photos.zip", type: "image", size: "856 MB", modifiedKey: "day1", starred: true },
  { id: 3, name: "quarterly-report.pdf", type: "document", size: "4.2 MB", modifiedKey: "days3" },
  { id: 4, name: "demo-video.mp4", type: "video", size: "1.2 GB", modifiedKey: "week1" },
  { id: 5, name: "podcast-episode.mp3", type: "audio", size: "87 MB", modifiedKey: "weeks2" },
  { id: 6, name: "Design Assets", type: "folder", size: "4.8 GB", modifiedKey: "days3", starred: true },
]

const getFileIcon = (type: FileItem["type"]) => {
  const icons = {
    folder: FolderOpen,
    image: Image,
    document: FileText,
    video: Film,
    audio: Music,
  }
  return icons[type]
}

const getIconGradient = (type: FileItem["type"]) => {
  const gradients = {
    folder: "from-amber-500/20 to-orange-500/20",
    image: "from-emerald-500/20 to-teal-500/20",
    document: "from-blue-500/20 to-indigo-500/20",
    video: "from-rose-500/20 to-pink-500/20",
    audio: "from-violet-500/20 to-purple-500/20",
  }
  return gradients[type]
}

const getIconColor = (type: FileItem["type"]) => {
  const colors = {
    folder: "text-amber-400",
    image: "text-emerald-400",
    document: "text-blue-400",
    video: "text-rose-400",
    audio: "text-violet-400",
  }
  return colors[type]
}

export function StorageDashboard() {
  const storageUsed = 67
  const { locale } = useI18n()
  const text = dashboardMessages[locale].storage
  
  return (
    <section id="dashboard" className="py-20 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="text-foreground">{text.titleLead} </span>
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              {text.titleHighlight}
            </span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {text.subtitle}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Upload Button */}
            <GlassCard className="overflow-hidden" delay={0.1}>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button className="w-full bg-gradient-to-r from-primary to-accent text-primary-foreground gap-2 py-6 text-lg shadow-lg shadow-primary/20">
                  <Upload className="w-5 h-5" />
                  {text.uploadFiles}
                </Button>
              </motion.div>
            </GlassCard>

            {/* Storage Stats */}
            <GlassCard delay={0.2}>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20">
                  <HardDrive className="w-5 h-5 text-primary" />
                </div>
                <span className="font-semibold text-foreground">{text.storage}</span>
              </div>
              <div className="mb-3">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">{text.used}</span>
                  <span className="text-foreground font-medium">{text.usedValue}</span>
                </div>
                <div className="relative h-3 bg-secondary rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: `${storageUsed}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="absolute h-full bg-gradient-to-r from-primary via-accent to-neon-orange rounded-full"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {text.available}
              </p>
            </GlassCard>

            {/* Quick Access */}
            <GlassCard delay={0.3}>
              <h3 className="font-semibold text-foreground mb-4">{text.quickAccess}</h3>
              <div className="space-y-2">
                {[
                  { icon: Clock, ...text.quickAccessItems[0] },
                  { icon: Star, ...text.quickAccessItems[1] },
                  { icon: Share2, ...text.quickAccessItems[2] },
                  { icon: Trash2, ...text.quickAccessItems[3] },
                ].map((item) => (
                  <motion.button
                    key={item.label}
                    whileHover={{ x: 4 }}
                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-secondary/50 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      <span className="text-sm text-foreground">{item.label}</span>
                    </div>
                    <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-full">
                      {item.count}
                    </span>
                  </motion.button>
                ))}
              </div>
            </GlassCard>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <GlassCard className="overflow-hidden" delay={0.2}>
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-foreground">{text.allFiles}</h3>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="text-muted-foreground">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="7" height="7" rx="1" />
                      <rect x="14" y="3" width="7" height="7" rx="1" />
                      <rect x="3" y="14" width="7" height="7" rx="1" />
                      <rect x="14" y="14" width="7" height="7" rx="1" />
                    </svg>
                  </Button>
                  <Button variant="ghost" size="sm" className="text-muted-foreground">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="3" y1="6" x2="21" y2="6" />
                      <line x1="3" y1="12" x2="21" y2="12" />
                      <line x1="3" y1="18" x2="21" y2="18" />
                    </svg>
                  </Button>
                </div>
              </div>

              {/* Files Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {files.map((file, index) => {
                  const Icon = getFileIcon(file.type)
                  return (
                    <motion.div
                      key={file.id}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.05 }}
                      whileHover={{ scale: 1.02, y: -2 }}
                      className="group relative bg-secondary/30 rounded-xl p-4 border border-border/50 hover:border-primary/30 hover:bg-secondary/50 transition-all cursor-pointer"
                    >
                      {file.starred && (
                        <div className="absolute top-3 right-10">
                          <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                        </div>
                      )}
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-secondary">
                            <MoreVertical className="w-4 h-4 text-muted-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="glass border-border/50">
                          <DropdownMenuItem className="gap-2 cursor-pointer">
                            <Download className="w-4 h-4" /> {text.actions.download}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2 cursor-pointer">
                            <Share2 className="w-4 h-4" /> {text.actions.share}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2 cursor-pointer">
                            <Star className="w-4 h-4" /> {text.actions.star}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2 cursor-pointer text-destructive">
                            <Trash2 className="w-4 h-4" /> {text.actions.delete}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getIconGradient(file.type)} flex items-center justify-center mb-3`}>
                        <Icon className={`w-6 h-6 ${getIconColor(file.type)}`} />
                      </div>
                      
                      <h4 className="font-medium text-foreground truncate mb-1">
                        {file.name}
                      </h4>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{file.size}</span>
                        <span>{text.modifiedTimes[file.modifiedKey]}</span>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </GlassCard>
          </div>
        </div>
      </div>
    </section>
  )
}
