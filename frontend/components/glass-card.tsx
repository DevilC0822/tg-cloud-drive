import { motion } from "framer-motion"
import { glassGlowClasses, type GlassGlowTone } from "@/lib/palette"
import { cn } from "@/lib/utils"

interface GlassCardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
  glow?: GlassGlowTone
  delay?: number
}

export function GlassCard({ 
  children, 
  className = "", 
  hover = true,
  glow = "cyan",
  delay = 0
}: GlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      whileHover={hover ? { scale: 1.02, y: -5 } : undefined}
      className={cn(
        "glass-card rounded-2xl p-6 transition-all duration-300",
        hover && glassGlowClasses[glow],
        className
      )}
    >
      {children}
    </motion.div>
  )
}
