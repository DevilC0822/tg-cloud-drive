import { atom } from "jotai"
import { atomWithStorage } from "jotai/utils"
import type { AppTheme, ResolvedTheme } from "@/lib/theme"
import {
  DEFAULT_PRIMARY_HUE,
  DEFAULT_THEME,
  PRIMARY_HUE_STORAGE_KEY,
  getResolvedTheme,
} from "@/lib/theme"

export const themeAtom = atom<AppTheme>(DEFAULT_THEME)
export const resolvedThemeAtom = atom<ResolvedTheme>(getResolvedTheme(DEFAULT_THEME))
export const themeReadyAtom = atom(false)
export const primaryHueAtom = atomWithStorage<number>(
  PRIMARY_HUE_STORAGE_KEY,
  DEFAULT_PRIMARY_HUE,
)
