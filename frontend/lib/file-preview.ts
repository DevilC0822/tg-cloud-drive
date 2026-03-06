import type { FileItem } from "@/lib/files"

export type FilePreviewKind = "image" | "gif" | "video" | "audio" | "text" | "torrent" | "unsupported" | "folder"

export const SUPPORTED_PREVIEW_FORMATS = {
  image: [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg"],
  video: [".mp4", ".mov", ".m4v", ".webm", ".mkv", ".avi", ".mpeg", ".mpg", ".3gp"],
  audio: [".mp3", ".m4a", ".wav", ".flac", ".aac", ".ogg", ".opus"],
  text: [
    ".txt",
    ".md",
    ".json",
    ".yaml",
    ".yml",
    ".xml",
    ".csv",
    ".log",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".go",
    ".py",
    ".java",
    ".c",
    ".cpp",
    ".rs",
    ".css",
    ".html",
    ".sql",
    ".sh",
  ],
  torrent: [".torrent"],
} as const

const TEXT_MIME_SET = new Set([
  "application/json",
  "application/xml",
  "application/x-yaml",
  "application/yaml",
  "application/x-sh",
  "application/javascript",
])

const GIF_MIME_SET = new Set(["image/gif", "image/webp"])
const TORRENT_MIME_SET = new Set(["application/x-bittorrent", "application/x-torrent"])

function normalizeMimeType(rawMime: string | null | undefined) {
  if (!rawMime) {
    return ""
  }

  const cleaned = rawMime.toLowerCase().trim()
  const separatorIndex = cleaned.indexOf(";")
  if (separatorIndex >= 0) {
    return cleaned.slice(0, separatorIndex).trim()
  }
  return cleaned
}

function fileExtension(fileName: string) {
  const dotIndex = fileName.lastIndexOf(".")
  if (dotIndex < 0 || dotIndex === fileName.length - 1) {
    return ""
  }
  return fileName.slice(dotIndex).toLowerCase()
}

function matchExtension(fileName: string, extList: readonly string[]) {
  const ext = fileExtension(fileName)
  return ext.length > 0 && extList.includes(ext)
}

export function buildItemContentUrl(itemId: string, download = false) {
  const query = download ? "?download=1" : ""
  return `/api/items/${encodeURIComponent(itemId)}/content${query}`
}

export function isTorrentPreviewable(item: FileItem) {
  const mimeType = normalizeMimeType(item.mimeType)
  if (TORRENT_MIME_SET.has(mimeType)) {
    return true
  }
  return matchExtension(item.name, SUPPORTED_PREVIEW_FORMATS.torrent)
}

export function isGifLike(item: FileItem) {
  const mimeType = normalizeMimeType(item.mimeType)
  if (GIF_MIME_SET.has(mimeType)) {
    return true
  }
  return matchExtension(item.name, [".gif", ".webp"])
}

export function isTextPreviewable(item: FileItem) {
  const mimeType = normalizeMimeType(item.mimeType)
  if (mimeType.startsWith("text/")) {
    return true
  }
  if (TEXT_MIME_SET.has(mimeType)) {
    return true
  }
  return matchExtension(item.name, SUPPORTED_PREVIEW_FORMATS.text)
}

export function detectFilePreviewKind(item: FileItem): FilePreviewKind {
  if (item.type === "folder") {
    return "folder"
  }

  if (isTorrentPreviewable(item)) {
    return "torrent"
  }

  if (item.type === "video") {
    return "video"
  }

  if (item.type === "audio") {
    return "audio"
  }

  if (item.type === "image") {
    return isGifLike(item) ? "gif" : "image"
  }

  if (item.type === "code" || isTextPreviewable(item)) {
    return "text"
  }

  return "unsupported"
}
