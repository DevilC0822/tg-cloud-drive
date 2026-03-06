import { motion } from "framer-motion"
import { floatingOrbVars, type OrbTone } from "@/lib/palette"

interface FloatingOrbProps {
  size?: number
  color?: OrbTone
  delay?: number
  className?: string
}

export function FloatingOrb({ 
  size = 200, 
  color = "cyan", 
  delay = 0,
  className = "" 
}: FloatingOrbProps) {
  const colorSet = floatingOrbVars[color]

  return (
    <motion.div
      className={`absolute rounded-full blur-3xl pointer-events-none ${className}`}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle, ${colorSet.core} 0%, ${colorSet.fade} 50%, transparent 70%)`,
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
