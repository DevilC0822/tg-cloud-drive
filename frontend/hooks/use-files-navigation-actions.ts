import { useCallback } from "react"
import type { Dispatch, SetStateAction } from "react"
import type { FilesSortBy } from "@/lib/files"

interface UseFilesNavigationActionsOptions {
  pageCount: number
  sortBy: FilesSortBy
  setFolderRouteClearing: Dispatch<SetStateAction<boolean>>
  setSelectedIds: Dispatch<SetStateAction<string[]>>
  setPagination: Dispatch<SetStateAction<{ page: number; pageSize: number; totalCount: number; totalPages: number }>>
  setSearchQuery: Dispatch<SetStateAction<string>>
  setSortBy: Dispatch<SetStateAction<FilesSortBy>>
  setSortOrder: Dispatch<SetStateAction<"asc" | "desc">>
  setSection: Dispatch<SetStateAction<"all" | "starred" | "shared" | "vault">>
  updateFolderRoute: (nextFolderId: string | null, replace?: boolean) => void
}

export function useFilesNavigationActions({
  pageCount,
  sortBy,
  setFolderRouteClearing,
  setSelectedIds,
  setPagination,
  setSearchQuery,
  setSortBy,
  setSortOrder,
  setSection,
  updateFolderRoute,
}: UseFilesNavigationActionsOptions) {
  const toggleSelectFile = useCallback((fileId: string) => {
    setSelectedIds((prev) => (prev.includes(fileId) ? prev.filter((id) => id !== fileId) : [...prev, fileId]))
  }, [setSelectedIds])

  const clearSelection = useCallback(() => {
    setSelectedIds([])
  }, [setSelectedIds])

  const openFolder = useCallback((folderId: string) => {
    updateFolderRoute(folderId)
    setPagination((prev) => ({ ...prev, page: 1 }))
    setSelectedIds([])
  }, [setPagination, setSelectedIds, updateFolderRoute])

  const navigateBreadcrumb = useCallback((folderId: string) => {
    const resolved = folderId === "root" ? null : folderId
    updateFolderRoute(resolved)
    setPagination((prev) => ({ ...prev, page: 1 }))
    setSelectedIds([])
  }, [setPagination, setSelectedIds, updateFolderRoute])

  const updateSearch = useCallback((value: string) => {
    setSearchQuery(value)
    setPagination((prev) => ({ ...prev, page: 1 }))
  }, [setPagination, setSearchQuery])

  const updateSort = useCallback((nextSortBy: FilesSortBy) => {
    if (sortBy === nextSortBy) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))
    } else {
      setSortBy(nextSortBy)
      setSortOrder("asc")
    }
    setPagination((prev) => ({ ...prev, page: 1 }))
  }, [setPagination, setSortBy, setSortOrder, sortBy])

  const updateSection = useCallback((nextSection: "all" | "starred" | "shared" | "vault") => {
    setSection(nextSection)
    setFolderRouteClearing(true)
    updateFolderRoute(null, true)
    setPagination((prev) => ({ ...prev, page: 1 }))
    setSelectedIds([])
  }, [setFolderRouteClearing, setPagination, setSection, setSelectedIds, updateFolderRoute])

  const changePage = useCallback((nextPage: number) => {
    const bounded = Math.min(Math.max(1, nextPage), pageCount)
    setPagination((prev) => ({ ...prev, page: bounded }))
  }, [pageCount, setPagination])

  const changePageSize = useCallback((nextPageSize: number) => {
    const pageSize = Math.max(10, nextPageSize)
    setPagination((prev) => ({ ...prev, pageSize, page: 1 }))
  }, [setPagination])

  return {
    toggleSelectFile,
    clearSelection,
    openFolder,
    navigateBreadcrumb,
    updateSearch,
    updateSort,
    updateSection,
    changePage,
    changePageSize,
  }
}
