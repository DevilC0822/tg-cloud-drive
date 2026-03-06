import { useCallback } from "react"
import { useAtom } from "jotai"
import { apiFetchJson, ApiError } from "@/lib/api"
import {
  authCheckedAtom,
  authCheckingAtom,
  authenticatedAtom,
  authIntentPathAtom,
  loginDialogOpenAtom,
  loginErrorAtom,
  loginSubmittingAtom,
} from "@/stores/auth-atoms"

function getErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof ApiError && error.message) {
    return error.message
  }
  return fallbackMessage
}

export function useAuth() {
  const [authChecked, setAuthChecked] = useAtom(authCheckedAtom)
  const [authChecking, setAuthChecking] = useAtom(authCheckingAtom)
  const [authenticated, setAuthenticated] = useAtom(authenticatedAtom)
  const [loginDialogOpen, setLoginDialogOpen] = useAtom(loginDialogOpenAtom)
  const [loginSubmitting, setLoginSubmitting] = useAtom(loginSubmittingAtom)
  const [loginError, setLoginError] = useAtom(loginErrorAtom)
  const [authIntentPath, setAuthIntentPath] = useAtom(authIntentPathAtom)

  const bootstrapAuth = useCallback(async () => {
    if (authChecking || authChecked) {
      return
    }

    setAuthChecking(true)
    try {
      const res = await apiFetchJson<{ authenticated: boolean }>("/api/auth/me")
      setAuthenticated(!!res.authenticated)
    } catch {
      setAuthenticated(false)
    } finally {
      setAuthChecked(true)
      setAuthChecking(false)
    }
  }, [authChecked, authChecking, setAuthChecked, setAuthChecking, setAuthenticated])

  const openLoginDialog = useCallback(
    (path?: string) => {
      if (path) {
        setAuthIntentPath(path)
      }
      setLoginError("")
      setLoginDialogOpen(true)
    },
    [setAuthIntentPath, setLoginDialogOpen, setLoginError],
  )

  const closeLoginDialog = useCallback(() => {
    setLoginError("")
    setLoginDialogOpen(false)
  }, [setLoginDialogOpen, setLoginError])

  const login = useCallback(
    async (password: string) => {
      const nextPassword = password.trim()
      if (!nextPassword) {
        const message = "Password is required"
        setLoginError(message)
        return { ok: false as const, message }
      }

      setLoginSubmitting(true)
      setLoginError("")
      try {
        await apiFetchJson<{ ok: boolean }>("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: nextPassword }),
        })
        setAuthenticated(true)
        setAuthChecked(true)
        setLoginDialogOpen(false)
        return { ok: true as const }
      } catch (error: unknown) {
        setAuthenticated(false)
        const message = getErrorMessage(error, "登录失败")
        setLoginError(message)
        return { ok: false as const, message }
      } finally {
        setLoginSubmitting(false)
      }
    },
    [setAuthChecked, setAuthenticated, setLoginDialogOpen, setLoginError, setLoginSubmitting],
  )

  const logout = useCallback(async () => {
    try {
      await apiFetchJson<{ ok: boolean }>("/api/auth/logout", { method: "POST" })
    } catch {
      // 忽略退出接口错误，优先回退本地状态
    } finally {
      setAuthenticated(false)
      setAuthChecked(true)
      setAuthIntentPath(null)
      setLoginError("")
      setLoginDialogOpen(false)
      setLoginSubmitting(false)
    }
  }, [
    setAuthChecked,
    setAuthenticated,
    setAuthIntentPath,
    setLoginDialogOpen,
    setLoginError,
    setLoginSubmitting,
  ])

  const requireAuth = useCallback(
    (pathname: string) => {
      if (authenticated) {
        return true
      }
      openLoginDialog(pathname)
      return false
    },
    [authenticated, openLoginDialog],
  )

  return {
    authChecked,
    authChecking,
    authenticated,
    loginDialogOpen,
    loginSubmitting,
    loginError,
    authIntentPath,
    bootstrapAuth,
    openLoginDialog,
    closeLoginDialog,
    login,
    logout,
    requireAuth,
  }
}
