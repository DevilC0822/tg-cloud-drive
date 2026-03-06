import { useEffect, useRef } from "react"
import { useAtom } from "jotai"
import { LOCALE_STORAGE_KEY, getPreferredLocale, parseLocale, type Locale } from "@/lib/i18n"
import { localeAtom } from "@/stores/i18n-atoms"

interface I18nContextValue {
  locale: Locale
  setLocale: (next: Locale) => void
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useAtom(localeAtom)
  const initializedRef = useRef(false)

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    if (!initializedRef.current) {
      initializedRef.current = true
      const preferredLocale = getPreferredLocale()
      if (preferredLocale !== locale) {
        setLocaleState(preferredLocale)
      }
      return
    }

    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  }, [locale, setLocaleState])

  return <>{children}</>
}

export function useI18n() {
  const [locale, setLocaleState] = useAtom(localeAtom)
  const setLocale = (next: Locale) => setLocaleState(parseLocale(next))

  return { locale, setLocale } as I18nContextValue
}
