import { useEffect, useRef, useState } from "react"
import { useAppTheme } from "@/hooks/use-app-theme"

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
  connectionColorPrefix: string
  connectionOpacityFactor: number
  bgColor: string
  initialBg: string
}

function createThemePalette(isDark: boolean): ThemePalette {
  if (isDark) {
    return {
      colors: [
        "rgba(0, 255, 255, 0.6)",
        "rgba(255, 100, 200, 0.6)",
        "rgba(255, 180, 100, 0.6)",
      ],
      connectionColorPrefix: "rgba(0, 255, 255,",
      connectionOpacityFactor: 0.3,
      bgColor: "rgba(10, 10, 20, 0.1)",
      initialBg: "rgba(10, 10, 20, 1)",
    }
  }

  return {
    colors: [
      "rgba(0, 180, 180, 0.4)",
      "rgba(200, 80, 160, 0.4)",
      "rgba(200, 140, 80, 0.4)",
    ],
    connectionColorPrefix: "rgba(0, 150, 150,",
    connectionOpacityFactor: 0.2,
    bgColor: "rgba(250, 250, 255, 0.15)",
    initialBg: "rgba(250, 250, 255, 1)",
  }
}

export function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { theme, isDark, ready } = useAppTheme()
  const [mounted, setMounted] = useState(false)
  const animationRef = useRef<number | null>(null)
  const particlesRef = useRef<Particle[]>([])
  const themePaletteRef = useRef<ThemePalette>(createThemePalette(true))

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    themePaletteRef.current = createThemePalette(theme === "dark")
  }, [theme])

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
      const { connectionColorPrefix, connectionOpacityFactor } = themePaletteRef.current
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const distance = Math.sqrt(dx * dx + dy * dy)

          if (distance < 150) {
            const opacity = (1 - distance / 150) * connectionOpacityFactor
            ctx.beginPath()
            ctx.strokeStyle = `${connectionColorPrefix}${opacity})`
            ctx.lineWidth = 0.5
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.stroke()
          }
        }
      }
    }

    const animate = () => {
      const { bgColor, colors } = themePaletteRef.current
      ctx.fillStyle = bgColor
      ctx.fillRect(0, 0, canvas.width, canvas.height)

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

    // Initial clear with theme-appropriate color
    ctx.fillStyle = themePaletteRef.current.initialBg
    ctx.fillRect(0, 0, canvas.width, canvas.height)

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
        background: isDark 
          ? "linear-gradient(135deg, #0a0a14 0%, #1a0a20 50%, #0a1020 100%)" 
          : "linear-gradient(135deg, #f8fafc 0%, #f0f4ff 50%, #faf5ff 100%)"
      }}
    />
  )
}
