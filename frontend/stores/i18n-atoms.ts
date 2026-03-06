import { atom } from "jotai"
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n"

export const localeAtom = atom<Locale>(DEFAULT_LOCALE)
