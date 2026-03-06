import { atom } from "jotai"
import type { AppTheme } from "@/lib/theme"
import { DEFAULT_THEME } from "@/lib/theme"

export const themeAtom = atom<AppTheme>(DEFAULT_THEME)
export const themeReadyAtom = atom(false)
