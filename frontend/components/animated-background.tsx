import { useEffect, useRef, useState } from "react"
import { useAppTheme } from "@/hooks/use-app-theme"
import { animatedBackgroundVars } from "@/lib/palette"

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  colorIndex: number
  opacity: number
}

interface ThemePalette {
  colors: string[]
  connectionColors: string[]
}

function readThemeValue(styles: CSSStyleDeclaration, name: string, fallback = "transparent") {
  const value = styles.getPropertyValue(name).trim()
  return value || fallback
}

function createThemePalette(): ThemePalette {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return {
      colors: ["transparent", "transparent", "transparent"],
      connectionColors: ["transparent", "transparent", "transparent"],
    }
  }

  const styles = window.getComputedStyle(document.documentElement)
  return {
    colors: [
      readThemeValue(styles, "--tone-info-particle"),
      readThemeValue(styles, "--tone-video-particle"),
      readThemeValue(styles, "--tone-archive-particle"),
    ],
    connectionColors: [
      readThemeValue(styles, "--tone-info-connection"),
      readThemeValue(styles, "--tone-video-connection"),
      readThemeValue(styles, "--tone-archive-connection"),
    ],
  }
}

export function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { resolvedTheme, isDark, ready } = useAppTheme()
  const [mounted, setMounted] = useState(false)
  const animationRef = useRef<number | null>(null)
  const particlesRef = useRef<Particle[]>([])
  const themePaletteRef = useRef<ThemePalette>(createThemePalette())

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    themePaletteRef.current = createThemePalette()
  }, [resolvedTheme])

  useEffect(() => {
    if (!mounted || !ready) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const setCanvasSize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    setCanvasSize()
    window.addEventListener("resize", setCanvasSize)

    // Create particles only once
    if (particlesRef.current.length === 0) {
      for (let i = 0; i < 80; i++) {
        particlesRef.current.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          radius: Math.random() * 2 + 1,
          colorIndex: Math.floor(Math.random() * 3),
          opacity: Math.random() * 0.5 + 0.2,
        })
      }
    }

    const particles = particlesRef.current

    const drawConnections = () => {
      const { connectionColors } = themePaletteRef.current
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const distance = Math.sqrt(dx * dx + dy * dy)

          if (distance < 150) {
            const opacity = 1 - distance / 150
            ctx.beginPath()
            ctx.save()
            ctx.globalAlpha = opacity
            ctx.strokeStyle = connectionColors[particles[i].colorIndex] || connectionColors[0]
            ctx.lineWidth = 0.5
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.stroke()
            ctx.restore()
          }
        }
      }
    }

    const animate = () => {
      const { colors } = themePaletteRef.current
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      particles.forEach((particle) => {
        particle.x += particle.vx
        particle.y += particle.vy

        if (particle.x < 0 || particle.x > canvas.width) particle.vx *= -1
        if (particle.y < 0 || particle.y > canvas.height) particle.vy *= -1

        const color = colors[particle.colorIndex]

        ctx.beginPath()
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.fill()

        // Glow effect
        const gradient = ctx.createRadialGradient(
          particle.x,
          particle.y,
          0,
          particle.x,
          particle.y,
          particle.radius * 4
        )
        gradient.addColorStop(0, color)
        gradient.addColorStop(1, "transparent")
        ctx.fillStyle = gradient
        ctx.fill()
      })

      drawConnections()
      animationRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener("resize", setCanvasSize)
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [mounted, ready])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 pointer-events-none transition-opacity duration-500"
      style={{
        backgroundColor: "var(--background)",
        backgroundImage: animatedBackgroundVars.meshGradient,
      }}
    />
  )
}
