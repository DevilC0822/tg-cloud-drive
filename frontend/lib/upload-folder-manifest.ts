export interface LocalFolderFile {
  file: File
  relativePath: string
}

export interface LocalFolderManifest {
  rootName: string
  directories: string[]
  files: LocalFolderFile[]
  totalSize: number
}

type DataTransferItemWithEntry = DataTransferItem & {
  webkitGetAsEntry?: () => FileSystemEntry | null
}

type IterableDirectoryHandle = FileSystemDirectoryHandle & {
  values: () => AsyncIterable<FileSystemHandle>
}

declare global {
  interface Window {
    showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>
  }
}

export function supportsDirectoryPicker() {
  return typeof window !== "undefined" && "showDirectoryPicker" in window
}

export async function pickFolderManifest(): Promise<LocalFolderManifest> {
  if (!window.showDirectoryPicker) {
    throw new Error("当前浏览器不支持目录选择器")
  }

  const handle = await window.showDirectoryPicker()
  return buildFolderManifestFromDirectoryHandle(handle)
}

export async function buildFolderManifestFromDirectoryHandle(
  handle: FileSystemDirectoryHandle,
): Promise<LocalFolderManifest> {
  const directories: string[] = []
  const files: LocalFolderFile[] = []
  await walkDirectoryHandle(handle, "", directories, files)
  return finalizeFolderManifest(handle.name, directories, files)
}

export function buildFolderManifestFromInput(files: FileList | File[]): LocalFolderManifest {
  const source = Array.from(files)
  if (source.length === 0) {
    throw new Error("未选择任何文件")
  }

  const firstPath = normalizeFolderInputPath(source[0].webkitRelativePath)
  const rootName = firstPath.split("/")[0]
  if (!rootName) {
    throw new Error("当前浏览器未提供目录相对路径")
  }

  const directories = new Set<string>()
  const items = source.map((file) => {
    const normalized = normalizeFolderInputPath(file.webkitRelativePath)
    if (!normalized.startsWith(`${rootName}/`)) {
      throw new Error("目录选择结果异常")
    }
    const relativePath = normalized.slice(rootName.length + 1)
    collectParentDirectories(relativePath, directories)
    return { file, relativePath }
  })

  return finalizeFolderManifest(rootName, Array.from(directories), items)
}

export async function buildFolderManifestFromDrop(items: DataTransferItemList): Promise<LocalFolderManifest | null> {
  const entries = Array.from(items)
    .map((item) => (item as DataTransferItemWithEntry).webkitGetAsEntry?.() ?? null)
    .filter((entry): entry is FileSystemEntry => entry !== null)

  const rootEntry = entries.find((entry) => entry.isDirectory)
  if (!rootEntry) {
    return null
  }

  const extraRoots = entries.filter((entry) => entry.isDirectory && entry.fullPath !== rootEntry.fullPath)
  if (extraRoots.length > 0) {
    throw new Error("一次只能拖入一个根目录")
  }

  const directories: string[] = []
  const files: LocalFolderFile[] = []
  await walkDropEntry(rootEntry as FileSystemDirectoryEntry, "", directories, files)
  return finalizeFolderManifest(rootEntry.name, directories, files)
}

function normalizeFolderInputPath(value: string) {
  return value.replaceAll("\\", "/").replace(/^\/+|\/+$/g, "")
}

function collectParentDirectories(relativePath: string, directories: Set<string>) {
  const parts = relativePath.split("/")
  for (let index = 1; index < parts.length; index += 1) {
    directories.add(parts.slice(0, index).join("/"))
  }
}

function finalizeFolderManifest(
  rootName: string,
  directories: string[],
  files: LocalFolderFile[],
): LocalFolderManifest {
  const uniqueDirectories = new Set<string>()
  const uniqueFiles = new Map<string, File>()
  let totalSize = 0

  for (const directory of directories) {
    const normalized = normalizeRelativePath(directory)
    if (normalized) {
      uniqueDirectories.add(normalized)
    }
  }
  for (const item of files) {
    const normalized = normalizeRelativePath(item.relativePath)
    if (!normalized) {
      throw new Error("目录文件路径非法")
    }
    if (uniqueDirectories.has(normalized) || uniqueFiles.has(normalized)) {
      throw new Error(`检测到重复路径: ${normalized}`)
    }
    uniqueFiles.set(normalized, item.file)
    totalSize += item.file.size
  }

  return {
    rootName,
    directories: Array.from(uniqueDirectories).sort(),
    files: Array.from(uniqueFiles.entries())
      .map(([relativePath, file]) => ({ relativePath, file }))
      .sort((left, right) => left.relativePath.localeCompare(right.relativePath)),
    totalSize,
  }
}

function normalizeRelativePath(value: string) {
  const normalized = value.replaceAll("\\", "/").replace(/^\/+|\/+$/g, "")
  if (!normalized) {
    return ""
  }
  const parts = normalized.split("/")
  for (const part of parts) {
    if (!part || part === "." || part === "..") {
      throw new Error("目录路径非法")
    }
  }
  return parts.join("/")
}

async function walkDirectoryHandle(
  handle: FileSystemDirectoryHandle,
  currentPath: string,
  directories: string[],
  files: LocalFolderFile[],
) {
  if (currentPath) {
    directories.push(currentPath)
  }

  for await (const entry of (handle as IterableDirectoryHandle).values()) {
    const nextPath = currentPath ? `${currentPath}/${entry.name}` : entry.name
    if (entry.kind === "directory") {
      await walkDirectoryHandle(entry as FileSystemDirectoryHandle, nextPath, directories, files)
      continue
    }
    const file = await (entry as FileSystemFileHandle).getFile()
    files.push({ file, relativePath: nextPath })
  }
}

async function walkDropEntry(
  entry: FileSystemDirectoryEntry,
  currentPath: string,
  directories: string[],
  files: LocalFolderFile[],
) {
  if (currentPath) {
    directories.push(currentPath)
  }

  const children = await readAllDirectoryEntries(entry.createReader())
  for (const child of children) {
    const nextPath = currentPath ? `${currentPath}/${child.name}` : child.name
    if (child.isDirectory) {
      await walkDropEntry(child as FileSystemDirectoryEntry, nextPath, directories, files)
      continue
    }
    const file = await readDropFile(child as FileSystemFileEntry)
    files.push({ file, relativePath: nextPath })
  }
}

function readAllDirectoryEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    const items: FileSystemEntry[] = []
    const drain = () => {
      reader.readEntries(
        (entries) => {
          if (entries.length === 0) {
            resolve(items)
            return
          }
          items.push(...entries)
          drain()
        },
        (error) => reject(error),
      )
    }
    drain()
  })
}

function readDropFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => {
    entry.file(resolve, reject)
  })
}
