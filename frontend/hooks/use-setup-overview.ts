import { useCallback, useEffect, useState } from "react"
import { ApiError } from "@/lib/api"
import { fetchServiceAccess, type ServiceAccess } from "@/lib/profile-api"

function readOverviewError(error: unknown) {
  if (error instanceof ApiError && error.message) {
    return error.message
  }
  if (error instanceof Error && error.message) {
    return error.message
  }
  return "Failed to load setup overview"
}

export function useSetupOverview(enabled: boolean) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [serviceAccess, setServiceAccess] = useState<ServiceAccess | null>(null)

  const reload = useCallback(async () => {
    if (!enabled) {
      return null
    }

    setLoading(true)
    setError("")
    try {
      const next = await fetchServiceAccess()
      setServiceAccess(next)
      return next
    } catch (error: unknown) {
      setError(readOverviewError(error))
      return null
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      setError("")
      setServiceAccess(null)
      return
    }
    void reload()
  }, [enabled, reload])

  return {
    loading,
    error,
    serviceAccess,
    reload,
  }
}
