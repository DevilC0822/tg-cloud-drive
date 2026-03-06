import { useCallback, useEffect, useState } from "react"
import { ApiError } from "@/lib/api"
import { fetchVaultStatus, lockVaultSession, unlockVaultSession } from "@/lib/files-api"
import type { FilesSection } from "@/lib/files"

interface UseFilesVaultStateOptions {
  authChecked: boolean
  authenticated: boolean
  section: FilesSection
  setAuthenticated: (value: boolean) => void
}

function readError(error: unknown, fallback: string) {
  if (error instanceof ApiError && error.message) return error.message
  if (error instanceof Error && error.message) return error.message
  return fallback
}

function isUnauthorized(error: unknown) {
  return error instanceof ApiError && error.status === 401
}

export function useFilesVaultState({
  authChecked,
  authenticated,
  section,
  setAuthenticated,
}: UseFilesVaultStateOptions) {
  const [vaultStatusLoading, setVaultStatusLoading] = useState(false)
  const [vaultUnlocking, setVaultUnlocking] = useState(false)
  const [vaultEnabled, setVaultEnabled] = useState(false)
  const [vaultUnlocked, setVaultUnlocked] = useState(false)
  const [vaultExpiresAt, setVaultExpiresAt] = useState("")
  const [vaultError, setVaultError] = useState("")

  const resetVaultState = useCallback(() => {
    setVaultEnabled(false)
    setVaultUnlocked(false)
    setVaultExpiresAt("")
    setVaultError("")
  }, [])

  const refreshVaultStatus = useCallback(async () => {
    if (!authChecked || !authenticated) {
      resetVaultState()
      return
    }
    setVaultStatusLoading(true)
    setVaultError("")
    try {
      const status = await fetchVaultStatus()
      setVaultEnabled(Boolean(status.enabled))
      setVaultUnlocked(Boolean(status.enabled && status.unlocked))
      setVaultExpiresAt(status.expiresAt || "")
    } catch (error: unknown) {
      if (isUnauthorized(error)) {
        setAuthenticated(false)
      }
      setVaultError(readError(error, "Failed to load vault status"))
      setVaultEnabled(false)
      setVaultUnlocked(false)
      setVaultExpiresAt("")
    } finally {
      setVaultStatusLoading(false)
    }
  }, [authChecked, authenticated, resetVaultState, setAuthenticated])

  const unlockVault = useCallback(async (password: string) => {
    const trimmed = password.trim()
    if (!trimmed) {
      throw new Error("Password is required")
    }
    setVaultUnlocking(true)
    setVaultError("")
    try {
      const response = await unlockVaultSession(trimmed)
      setVaultEnabled(true)
      setVaultUnlocked(true)
      setVaultExpiresAt(response.expiresAt || "")
    } catch (error: unknown) {
      if (isUnauthorized(error)) {
        setAuthenticated(false)
      }
      const message = readError(error, "Failed to unlock vault")
      setVaultError(message)
      throw new Error(message)
    } finally {
      setVaultUnlocking(false)
    }
  }, [setAuthenticated])

  const lockVault = useCallback(async () => {
    setVaultError("")
    try {
      await lockVaultSession()
      setVaultUnlocked(false)
      setVaultExpiresAt("")
    } catch (error: unknown) {
      if (isUnauthorized(error)) {
        setAuthenticated(false)
      }
      const message = readError(error, "Failed to lock vault")
      setVaultError(message)
      throw new Error(message)
    }
  }, [setAuthenticated])

  useEffect(() => {
    if (!authChecked || !authenticated) {
      resetVaultState()
      setVaultStatusLoading(false)
      return
    }
    if (section !== "vault") {
      setVaultError("")
      return
    }
    void refreshVaultStatus()
  }, [authChecked, authenticated, refreshVaultStatus, resetVaultState, section])

  return {
    vaultStatusLoading,
    vaultUnlocking,
    vaultEnabled,
    vaultUnlocked,
    vaultExpiresAt,
    vaultError,
    refreshVaultStatus,
    unlockVault,
    lockVault,
  }
}
