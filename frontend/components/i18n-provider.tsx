"use client"

import { useEffect } from "react"
import { useAtom } from "jotai"
import { LOCALE_STORAGE_KEY, parseLocale, type Locale } from "@/lib/i18n"
import { localeAtom } from "@/stores/i18n-atoms"

interface I18nContextValue {
  locale: Locale
  setLocale: (next: Locale) => void
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useAtom(localeAtom)

  useEffect(() => {
    const savedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY)
    setLocaleState(parseLocale(savedLocale))
  }, [])

  useEffect(() => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  }, [locale])

  return <>{children}</>
}

export function useI18n() {
  const [locale, setLocaleState] = useAtom(localeAtom)
  const setLocale = (next: Locale) => setLocaleState(parseLocale(next))

  return { locale, setLocale } as I18nContextValue
}
