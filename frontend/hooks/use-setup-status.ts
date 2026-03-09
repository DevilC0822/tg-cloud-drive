import { useCallback, useEffect, useRef, useState } from "react"
import { ApiError } from "@/lib/api"
import { fetchSetupStatus } from "@/lib/setup-api"

interface SetupStatusState {
  checked: boolean
  loading: boolean
  initialized: boolean
  error: string
}

const INITIAL_STATE: SetupStatusState = {
  checked: false,
  loading: true,
  initialized: false,
  error: "",
}

function readStatusError(error: unknown) {
  if (error instanceof ApiError && error.message) {
    return error.message
  }
  if (error instanceof Error && error.message) {
    return error.message
  }
  return "Failed to load setup status"
}

export function useSetupStatus() {
  const [state, setState] = useState(INITIAL_STATE)
  const initializedRef = useRef(false)

  const refreshStatus = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: "" }))
    try {
      const next = await fetchSetupStatus()
      setState({
        checked: true,
        loading: false,
        initialized: next.initialized,
        error: "",
      })
      return next
    } catch (error: unknown) {
      const message = readStatusError(error)
      setState((prev) => ({
        ...prev,
        checked: true,
        loading: false,
        error: message,
      }))
      throw error
    }
  }, [])

  useEffect(() => {
    if (initializedRef.current) {
      return
    }
    initializedRef.current = true
    void refreshStatus()
  }, [refreshStatus])

  const markInitialized = useCallback(() => {
    setState({
      checked: true,
      loading: false,
      initialized: true,
      error: "",
    })
  }, [])

  return {
    ...state,
    refreshStatus,
    markInitialized,
  }
}
