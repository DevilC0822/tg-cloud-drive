export type AppTheme = "light" | "dark" | "auto"
export type ResolvedTheme = "light" | "dark"

const THEME_SEQUENCE = ["light", "dark", "auto"] as const
const MIN_PRIMARY_HUE = 0
const MAX_PRIMARY_HUE = 360

export const DEFAULT_THEME: AppTheme = "auto"
export const DEFAULT_PRIMARY_HUE = 180
export const THEME_STORAGE_KEY = "nexus-theme"
export const PRIMARY_HUE_STORAGE_KEY = "app-primary-hue"

function syncThemeColorMeta(root: HTMLElement) {
  const themeChrome = window.getComputedStyle(root).getPropertyValue("--theme-chrome").trim()
  if (!themeChrome) {
    return
  }

  let meta = document.querySelector<HTMLMetaElement>("meta[name='theme-color']")
  if (!meta) {
    meta = document.createElement("meta")
    meta.name = "theme-color"
    document.head.appendChild(meta)
  }
  meta.content = themeChrome
}

function prefersDarkMode() {
  if (typeof window === "undefined") {
    return true
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

function clampPrimaryHue(value: number) {
  return Math.min(MAX_PRIMARY_HUE, Math.max(MIN_PRIMARY_HUE, value))
}

export function parseTheme(value: string | null | undefined): AppTheme {
  if (value === "light" || value === "dark" || value === "auto") {
    return value
  }
  return DEFAULT_THEME
}

export function getResolvedTheme(theme: AppTheme): ResolvedTheme {
  if (theme === "auto") {
    return prefersDarkMode() ? "dark" : "light"
  }
  return theme
}

export function getNextTheme(theme: AppTheme): AppTheme {
  const currentIndex = THEME_SEQUENCE.indexOf(theme)
  return THEME_SEQUENCE[(currentIndex + 1) % THEME_SEQUENCE.length]
}

export function getStoredTheme(): AppTheme {
  if (typeof window === "undefined") {
    return DEFAULT_THEME
  }
  return parseTheme(window.localStorage.getItem(THEME_STORAGE_KEY))
}

export function applyThemeToDocument(theme: AppTheme) {
  const resolvedTheme = getResolvedTheme(theme)

  if (typeof document === "undefined") {
    return resolvedTheme
  }

  const root = document.documentElement
  root.classList.remove("dark", "light")
  root.classList.add(resolvedTheme)
  root.style.colorScheme = resolvedTheme
  root.dataset.theme = theme
  root.dataset.resolvedTheme = resolvedTheme
  syncThemeColorMeta(root)
  return resolvedTheme
}

export function parsePrimaryHue(value: string | number | null | undefined) {
  const parsed =
    typeof value === "number" ? value : Number.parseInt(value ?? "", 10)

  if (!Number.isFinite(parsed)) {
    return DEFAULT_PRIMARY_HUE
  }

  return clampPrimaryHue(parsed)
}

export function getStoredPrimaryHue() {
  if (typeof window === "undefined") {
    return DEFAULT_PRIMARY_HUE
  }
  return parsePrimaryHue(window.localStorage.getItem(PRIMARY_HUE_STORAGE_KEY))
}

export function applyPrimaryHueToDocument(hue: number) {
  const parsedHue = parsePrimaryHue(hue)

  if (typeof document === "undefined") {
    return parsedHue
  }

  document.documentElement.style.setProperty("--primary-hue", String(parsedHue))
  syncThemeColorMeta(document.documentElement)
  return parsedHue
}
