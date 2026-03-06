import { atom } from "jotai"
import type { ServiceAccess, StorageStats } from "@/lib/profile-api"

export const authCheckedAtom = atom(false)
export const authCheckingAtom = atom(false)
export const authenticatedAtom = atom(false)
export const loginDialogOpenAtom = atom(false)
export const loginSubmittingAtom = atom(false)
export const loginErrorAtom = atom("")
export const authIntentPathAtom = atom<string | null>(null)

const EMPTY_STORAGE_STATS: StorageStats = {
  totalBytes: 0,
  totalFiles: 0,
  byType: {
    image: { bytes: 0, count: 0 },
    video: { bytes: 0, count: 0 },
    audio: { bytes: 0, count: 0 },
    document: { bytes: 0, count: 0 },
    archive: { bytes: 0, count: 0 },
    code: { bytes: 0, count: 0 },
    other: { bytes: 0, count: 0 },
  },
}

const EMPTY_SERVICE_ACCESS: ServiceAccess = {
  accessMethod: "official_bot_api",
  tgBotToken: "",
  tgStorageChatId: "",
  tgApiId: null,
  tgApiHash: "",
  tgApiBaseUrl: "",
}

export const headerProfileLoadingAtom = atom(false)
export const headerProfileErrorAtom = atom("")
export const headerStorageStatsAtom = atom<StorageStats>(EMPTY_STORAGE_STATS)
export const headerServiceAccessAtom = atom<ServiceAccess>(EMPTY_SERVICE_ACCESS)
