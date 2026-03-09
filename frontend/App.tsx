import { Link, Navigate, Outlet, Route, Routes } from "react-router-dom"
import { useEffect } from "react"
import HomePage from "@/pages/home-page"
import FilesPage from "@/pages/files-page"
import FilePreviewPage from "@/pages/file-preview-page"
import SettingsPage from "@/pages/settings-page"
import TransfersPage from "@/pages/transfers-page"
import SetupPage from "@/pages/setup-page"
import { ThemeProvider } from "@/components/theme-provider"
import { I18nProvider, useI18n } from "@/components/i18n-provider"
import { AppShell } from "@/components/app-shell"
import { LoginDialog } from "@/components/auth/login-dialog"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { SetupBootScreen } from "@/components/setup/setup-boot-screen"
import { Toaster } from "@/components/ui/toaster"
import { useAuth } from "@/hooks/use-auth"
import { useSetupStatus } from "@/hooks/use-setup-status"
import { setupMessages } from "@/lib/setup-i18n"

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

function MainLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}

function SetupCompletionGate({
  ready,
  initialized,
}: {
  ready: boolean
  initialized: boolean
}) {
  if (!ready) {
    return null
  }
  if (!initialized) {
    return <Navigate to="/setup" replace />
  }
  return <Outlet />
}

function AppRoutes({
  initialized,
  markInitialized,
  refreshStatus,
  ready,
}: {
  initialized: boolean
  markInitialized: () => void
  refreshStatus: () => Promise<unknown>
  ready: boolean
}) {
  return (
    <Routes>
      <Route
        path="/setup"
        element={
          <SetupPage
            initialized={initialized}
            markInitialized={markInitialized}
            refreshStatus={refreshStatus}
          />
        }
      />
      <Route element={<SetupCompletionGate ready={ready} initialized={initialized} />}>
        <Route element={<MainLayout />}>
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
        </Route>
      </Route>
    </Routes>
  )
}

function AppContent() {
  const { locale } = useI18n()
  const { bootstrapAuth } = useAuth()
  const setup = useSetupStatus()
  const text = setupMessages[locale]

  useEffect(() => {
    if (!setup.checked || !setup.initialized) {
      return
    }
    void bootstrapAuth()
  }, [bootstrapAuth, setup.checked, setup.initialized])

  if (!setup.checked || setup.loading || (!setup.initialized && setup.error)) {
    return (
      <SetupBootScreen
        text={text}
        loading={setup.loading}
        error={setup.error}
        onRetry={() => void setup.refreshStatus()}
      />
    )
  }

  return (
    <>
      <AppRoutes
        initialized={setup.initialized}
        markInitialized={setup.markInitialized}
        refreshStatus={setup.refreshStatus}
        ready={setup.checked && !setup.loading}
      />
      <LoginDialog />
      <Toaster />
    </>
  )
}

export default function App() {
  return (
    <I18nProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </I18nProvider>
  )
}
