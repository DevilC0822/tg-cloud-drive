"use client"

import { motion } from "framer-motion"
import { 
  Search, 
  Grid3X3, 
  List, 
  SlidersHorizontal,
  Upload,
  Bell,
  User,
  ChevronDown
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { ThemeToggle } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"

interface FilesHeaderProps {
  viewMode: "grid" | "list"
  onViewModeChange: (mode: "grid" | "list") => void
  searchQuery: string
  onSearchChange: (query: string) => void
  sortBy: string
  onSortChange: (sort: string) => void
}

const sortOptions = [
  { value: "name", label: "名称" },
  { value: "date", label: "修改日期" },
  { value: "size", label: "大小" },
  { value: "type", label: "类型" },
]

export function FilesHeader({
  viewMode,
  onViewModeChange,
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
}: FilesHeaderProps) {
  return (
    <header className="glass-card rounded-2xl p-4 flex items-center justify-between gap-4">
      {/* Left Section - Search */}
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="搜索文件、文件夹..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 bg-secondary/70 dark:bg-secondary/50 border-border/60 dark:border-border/50 focus:border-primary/50 focus:ring-primary/20 placeholder:text-muted-foreground/70"
          />
        </div>
      </div>

      {/* Center Section - View Controls */}
      <div className="flex items-center gap-2">
        {/* View Mode Toggle */}
        <div className="flex items-center bg-secondary/70 dark:bg-secondary/50 rounded-xl p-1 border border-border/30">
          <button
            onClick={() => onViewModeChange("grid")}
            className={cn(
              "p-2 rounded-lg transition-all",
              viewMode === "grid" 
                ? "bg-primary/20 text-primary shadow-sm" 
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/80"
            )}
          >
            <Grid3X3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onViewModeChange("list")}
            className={cn(
              "p-2 rounded-lg transition-all",
              viewMode === "list" 
                ? "bg-primary/20 text-primary shadow-sm" 
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/80"
            )}
          >
            <List className="w-4 h-4" />
          </button>
        </div>

        {/* Sort Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
              <SlidersHorizontal className="w-4 h-4" />
              排序
              <ChevronDown className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="glass border-border/50">
            {sortOptions.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={() => onSortChange(option.value)}
                className={cn(
                  "cursor-pointer",
                  sortBy === option.value && "text-primary"
                )}
              >
                {option.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Right Section - Actions */}
      <div className="flex items-center gap-3">
        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Upload Button */}
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button className="bg-gradient-to-r from-primary to-accent text-primary-foreground gap-2 shadow-lg shadow-primary/20">
            <Upload className="w-4 h-4" />
            上传
          </Button>
        </motion.div>

        {/* Notifications */}
        <button className="relative p-2 text-muted-foreground hover:text-foreground transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-accent rounded-full" />
        </button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 p-1 rounded-xl hover:bg-secondary/50 transition-colors">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <User className="w-4 h-4 text-primary-foreground" />
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="glass border-border/50 w-48">
            <div className="px-3 py-2 border-b border-border/50">
              <p className="text-sm font-medium text-foreground">用户名</p>
              <p className="text-xs text-muted-foreground">user@example.com</p>
            </div>
            <DropdownMenuItem className="cursor-pointer">个人设置</DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer">账户管理</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer text-destructive">退出登录</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
