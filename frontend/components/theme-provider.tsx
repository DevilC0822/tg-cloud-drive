"use client"

import { useInitializeTheme } from "@/hooks/use-app-theme"

interface ThemeProviderProps {
  children: React.ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  useInitializeTheme()
  return <>{children}</>
}
