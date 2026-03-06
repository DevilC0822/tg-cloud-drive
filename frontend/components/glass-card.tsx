"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface GlassCardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
  glow?: "cyan" | "pink" | "orange" | "none"
  delay?: number
}

export function GlassCard({ 
  children, 
  className = "", 
  hover = true,
  glow = "cyan",
  delay = 0
}: GlassCardProps) {
  const glowColors = {
    cyan: "hover:shadow-[0_0_30px_rgba(0,255,255,0.2)]",
    pink: "hover:shadow-[0_0_30px_rgba(255,100,200,0.2)]",
    orange: "hover:shadow-[0_0_30px_rgba(255,180,100,0.2)]",
    none: "",
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      whileHover={hover ? { scale: 1.02, y: -5 } : undefined}
      className={cn(
        "glass-card rounded-2xl p-6 transition-all duration-300",
        hover && glowColors[glow],
        className
      )}
    >
      {children}
    </motion.div>
  )
}
