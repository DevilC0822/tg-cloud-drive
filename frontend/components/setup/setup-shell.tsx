import type { ReactNode } from "react"
import { AppShell } from "@/components/app-shell"

interface SetupShellProps {
  children: ReactNode
}

export function SetupShell({ children }: SetupShellProps) {
  return <AppShell>{children}</AppShell>
}
