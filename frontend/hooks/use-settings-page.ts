import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react"
import { ApiError } from "@/lib/api"
import type { ServiceAccess } from "@/lib/profile-api"
import { fetchSettings, patchSettings, type RuntimeSettings } from "@/lib/settings-api"
import type { SettingsText } from "@/lib/settings-i18n"
import {
  buildRuntimePayload,
  buildServicePayload,
  createRuntimeForm,
  createServiceForm,
  DEFAULT_RUNTIME_SETTINGS,
  isServiceDetails,
  readApiMessage,
  serviceToForm,
  type RuntimeFormState,
  type ServiceFormState,
  type ServiceSwitchResult,
} from "@/lib/settings-form"
import { useHeaderProfile } from "@/hooks/use-header-profile"
import { useToast } from "@/hooks/use-toast"

interface SettingsState {
  loading: boolean
  savingRuntime: boolean
  savingService: boolean
  loadError: string
  runtimeSettings: RuntimeSettings
  runtimeForm: RuntimeFormState
  serviceForm: ServiceFormState
  serviceResult: ServiceSwitchResult | null
}

const EMPTY_SERVICE_FORM: ServiceFormState = {
  accessMethod: "official_bot_api",
  tgBotToken: "",
  tgStorageChatId: "",
  tgApiId: "",
  tgApiHash: "",
  tgApiBaseUrl: "",
}

function useSettingsState() {
  return useState<SettingsState>({
    loading: true,
    savingRuntime: false,
    savingService: false,
    loadError: "",
    runtimeSettings: DEFAULT_RUNTIME_SETTINGS,
    runtimeForm: createRuntimeForm(DEFAULT_RUNTIME_SETTINGS),
    serviceForm: EMPTY_SERVICE_FORM,
    serviceResult: null,
  })
}

function updateState(setState: Dispatch<SetStateAction<SettingsState>>, patch: Partial<SettingsState>) {
  setState((prev) => ({ ...prev, ...patch }))
}

function useReloadAction(
  text: SettingsText,
  setState: Dispatch<SetStateAction<SettingsState>>,
  setServiceAccess: (value: ServiceAccess) => void,
) {
	return useCallback(async () => {
		updateState(setState, { loading: true, loadError: "" })
		try {
			const settings = await fetchSettings()
			const access = settings.serviceAccess
			updateState(setState, {
				runtimeSettings: settings.runtime,
				runtimeForm: createRuntimeForm(settings.runtime),
				serviceForm: serviceToForm(access),
			})
			setServiceAccess(access)
    } catch (error: unknown) {
      updateState(setState, { loadError: readApiMessage(error, text.loadFailed) })
    } finally {
      updateState(setState, { loading: false })
    }
  }, [setServiceAccess, text.loadFailed])
}

function useFormUpdaters(setState: Dispatch<SetStateAction<SettingsState>>) {
  const updateRuntimeForm = useCallback(<K extends keyof RuntimeFormState>(field: K, value: RuntimeFormState[K]) => {
    setState((prev) => ({ ...prev, runtimeForm: { ...prev.runtimeForm, [field]: value } }))
  }, [setState])

  const updateServiceForm = useCallback(<K extends keyof ServiceFormState>(field: K, value: ServiceFormState[K]) => {
    setState((prev) => ({ ...prev, serviceForm: { ...prev.serviceForm, [field]: value } }))
  }, [setState])

  return { updateRuntimeForm, updateServiceForm }
}

function useRuntimeSaveAction(
  text: SettingsText,
  setState: Dispatch<SetStateAction<SettingsState>>,
  runtimeForm: RuntimeFormState,
  toast: ReturnType<typeof useToast>["toast"],
) {
	return useCallback(async () => {
		updateState(setState, { savingRuntime: true })
		try {
			const response = await patchSettings({ runtime: buildRuntimePayload(runtimeForm, text) })
			const saved = response.settings.runtime
			updateState(setState, { runtimeSettings: saved, runtimeForm: createRuntimeForm(saved) })
			toast({ title: text.saveSuccess })
    } catch (error: unknown) {
      toast({ title: readApiMessage(error, text.saveFailed), variant: "destructive" })
    } finally {
      updateState(setState, { savingRuntime: false })
    }
  }, [runtimeForm, setState, text, toast])
}

function useServiceSaveAction(
  text: SettingsText,
  setState: Dispatch<SetStateAction<SettingsState>>,
  serviceForm: ServiceFormState,
  setServiceAccess: (value: ServiceAccess) => void,
  toast: ReturnType<typeof useToast>["toast"],
) {
	return useCallback(async () => {
		updateState(setState, { savingService: true })
		try {
			const response = await patchSettings({ serviceAccess: buildServicePayload(serviceForm, text) })
			const switchResult = response.switchResult
			const testedAt = switchResult?.details?.testedAt || new Date().toISOString()
			const successMessage = switchResult?.rolledBack ? text.serviceSaveRolledBack : (switchResult?.message || text.serviceSaveSuccess)
			updateState(setState, {
				serviceForm: createServiceForm(serviceToForm(response.settings.serviceAccess)),
				serviceResult: {
					testedAt,
					message: successMessage,
					rolledBack: Boolean(switchResult?.rolledBack),
					details: switchResult?.details || null,
				},
			})
			setServiceAccess(response.settings.serviceAccess)
			toast({ title: successMessage, variant: switchResult?.rolledBack ? "destructive" : "default" })
		} catch (error: unknown) {
      const payload = error instanceof ApiError ? error.payload : null
      const details = isServiceDetails(payload?.details) ? payload.details : null
      updateState(setState, {
        serviceResult: {
          testedAt: details?.testedAt || new Date().toISOString(),
          message: readApiMessage(error, text.saveFailed),
          rolledBack: Boolean(payload?.rolledBack),
          details,
        },
      })
      toast({ title: readApiMessage(error, text.saveFailed), variant: "destructive" })
    } finally {
      updateState(setState, { savingService: false })
    }
  }, [serviceForm, setServiceAccess, setState, text, toast])
}

export function useSettingsPage(text: SettingsText) {
  const { toast } = useToast()
  const { setServiceAccess } = useHeaderProfile()
  const [state, setState] = useSettingsState()
  const reload = useReloadAction(text, setState, setServiceAccess)
  const { updateRuntimeForm, updateServiceForm } = useFormUpdaters(setState)
  const saveRuntime = useRuntimeSaveAction(text, setState, state.runtimeForm, toast)
  const saveService = useServiceSaveAction(text, setState, state.serviceForm, setServiceAccess, toast)

  useEffect(() => {
    void reload()
  }, [reload])

  return {
    ...state,
    reload,
    updateRuntimeForm,
    updateServiceForm,
    saveRuntime,
    saveService,
  }
}
