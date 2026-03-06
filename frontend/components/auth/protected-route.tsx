import { ReactNode, useEffect } from "react"
import { useLocation } from "react-router-dom"
import { useI18n } from "@/components/i18n-provider"
import { authMessages } from "@/lib/i18n"
import { useAuth } from "@/hooks/use-auth"

interface ProtectedRouteProps {
  children: ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { pathname } = useLocation()
  const { locale } = useI18n()
  const text = authMessages[locale]
  const { authChecked, authChecking, authenticated, requireAuth } = useAuth()

  useEffect(() => {
    if (!authChecked || authChecking || authenticated) {
      return
    }
    requireAuth(pathname)
  }, [authChecked, authChecking, authenticated, pathname, requireAuth])

  if (!authChecked || authChecking) {
    return (
      <main className="relative flex min-h-screen items-center justify-center px-6 pt-24">
        <div className="glass-card rounded-2xl px-6 py-4 text-sm text-muted-foreground">{text.checking}</div>
      </main>
    )
  }

  if (!authenticated) {
    return (
      <main className="relative flex min-h-screen items-center justify-center px-6 pt-24">
        <div className="glass-card rounded-2xl px-6 py-5 text-center">
          <h2 className="text-base font-semibold text-foreground">{text.requiredTitle}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{text.requiredDescription}</p>
        </div>
      </main>
    )
  }

  return <>{children}</>
}
