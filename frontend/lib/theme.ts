export type AppTheme = "light" | "dark"

export const DEFAULT_THEME: AppTheme = "dark"
export const THEME_STORAGE_KEY = "nexus-theme"

export function parseTheme(value: string | null): AppTheme {
  return value === "light" ? "light" : "dark"
}

export function getStoredTheme(): AppTheme {
  if (typeof window === "undefined") {
    return DEFAULT_THEME
  }
  return parseTheme(window.localStorage.getItem(THEME_STORAGE_KEY))
}

export function applyThemeToDocument(theme: AppTheme) {
  if (typeof document === "undefined") {
    return
  }

  const root = document.documentElement
  root.classList.remove("dark", "light")
  root.classList.add(theme)
  root.style.colorScheme = theme
}
