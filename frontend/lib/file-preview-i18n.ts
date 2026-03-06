import type { Locale } from "@/lib/i18n"

export interface FilePreviewMessages {
  backToFiles: string
  loading: string
  loadFailed: string
  retry: string
  openInNewTab: string
  download: string
  refresh: string
  fileSize: string
  updatedAt: string
  mimeType: string
  notFoundTitle: string
  notFoundDescription: string
  kindLabels: {
    image: string
    gif: string
    video: string
    audio: string
    text: string
    torrent: string
    unsupported: string
    folder: string
  }
  textLoading: string
  textEmpty: string
  textCopy: string
  textCopied: string
  textCopyFailed: string
  textTruncated: (maxSize: string) => string
  torrentLoading: string
  torrentError: string
  torrentFiles: (count: number) => string
  torrentTrackers: (count: number) => string
  torrentSize: string
  torrentInfoHash: string
  torrentVisibilityPublic: string
  torrentVisibilityPrivate: string
  unsupportedTitle: string
  unsupportedDescription: string
  supportedFormats: string
}

export const filePreviewMessages: Record<Locale, FilePreviewMessages> = {
  en: {
    backToFiles: "Back to files",
    loading: "Loading file preview...",
    loadFailed: "Failed to load file details",
    retry: "Retry",
    openInNewTab: "Open in new tab",
    download: "Download",
    refresh: "Refresh",
    fileSize: "Size",
    updatedAt: "Updated",
    mimeType: "MIME",
    notFoundTitle: "File not found",
    notFoundDescription: "The file may have been deleted or moved.",
    kindLabels: {
      image: "Image",
      gif: "Animation",
      video: "Video",
      audio: "Audio",
      text: "Text",
      torrent: "Torrent",
      unsupported: "Unsupported",
      folder: "Folder",
    },
    textLoading: "Loading text content...",
    textEmpty: "This file has no text content.",
    textCopy: "Copy text",
    textCopied: "Copied",
    textCopyFailed: "Copy failed",
    textTruncated: (maxSize) => `Showing first ${maxSize} for performance.`,
    torrentLoading: "Parsing torrent metadata...",
    torrentError: "Unable to parse torrent metadata",
    torrentFiles: (count) => `${count} files`,
    torrentTrackers: (count) => `${count} trackers`,
    torrentSize: "Total size",
    torrentInfoHash: "Info hash",
    torrentVisibilityPublic: "Public torrent",
    torrentVisibilityPrivate: "Private torrent",
    unsupportedTitle: "Preview unavailable",
    unsupportedDescription: "This file type is not previewable yet. You can still download it.",
    supportedFormats: "Supported formats",
  },
  zh: {
    backToFiles: "返回文件页",
    loading: "正在加载预览...",
    loadFailed: "加载文件详情失败",
    retry: "重试",
    openInNewTab: "新标签页打开",
    download: "下载",
    refresh: "刷新",
    fileSize: "大小",
    updatedAt: "更新时间",
    mimeType: "MIME",
    notFoundTitle: "文件不存在",
    notFoundDescription: "该文件可能已被删除或移动。",
    kindLabels: {
      image: "图片",
      gif: "动图",
      video: "视频",
      audio: "音频",
      text: "文本",
      torrent: "种子",
      unsupported: "不支持",
      folder: "文件夹",
    },
    textLoading: "正在读取文本内容...",
    textEmpty: "该文件暂无文本内容。",
    textCopy: "复制文本",
    textCopied: "已复制",
    textCopyFailed: "复制失败",
    textTruncated: (maxSize) => `为保证性能，仅展示前 ${maxSize} 内容。`,
    torrentLoading: "正在解析种子元数据...",
    torrentError: "无法解析种子元数据",
    torrentFiles: (count) => `${count} 个文件`,
    torrentTrackers: (count) => `${count} 个 Tracker`,
    torrentSize: "总大小",
    torrentInfoHash: "Info Hash",
    torrentVisibilityPublic: "公开种子",
    torrentVisibilityPrivate: "私有种子",
    unsupportedTitle: "暂不支持预览",
    unsupportedDescription: "该文件类型暂不支持预览，你仍然可以直接下载。",
    supportedFormats: "当前支持格式",
  },
}
