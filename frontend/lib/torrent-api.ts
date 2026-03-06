import { apiFetchJson } from "@/lib/api"

export interface TorrentPreviewFile {
  fileIndex: number
  filePath: string
  fileName: string
  fileSize: number
}

export interface TorrentPreview {
  torrentName: string
  infoHash: string
  totalSize: number
  isPrivate: boolean
  trackerHosts: string[]
  files: TorrentPreviewFile[]
}

export interface TorrentTask {
  id: string
  sourceType: "url" | "file"
  sourceUrl?: string | null
  torrentName: string
  infoHash: string
  targetChatId: string
  targetParentId?: string | null
  submittedBy: string
  estimatedSize: number
  downloadedBytes: number
  progress: number
  status: string
  error?: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateTorrentTaskInput {
  parentId?: string | null
  torrentUrl?: string
  torrentFile?: File | null
  selectedFileIndexes?: number[]
  submittedBy?: string
}

function buildTorrentFormData(input: CreateTorrentTaskInput) {
  const formData = new FormData()
  const torrentUrl = input.torrentUrl?.trim() || ""
  if (input.parentId) formData.append("parentId", input.parentId)
  if (torrentUrl) formData.append("torrentUrl", torrentUrl)
  if (input.torrentFile) formData.append("torrentFile", input.torrentFile, input.torrentFile.name)
  if (input.submittedBy?.trim()) formData.append("submittedBy", input.submittedBy.trim())

  const selected = Array.from(new Set(input.selectedFileIndexes || []))
    .filter((value) => Number.isInteger(value) && value >= 0)
    .sort((a, b) => a - b)
  if (selected.length > 0) {
    formData.append("selectedFileIndexes", JSON.stringify(selected))
  }

  return formData
}

export async function previewTorrent(input: CreateTorrentTaskInput) {
  const response = await apiFetchJson<{ preview: TorrentPreview }>("/api/torrents/preview", {
    method: "POST",
    body: buildTorrentFormData(input),
  })
  return response.preview
}

export async function createTorrentTask(input: CreateTorrentTaskInput) {
  const response = await apiFetchJson<{ task: TorrentTask }>("/api/torrents/tasks", {
    method: "POST",
    body: buildTorrentFormData(input),
  })
  return response.task
}
