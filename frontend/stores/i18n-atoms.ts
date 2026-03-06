import { atom } from "jotai"
import { getPreferredLocale, type Locale } from "@/lib/i18n"

export const localeAtom = atom<Locale>(getPreferredLocale())
