import { ReactNode } from "react"
import { AnimatedBackground } from "@/components/animated-background"
import { Header } from "@/components/header"
import { PageTransition } from "@/components/page-transition"
import { FloatingOrb } from "@/components/floating-orb"

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen relative overflow-x-clip">
      {/* Shared animated background - persists across routes */}
      <AnimatedBackground />
      
      {/* Global floating orbs - fixed position to avoid clipping */}
      <div className="fixed inset-0 z-[1] pointer-events-none overflow-visible">
        <FloatingOrb size={400} color="cyan" delay={0} className="top-20 -left-40" />
        <FloatingOrb size={300} color="pink" delay={2} className="top-40 -right-20" />
        <FloatingOrb size={250} color="orange" delay={4} className="bottom-20 left-1/4" />
        <FloatingOrb size={200} color="cyan" delay={6} className="bottom-40 right-1/4" />
      </div>
      
      {/* Shared header - persists across routes */}
      <Header />
      
      {/* Page content with transition - transparent to show background */}
      <div className="relative z-10">
        <PageTransition>
          {children}
        </PageTransition>
      </div>
    </div>
  )
}
