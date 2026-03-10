import type { LocalFolderManifest } from "@/lib/upload-folder-manifest"

export function buildFolderFileLookup(folder: LocalFolderManifest) {
  return new Map(folder.files.map((item) => [item.relativePath, item.file]))
}

export function createFolderUploadState() {
  let completedItems = 0
  let failedItems = 0
  let firstError = ""

  const markCompleted = () => {
    completedItems += 1
  }

  const markFailed = (message: string) => {
    failedItems += 1
    if (!firstError) {
      firstError = message
    }
  }

  return {
    markCompleted,
    markFailed,
    getCompletedItems: () => completedItems,
    getFailedItems: () => failedItems,
    getFirstError: () => firstError,
  }
}
