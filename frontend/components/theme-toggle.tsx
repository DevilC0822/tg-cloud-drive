import { AnimatePresence, motion } from "framer-motion"
import { Monitor, Moon, Sun } from "lucide-react"
import { useRef, useState, type FocusEvent } from "react"
import { useI18n } from "@/components/i18n-provider"
import { useAppTheme } from "@/hooks/use-app-theme"
import type { AppTheme } from "@/lib/theme"
import { cn } from "@/lib/utils"

const PANEL_OFFSET_Y = 6

type ThemeLabels = {
  light: string
  dark: string
  auto: string
  cycleTo: string
}

const THEME_LABELS: Record<"zh" | "en", ThemeLabels> = {
  zh: {
    light: "亮色",
    dark: "暗色",
    auto: "跟随系统",
    cycleTo: "切换主题",
  },
  en: {
    light: "Light",
    dark: "Dark",
    auto: "System",
    cycleTo: "Switch theme",
  },
} as const

function ThemeIcon({ theme }: { theme: AppTheme }) {
  if (theme === "light") {
    return <Sun className="h-4 w-4" />
  }
  if (theme === "dark") {
    return <Moon className="h-4 w-4" />
  }
  return <Monitor className="h-4 w-4" />
}

function ThemeOption({
  active,
  label,
  theme,
  onSelect,
}: {
  active: boolean
  label: string
  theme: AppTheme
  onSelect: (theme: AppTheme) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(theme)}
      className={cn(
        "flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
        active
          ? "bg-primary/12 text-primary"
          : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
      )}
    >
      <span
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg border transition-colors",
          active
            ? "border-primary/30 bg-primary/10"
            : "border-border/50 bg-background/60",
        )}
      >
        <ThemeIcon theme={theme} />
      </span>
      <span>{label}</span>
    </button>
  )
}

function ThemePanel({
  labels,
  open,
  theme,
  onSelect,
}: {
  labels: ThemeLabels
  open: boolean
  theme: AppTheme
  onSelect: (theme: AppTheme) => void
}) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0, y: PANEL_OFFSET_Y, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: PANEL_OFFSET_Y, scale: 0.96 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className="absolute right-0 top-full hidden pt-3 lg:block"
        >
          <div className="w-44 rounded-2xl border border-border/60 bg-background/92 p-2 shadow-2xl backdrop-blur-xl">
            <ThemeOption active={theme === "light"} label={labels.light} theme="light" onSelect={onSelect} />
            <ThemeOption active={theme === "dark"} label={labels.dark} theme="dark" onSelect={onSelect} />
            <ThemeOption active={theme === "auto"} label={labels.auto} theme="auto" onSelect={onSelect} />
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

function ThemeTrigger({
  label,
  theme,
  onClick,
}: {
  label: string
  theme: AppTheme
  onClick: () => void
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.96 }}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-secondary/55 text-foreground shadow-sm transition-colors hover:bg-secondary/80"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ opacity: 0, scale: 0.8, y: PANEL_OFFSET_Y / 2 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: -PANEL_OFFSET_Y / 2 }}
          transition={{ duration: 0.16 }}
          className="flex items-center justify-center"
        >
          <ThemeIcon theme={theme} />
        </motion.span>
      </AnimatePresence>
    </motion.button>
  )
}

export function ThemeToggle() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const { locale } = useI18n()
  const { theme, ready, toggleTheme, setTheme } = useAppTheme()
  const labels = THEME_LABELS[locale]

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget
    if (nextTarget instanceof Node && containerRef.current?.contains(nextTarget)) {
      return
    }
    setOpen(false)
  }

  if (!ready) {
    return <div className="h-9 w-9 animate-pulse rounded-xl bg-secondary/50" />
  }

  return (
    <div
      ref={containerRef}
      className="relative z-50"
      onBlur={handleBlur}
      onFocus={() => setOpen(true)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <ThemeTrigger label={`${labels.cycleTo}: ${labels[theme]}`} theme={theme} onClick={toggleTheme} />
      <ThemePanel labels={labels} open={open} theme={theme} onSelect={setTheme} />
    </div>
  )
}
