import { useCallback, useEffect } from "react"
import { useAtom } from "jotai"
import {
  applyPrimaryHueToDocument,
  applyThemeToDocument,
  getNextTheme,
  getStoredPrimaryHue,
  getStoredTheme,
  parsePrimaryHue,
  parseTheme,
  THEME_STORAGE_KEY,
  type AppTheme,
} from "@/lib/theme"
import {
  primaryHueAtom,
  resolvedThemeAtom,
  themeAtom,
  themeReadyAtom,
} from "@/stores/theme-atoms"

function useThemePersistence(ready: boolean, theme: AppTheme) {
  const [, setResolvedTheme] = useAtom(resolvedThemeAtom)

  useEffect(() => {
    if (!ready || typeof window === "undefined") {
      return
    }

    setResolvedTheme(applyThemeToDocument(theme))
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [ready, setResolvedTheme, theme])
}

function useAutoThemeListener(ready: boolean, theme: AppTheme) {
  const [, setResolvedTheme] = useAtom(resolvedThemeAtom)

  useEffect(() => {
    if (!ready || typeof window === "undefined") {
      return
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const handleChange = () => {
      if (theme === "auto") {
        setResolvedTheme(applyThemeToDocument(theme))
      }
    }

    mediaQuery.addEventListener("change", handleChange)
    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [ready, setResolvedTheme, theme])
}

function usePrimaryHueSync(ready: boolean, primaryHue: number, setPrimaryHue: (value: number) => void) {
  useEffect(() => {
    if (!ready) {
      return
    }

    const nextHue = parsePrimaryHue(primaryHue)
    applyPrimaryHueToDocument(nextHue)
    if (nextHue !== primaryHue) {
      setPrimaryHue(nextHue)
    }
  }, [primaryHue, ready, setPrimaryHue])
}

export function useInitializeTheme() {
  const [theme, setTheme] = useAtom(themeAtom)
  const [, setResolvedTheme] = useAtom(resolvedThemeAtom)
  const [ready, setReady] = useAtom(themeReadyAtom)
  const [primaryHue, setPrimaryHue] = useAtom(primaryHueAtom)

  useEffect(() => {
    if (ready) {
      return
    }

    const initialTheme = getStoredTheme()
    const initialHue = getStoredPrimaryHue()

    setTheme(initialTheme)
    setPrimaryHue(initialHue)
    setResolvedTheme(applyThemeToDocument(initialTheme))
    applyPrimaryHueToDocument(initialHue)
    setReady(true)
  }, [ready, setPrimaryHue, setReady, setResolvedTheme, setTheme])

  useThemePersistence(ready, theme)
  useAutoThemeListener(ready, theme)
  usePrimaryHueSync(ready, primaryHue, setPrimaryHue)
}

export function useAppTheme() {
  const [theme, setTheme] = useAtom(themeAtom)
  const [resolvedTheme] = useAtom(resolvedThemeAtom)
  const [ready] = useAtom(themeReadyAtom)
  const [primaryHue, setPrimaryHue] = useAtom(primaryHueAtom)

  const setThemeValue = useCallback(
    (nextTheme: AppTheme) => {
      setTheme(parseTheme(nextTheme))
    },
    [setTheme],
  )

  const toggleTheme = useCallback(() => {
    setTheme((prev) => getNextTheme(prev))
  }, [setTheme])

  return {
    theme,
    resolvedTheme,
    isDark: resolvedTheme === "dark",
    ready,
    primaryHue,
    setTheme: setThemeValue,
    toggleTheme,
    setPrimaryHue,
  }
}
