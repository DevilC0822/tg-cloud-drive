"use client"

import { motion } from "framer-motion"

interface FloatingOrbProps {
  size?: number
  color?: "cyan" | "pink" | "orange"
  delay?: number
  className?: string
}

export function FloatingOrb({ 
  size = 200, 
  color = "cyan", 
  delay = 0,
  className = "" 
}: FloatingOrbProps) {
  const colors = {
    cyan: {
      primary: "rgba(0, 255, 255, 0.3)",
      secondary: "rgba(0, 200, 255, 0.1)",
      glow: "rgba(0, 255, 255, 0.5)",
    },
    pink: {
      primary: "rgba(255, 100, 200, 0.3)",
      secondary: "rgba(255, 50, 150, 0.1)",
      glow: "rgba(255, 100, 200, 0.5)",
    },
    orange: {
      primary: "rgba(255, 180, 100, 0.3)",
      secondary: "rgba(255, 150, 50, 0.1)",
      glow: "rgba(255, 180, 100, 0.5)",
    },
  }

  const colorSet = colors[color]

  return (
    <motion.div
      className={`absolute rounded-full blur-3xl pointer-events-none ${className}`}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle, ${colorSet.primary} 0%, ${colorSet.secondary} 50%, transparent 70%)`,
        boxShadow: `0 0 ${size / 2}px ${colorSet.glow}`,
      }}
      animate={{
        y: [0, -30, 0],
        x: [0, 15, 0],
        scale: [1, 1.1, 1],
        opacity: [0.6, 0.8, 0.6],
      }}
      transition={{
        duration: 8,
        delay,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    />
  )
}
