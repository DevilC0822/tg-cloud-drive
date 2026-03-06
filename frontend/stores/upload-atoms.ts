import { atom } from "jotai"
import type { TorrentPreview } from "@/lib/torrent-api"

export type UploadTaskStatus = "pending" | "uploading" | "completed" | "error"

export interface UploadTask {
  id: string
  file: File
  progress: number
  status: UploadTaskStatus
  startedAt: number
  updatedAt: number
  finishedAt?: number
  error?: string
  targetParentId?: string | null
  uploadSessionId?: string
  transferJobId?: string
  uploadedChunkCount?: number
  totalChunkCount?: number
}

export const uploadTasksAtom = atom<UploadTask[]>([])
export const uploadDragActiveAtom = atom(false)

export const uploadPanelExpandedAtom = atom(true)

export const torrentUrlAtom = atom("")
export const torrentFileAtom = atom<File | null>(null)
export const torrentPreviewAtom = atom<TorrentPreview | null>(null)
export const torrentSelectedIndexesAtom = atom<number[]>([])
export const torrentSubmittingAtom = atom(false)
export const torrentPreviewLoadingAtom = atom(false)
export const torrentErrorAtom = atom("")
