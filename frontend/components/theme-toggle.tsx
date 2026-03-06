"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Sun, Moon, Stars } from "lucide-react"
import { useAppTheme } from "@/hooks/use-app-theme"

export function ThemeToggle() {
  const { isDark, ready, toggleTheme } = useAppTheme()

  if (!ready) {
    return (
      <div className="w-16 h-8 rounded-full bg-secondary/50 animate-pulse" />
    )
  }

  const toggleLabel = isDark ? "切换到浅色模式" : "切换到深色模式"

  return (
    <motion.button
      onClick={toggleTheme}
      className="relative h-8 w-16 overflow-hidden rounded-full border border-border/60 p-1 transition-[background-color,border-color] duration-200 will-change-transform"
      style={{
        background: isDark
          ? "linear-gradient(135deg, oklch(0.15 0.02 280), oklch(0.2 0.03 280))"
          : "linear-gradient(135deg, oklch(0.85 0.1 60), oklch(0.9 0.08 40))",
        boxShadow: isDark
          ? "inset 0 1px 2px rgba(0,0,0,0.35)"
          : "inset 0 1px 2px rgba(0,0,0,0.08)",
      }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      aria-label={toggleLabel}
      title={toggleLabel}
    >
      <span
        className={`pointer-events-none absolute inset-0 transition-opacity duration-200 ${
          isDark ? "opacity-100" : "opacity-0"
        }`}
      >
        <span className="absolute top-1.5 right-3 h-1 w-1 rounded-full bg-white/60" />
        <span className="absolute top-3 right-5 h-0.5 w-0.5 rounded-full bg-white/45" />
        <span className="absolute bottom-2 right-4 h-0.5 w-0.5 rounded-full bg-white/50" />
      </span>

      {/* Toggle ball */}
      <motion.div
        className="relative z-10 flex h-6 w-6 items-center justify-center rounded-full will-change-transform"
        animate={{
          x: isDark ? 0 : 32,
        }}
        transition={{
          type: "spring",
          stiffness: 420,
          damping: 32,
          mass: 0.6,
        }}
        style={{
          background: isDark
            ? "linear-gradient(135deg, oklch(0.3 0.05 280), oklch(0.25 0.04 280))"
            : "linear-gradient(135deg, oklch(0.95 0.05 60), oklch(0.98 0.02 60))",
          boxShadow: isDark
            ? "0 1px 4px rgba(0,0,0,0.35), inset 0 -1px 2px rgba(0,0,0,0.2)"
            : "0 1px 4px rgba(180, 120, 60, 0.28), inset 0 -1px 2px rgba(0,0,0,0.05)",
        }}
      >
        <AnimatePresence mode="sync" initial={false}>
          {isDark ? (
            <motion.div
              key="moon"
              initial={{ opacity: 0, scale: 0.7, y: 2 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.7, y: -2 }}
              transition={{ duration: 0.2 }}
            >
              <Moon className="w-3.5 h-3.5 text-neon-cyan" />
            </motion.div>
          ) : (
            <motion.div
              key="sun"
              initial={{ opacity: 0, scale: 0.7, y: 2 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.7, y: -2 }}
              transition={{ duration: 0.2 }}
            >
              <Sun className="w-3.5 h-3.5 text-neon-orange" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.button>
  )
}

// Larger, more elaborate toggle for hero sections
export function ThemeToggleLarge() {
  const { isDark, ready, toggleTheme } = useAppTheme()

  if (!ready) {
    return (
      <div className="w-24 h-12 rounded-2xl bg-secondary/50 animate-pulse" />
    )
  }

  return (
    <motion.button
      onClick={toggleTheme}
      className="relative w-24 h-12 rounded-2xl p-1.5 overflow-hidden"
      style={{
        background: isDark 
          ? "linear-gradient(135deg, oklch(0.12 0.02 280), oklch(0.18 0.03 280))"
          : "linear-gradient(135deg, oklch(0.88 0.08 60), oklch(0.92 0.06 40))",
        border: isDark 
          ? "1px solid oklch(0.3 0.04 280 / 0.5)"
          : "1px solid oklch(0.7 0.1 60 / 0.3)",
      }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      aria-label={isDark ? "切换到浅色模式" : "切换到深色模式"}
    >
      {/* Animated background stars/rays */}
      <div className="absolute inset-0 overflow-hidden">
        <AnimatePresence>
          {isDark ? (
            // Stars for dark mode
            <>
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={`star-${i}`}
                  className="absolute w-1 h-1 rounded-full bg-white/60"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ 
                    opacity: [0.3, 0.8, 0.3], 
                    scale: [0.8, 1.2, 0.8],
                  }}
                  exit={{ opacity: 0, scale: 0 }}
                  transition={{ 
                    duration: 2 + i * 0.3,
                    repeat: Infinity,
                    delay: i * 0.2,
                  }}
                  style={{
                    top: `${15 + (i % 3) * 25}%`,
                    right: `${10 + (i % 4) * 15}%`,
                  }}
                />
              ))}
            </>
          ) : (
            // Rays for light mode
            <>
              {[...Array(8)].map((_, i) => (
                <motion.div
                  key={`ray-${i}`}
                  className="absolute w-0.5 h-6 origin-bottom"
                  style={{
                    background: "linear-gradient(to top, oklch(0.75 0.2 60 / 0.4), transparent)",
                    top: "50%",
                    left: "25%",
                    transform: `rotate(${i * 45}deg)`,
                  }}
                  initial={{ opacity: 0, scaleY: 0 }}
                  animate={{ 
                    opacity: [0.2, 0.5, 0.2], 
                    scaleY: [0.5, 1, 0.5],
                  }}
                  exit={{ opacity: 0, scaleY: 0 }}
                  transition={{ 
                    duration: 3,
                    repeat: Infinity,
                    delay: i * 0.1,
                  }}
                />
              ))}
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Toggle ball */}
      <motion.div
        className="relative w-9 h-9 rounded-xl flex items-center justify-center z-10"
        animate={{
          x: isDark ? 0 : 48,
        }}
        transition={{
          type: "spring",
          stiffness: 400,
          damping: 30,
        }}
        style={{
          background: isDark
            ? "linear-gradient(135deg, oklch(0.2 0.03 280), oklch(0.25 0.04 280))"
            : "linear-gradient(135deg, oklch(0.98 0.02 60), oklch(0.95 0.04 40))",
          boxShadow: isDark
            ? "0 4px 12px rgba(0,0,0,0.5), 0 0 20px oklch(0.7 0.25 180 / 0.3)"
            : "0 4px 12px oklch(0.75 0.2 60 / 0.4), 0 0 20px oklch(0.75 0.2 60 / 0.2)",
        }}
      >
        <AnimatePresence mode="wait">
          {isDark ? (
            <motion.div
              key="moon-large"
              initial={{ rotate: -45, opacity: 0, scale: 0.5 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: 45, opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.4, type: "spring" }}
              className="relative"
            >
              <Moon className="w-5 h-5 text-neon-cyan" />
              <Stars className="absolute -top-1 -right-1 w-3 h-3 text-neon-pink opacity-70" />
            </motion.div>
          ) : (
            <motion.div
              key="sun-large"
              initial={{ rotate: 45, opacity: 0, scale: 0.5 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: -45, opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.4, type: "spring" }}
            >
              <Sun className="w-5 h-5 text-neon-orange" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Labels */}
      <div className="absolute inset-0 flex items-center justify-between px-3 pointer-events-none">
        <motion.span
          className="text-[10px] font-medium"
          animate={{
            opacity: isDark ? 0 : 1,
            x: isDark ? -10 : 0,
            color: isDark ? "oklch(0.5 0.02 280)" : "oklch(0.4 0.1 60)",
          }}
          transition={{ duration: 0.3 }}
        >
          日间
        </motion.span>
        <motion.span
          className="text-[10px] font-medium"
          animate={{
            opacity: isDark ? 1 : 0,
            x: isDark ? 0 : 10,
            color: isDark ? "oklch(0.7 0.1 180)" : "oklch(0.5 0.02 280)",
          }}
          transition={{ duration: 0.3 }}
        >
          夜间
        </motion.span>
      </div>
    </motion.button>
  )
}
