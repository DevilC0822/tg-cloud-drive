import { useCallback } from "react"
import { useAtom } from "jotai"
import { ApiError } from "@/lib/api"
import { fetchServiceAccess, fetchStorageStats, type ServiceAccess, type StorageStats } from "@/lib/profile-api"
import { headerProfileErrorAtom, headerProfileLoadingAtom, headerServiceAccessAtom, headerStorageStatsAtom } from "@/stores/auth-atoms"

const PROFILE_LOAD_FAILED = "Failed to load profile data"
const STORAGE_LOAD_FAILED = "Failed to load storage stats"
const SERVICE_LOAD_FAILED = "Failed to load service access"

function readError(error: unknown, fallback: string) {
  if (error instanceof ApiError && error.message) {
    return error.message
  }
  if (error instanceof Error && error.message) {
    return error.message
  }
  return fallback
}

function resolveProfileError(
  storageResult: PromiseSettledResult<StorageStats>,
  serviceResult: PromiseSettledResult<ServiceAccess>,
) {
  if (storageResult.status === "rejected" && serviceResult.status === "rejected") {
    return PROFILE_LOAD_FAILED
  }
  if (storageResult.status === "rejected") {
    return readError(storageResult.reason, STORAGE_LOAD_FAILED)
  }
  if (serviceResult.status === "rejected") {
    return readError(serviceResult.reason, SERVICE_LOAD_FAILED)
  }
  return ""
}

function unwrapResult<T>(result: PromiseSettledResult<T>) {
  return result.status === "fulfilled" ? result.value : null
}

export function useHeaderProfile() {
  const [loading, setLoading] = useAtom(headerProfileLoadingAtom)
  const [error, setError] = useAtom(headerProfileErrorAtom)
  const [storageStats, setStorageStats] = useAtom(headerStorageStatsAtom)
  const [serviceAccess, setServiceAccess] = useAtom(headerServiceAccessAtom)

  const fetchProfileData = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [storageResult, serviceResult] = await Promise.allSettled([fetchStorageStats(), fetchServiceAccess()])
      if (storageResult.status === "fulfilled") {
        setStorageStats(storageResult.value)
      }
      if (serviceResult.status === "fulfilled") {
        setServiceAccess(serviceResult.value)
      }
      const message = resolveProfileError(storageResult, serviceResult)
      setError(message)
      return {
        stats: unwrapResult(storageResult),
        access: unwrapResult(serviceResult),
      }
    } finally {
      setLoading(false)
    }
  }, [setError, setLoading, setServiceAccess, setStorageStats])

  const updateStorage = useCallback((next: StorageStats) => {
    setStorageStats(next)
  }, [setStorageStats])

  const updateAccess = useCallback((next: ServiceAccess) => {
    setServiceAccess(next)
  }, [setServiceAccess])

  return {
    loading,
    error,
    storageStats,
    serviceAccess,
    fetchProfileData,
    setStorageStats: updateStorage,
    setServiceAccess: updateAccess,
    setError,
  }
}
