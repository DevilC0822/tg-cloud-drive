import { useCallback, useEffect } from "react"
import { useAtom } from "jotai"
import { applyThemeToDocument, getStoredTheme, parseTheme, THEME_STORAGE_KEY, type AppTheme } from "@/lib/theme"
import { themeAtom, themeReadyAtom } from "@/stores/theme-atoms"

export function useInitializeTheme() {
  const [theme, setTheme] = useAtom(themeAtom)
  const [ready, setReady] = useAtom(themeReadyAtom)

  useEffect(() => {
    if (ready) {
      return
    }

    const initialTheme = getStoredTheme()
    setTheme(initialTheme)
    applyThemeToDocument(initialTheme)
    setReady(true)
  }, [ready, setReady, setTheme])

  useEffect(() => {
    if (!ready || typeof window === "undefined") {
      return
    }

    applyThemeToDocument(theme)
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [ready, theme])
}

export function useAppTheme() {
  const [theme, setTheme] = useAtom(themeAtom)
  const [ready] = useAtom(themeReadyAtom)

  const setThemeValue = useCallback(
    (nextTheme: AppTheme) => {
      setTheme(parseTheme(nextTheme))
    },
    [setTheme],
  )

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"))
  }, [setTheme])

  return {
    theme,
    isDark: theme === "dark",
    ready,
    setTheme: setThemeValue,
    toggleTheme,
  }
}
