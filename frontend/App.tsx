import { Link, Route, Routes } from "react-router-dom"
import { useEffect, useRef } from "react"
import HomePage from "@/app/page"
import FilesPage from "@/app/files/page"
import FilePreviewPage from "@/app/files/preview/page"
import SettingsPage from "@/app/settings/page"
import TransfersPage from "@/app/transfers/page"
import { ThemeProvider } from "@/components/theme-provider"
import { I18nProvider } from "@/components/i18n-provider"
import { AppShell } from "@/components/app-shell"
import { LoginDialog } from "@/components/auth/login-dialog"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { Toaster } from "@/components/ui/toaster"
import { useAuth } from "@/hooks/use-auth"

function NotFoundPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center px-6 pt-20">
      <div className="glass-card max-w-md rounded-2xl p-8 text-center">
        <h1 className="mb-2 text-3xl font-bold text-foreground">页面不存在</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          你访问的页面不存在，请返回主页继续浏览。
        </p>
        <Link
          to="/"
          className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          返回主页
        </Link>
      </div>
    </main>
  )
}

export default function App() {
  const { bootstrapAuth } = useAuth()
  const bootstrappedRef = useRef(false)

  useEffect(() => {
    if (bootstrappedRef.current) {
      return
    }
    bootstrappedRef.current = true
    void bootstrapAuth()
  }, [bootstrapAuth])

  return (
    <I18nProvider>
      <ThemeProvider>
        <AppShell>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route
              path="/files"
              element={
                <ProtectedRoute>
                  <FilesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/files/preview/:itemId"
              element={
                <ProtectedRoute>
                  <FilePreviewPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/transfers"
              element={
                <ProtectedRoute>
                  <TransfersPage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          <LoginDialog />
          <Toaster />
        </AppShell>
      </ThemeProvider>
    </I18nProvider>
  )
}
