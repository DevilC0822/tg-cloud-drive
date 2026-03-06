import { atom } from "jotai"
import type {
  BreadcrumbItem,
  FileItem,
  FilesPagination,
  FilesSection,
  FilesSortBy,
  FilesSortOrder,
  FilesViewMode,
} from "@/lib/files"
import type { StorageStats } from "@/lib/profile-api"

const EMPTY_PAGINATION: FilesPagination = {
  page: 1,
  pageSize: 24,
  totalCount: 0,
  totalPages: 1,
}

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

function buildFolderIndex(folders: FileItem[]) {
  const map = new Map<string, FileItem>()
  folders.forEach((folder) => {
    map.set(folder.id, folder)
  })
  return map
}

function buildBreadcrumbs(currentFolderId: string | null, index: Map<string, FileItem>) {
  const breadcrumbs: BreadcrumbItem[] = [{ id: "root", name: "Home", path: "/" }]
  if (!currentFolderId) return breadcrumbs

  const chain: FileItem[] = []
  let pointer = index.get(currentFolderId)
  while (pointer) {
    chain.push(pointer)
    pointer = pointer.parentId ? index.get(pointer.parentId) : undefined
  }

  chain.reverse().forEach((folder) => {
    breadcrumbs.push({ id: folder.id, name: folder.name, path: folder.path })
  })

  return breadcrumbs
}

export const filesItemsAtom = atom<FileItem[]>([])
export const filesFoldersAtom = atom<FileItem[]>([])
export const filesCurrentFolderIdAtom = atom<string | null>(null)
export const filesFolderRouteClearingAtom = atom(false)

export const filesViewModeAtom = atom<FilesViewMode>("grid")
export const filesSectionAtom = atom<FilesSection>("all")
export const filesSearchQueryAtom = atom("")
export const filesSortByAtom = atom<FilesSortBy>("date")
export const filesSortOrderAtom = atom<FilesSortOrder>("desc")

export const filesSelectedFileIdsAtom = atom<string[]>([])

export const filesPaginationAtom = atom<FilesPagination>(EMPTY_PAGINATION)
export const filesLoadingAtom = atom(false)
export const filesErrorAtom = atom("")

export const filesStorageStatsAtom = atom<StorageStats>(EMPTY_STORAGE_STATS)

export const filesUploadDialogOpenAtom = atom(false)

export const filesFolderIndexAtom = atom((get) => {
  const folders = get(filesFoldersAtom)
  return buildFolderIndex(folders)
})

export const filesBreadcrumbsAtom = atom((get) => {
  const currentFolderId = get(filesCurrentFolderIdAtom)
  const folderIndex = get(filesFolderIndexAtom)
  return buildBreadcrumbs(currentFolderId, folderIndex)
})

export const filesDisplayItemsAtom = atom((get) => {
  const section = get(filesSectionAtom)
  const source = get(filesItemsAtom)

  if (section === "vault") {
    return source
  }

  if (section === "shared") {
    return source.filter((item) => item.isShared)
  }

  if (section === "starred") {
    return source.filter((item) => item.starred)
  }

  return source
})

export const filesSelectedItemsAtom = atom((get) => {
  const selected = new Set(get(filesSelectedFileIdsAtom))
  return get(filesDisplayItemsAtom).filter((item) => selected.has(item.id))
})

export const filesSectionTitleAtom = atom((get) => {
  const section = get(filesSectionAtom)
  if (section === "vault") return "Vault"
  if (section === "shared") return "Shared"
  if (section === "starred") return "Starred"
  return "Files"
})
