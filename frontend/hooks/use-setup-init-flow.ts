import { useCallback, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ApiError } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import {
  initializeSetup,
  readSetupConnectionDetails,
  testSetupConnection,
  type SetupConnectionDetails,
} from "@/lib/setup-api"
import {
  buildSetupConnectionPayload,
  buildSetupFingerprint,
  buildSetupInitPayload,
  createSetupForm,
  type SetupFormState,
} from "@/lib/setup-form"
import type { SetupText } from "@/lib/setup-i18n"

interface SetupInitFlowOptions {
  text: SetupText
  markInitialized: () => void
  refreshStatus: () => Promise<unknown>
}

export interface SetupInitFlowState {
  form: SetupFormState
  testing: boolean
  submitting: boolean
  actionError: string
  result: SetupConnectionDetails | null
  resultStale: boolean
  canInitialize: boolean
  updateField: <K extends keyof SetupFormState>(
    field: K,
    value: SetupFormState[K],
  ) => void
  testConnection: () => Promise<void>
  initialize: () => Promise<void>
}

function readSetupError(error: unknown, fallback: string) {
  if (error instanceof ApiError && error.message) {
    return error.message
  }
  if (error instanceof Error && error.message) {
    return error.message
  }
  return fallback
}

function createActionError(
  message: string,
  details: SetupConnectionDetails | null,
) {
  return {
    message,
    details,
  }
}

export function useSetupInitFlow(options: SetupInitFlowOptions) {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [form, setForm] = useState(createSetupForm)
  const [testing, setTesting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState("")
  const [result, setResult] = useState<SetupConnectionDetails | null>(null)
  const [testedFingerprint, setTestedFingerprint] = useState<string | null>(null)
  const currentFingerprint = useMemo(() => buildSetupFingerprint(form), [form])
  const resultStale = Boolean(result) && testedFingerprint !== currentFingerprint
  const canInitialize = Boolean(result?.overallOk) && !resultStale && !submitting

  const updateField = useCallback(
    <K extends keyof SetupFormState>(field: K, value: SetupFormState[K]) => {
      setForm((prev) => ({ ...prev, [field]: value }))
      setActionError("")
    },
    [],
  )

  const testConnection = useCallback(async () => {
    setTesting(true)
    setActionError("")
    try {
      const payload = buildSetupConnectionPayload(form, options.text)
      const response = await testSetupConnection(payload)
      setResult(response.details)
      setTestedFingerprint(currentFingerprint)
      const toastTitle = response.ok
        ? options.text.testSuccess
        : response.details.summary || options.text.testFailure
      toast({
        title: toastTitle,
        variant: response.ok ? "default" : "destructive",
      })
    } catch (error: unknown) {
      const message = readSetupError(error, options.text.testFailure)
      const details = readSetupConnectionDetails(error)
      setResult(details)
      setTestedFingerprint(currentFingerprint)
      setActionError(message)
      toast({ title: message, variant: "destructive" })
    } finally {
      setTesting(false)
    }
  }, [currentFingerprint, form, options.text, toast])

  const initialize = useCallback(async () => {
    if (!result?.overallOk || resultStale) {
      setActionError(options.text.retestRequired)
      return
    }

    setSubmitting(true)
    setActionError("")
    try {
      const payload = buildSetupInitPayload(form, options.text)
      await initializeSetup(payload)
      options.markInitialized()
      void options.refreshStatus()
      toast({ title: options.text.initSuccess })
      navigate("/files", { replace: true })
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 409) {
        setActionError(options.text.alreadyInitialized)
        await options.refreshStatus()
        toast({ title: options.text.alreadyInitialized, variant: "destructive" })
        return
      }

      const failure = createActionError(
        readSetupError(error, options.text.testFailure),
        readSetupConnectionDetails(error),
      )
      setActionError(failure.message)
      if (failure.details) {
        setResult(failure.details)
        setTestedFingerprint(currentFingerprint)
      }
      toast({ title: failure.message, variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }, [
    currentFingerprint,
    form,
    navigate,
    options,
    result?.overallOk,
    resultStale,
    toast,
  ])

  const flow: SetupInitFlowState = {
    form,
    testing,
    submitting,
    actionError,
    result,
    resultStale,
    canInitialize,
    updateField,
    testConnection,
    initialize,
  }

  return flow
}
