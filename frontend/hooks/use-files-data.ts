import { useCallback, useEffect, useMemo } from "react"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { useSearchParams } from "react-router-dom"
import { createFolderItem, fetchFilesItems, fetchFoldersIndex } from "@/lib/files-api"
import { fetchStorageStats } from "@/lib/profile-api"
import { isForbidden, isUnauthorized, keepExistingSelectedIds } from "@/hooks/files-data-utils"
import { useFilesFolderRoute } from "@/hooks/use-files-folder-route"
import { authCheckedAtom, authenticatedAtom } from "@/stores/auth-atoms"
import {
  filesBreadcrumbsAtom,
  filesCurrentFolderIdAtom,
  filesDisplayItemsAtom,
  filesErrorAtom,
  filesFolderRouteClearingAtom,
  filesFoldersAtom,
  filesItemsAtom,
  filesLoadingAtom,
  filesPaginationAtom,
  filesSearchQueryAtom,
  filesSectionAtom,
  filesSelectedFileIdsAtom,
  filesSortByAtom,
  filesSortOrderAtom,
  filesStorageStatsAtom,
  filesViewModeAtom,
} from "@/stores/files-atoms"
import { useFilesVaultState } from "@/hooks/use-files-vault-state"
import { useFilesNavigationActions } from "@/hooks/use-files-navigation-actions"

export function useFilesData() {
  const [searchParams, setSearchParams] = useSearchParams()
  const authChecked = useAtomValue(authCheckedAtom)
  const authenticated = useAtomValue(authenticatedAtom)
  const setAuthenticated = useSetAtom(authenticatedAtom)
  const [items, setItems] = useAtom(filesItemsAtom)
  const [folders, setFolders] = useAtom(filesFoldersAtom)
  const [currentFolderId, setCurrentFolderId] = useAtom(filesCurrentFolderIdAtom)
  const [folderRouteClearing, setFolderRouteClearing] = useAtom(filesFolderRouteClearingAtom)
  const [viewMode, setViewMode] = useAtom(filesViewModeAtom)
  const [section, setSection] = useAtom(filesSectionAtom)
  const [searchQuery, setSearchQuery] = useAtom(filesSearchQueryAtom)
  const [sortBy, setSortBy] = useAtom(filesSortByAtom)
  const [sortOrder, setSortOrder] = useAtom(filesSortOrderAtom)
  const [pagination, setPagination] = useAtom(filesPaginationAtom)
  const [loading, setLoading] = useAtom(filesLoadingAtom)
  const [error, setError] = useAtom(filesErrorAtom)
  const [selectedIds, setSelectedIds] = useAtom(filesSelectedFileIdsAtom)
  const setStorageStats = useSetAtom(filesStorageStatsAtom)
  const {
    vaultStatusLoading,
    vaultUnlocking,
    vaultEnabled,
    vaultUnlocked,
    vaultExpiresAt,
    vaultError,
    refreshVaultStatus,
    unlockVault,
    lockVault,
  } = useFilesVaultState({
    authChecked,
    authenticated,
    section,
    setAuthenticated,
  })
  const breadcrumbs = useAtomValue(filesBreadcrumbsAtom)
  const displayItems = useAtomValue(filesDisplayItemsAtom)
  const { currentFolderIdRef, routeFolderId, clearCurrentFolderRoute, updateFolderRoute } = useFilesFolderRoute({
    currentFolderId,
    folderRouteClearing,
    searchParams,
    setCurrentFolderId,
    setFolderRouteClearing,
    setSearchParams,
  })

  const refreshFolders = useCallback(async () => {
    const scope = section === "vault" ? "vault" : "files"
    const nextFolders = await fetchFoldersIndex(scope)
    setFolders(nextFolders)
    if (currentFolderIdRef.current && !nextFolders.some((folder) => folder.id === currentFolderIdRef.current)) {
      clearCurrentFolderRoute()
    }
  }, [clearCurrentFolderRoute, section, setFolders])

  const refreshItems = useCallback(async () => {
    if (!authChecked || !authenticated) {
      setItems([])
      setError("")
      setPagination((prev) => ({ ...prev, totalCount: 0, totalPages: 1, page: 1 }))
      setLoading(false)
      return
    }

    const isVaultSection = section === "vault"
    if (isVaultSection && (!vaultEnabled || !vaultUnlocked)) {
      setItems([])
      setError("")
      setPagination((prev) => ({ ...prev, totalCount: 0, totalPages: 1, page: 1 }))
      setLoading(false)
      return
    }

    setLoading(true)
    setError("")
    try {
      const response = await fetchFilesItems({
        view: isVaultSection ? "vault" : "files",
        parentId: currentFolderIdRef.current,
        search: searchQuery,
        sortBy,
        sortOrder,
        page: pagination.page,
        pageSize: pagination.pageSize,
      })
      setItems(response.items)
      setPagination(response.pagination)
    } catch (err: unknown) {
      if (isUnauthorized(err)) {
        setAuthenticated(false)
      }
      if (isVaultSection && isForbidden(err)) {
        await refreshVaultStatus()
      }
      setItems([])
      setError(err instanceof Error ? err.message : "Failed to load files")
    } finally {
      setLoading(false)
    }
  }, [
    authChecked,
    authenticated,
    pagination.page,
    pagination.pageSize,
    refreshVaultStatus,
    searchQuery,
    section,
    setAuthenticated,
    setError,
    setItems,
    setLoading,
    setPagination,
    sortBy,
    sortOrder,
    vaultEnabled,
    vaultUnlocked,
  ])

  const refreshStorageStats = useCallback(async () => {
    try {
      const stats = await fetchStorageStats()
      setStorageStats(stats)
    } catch {
      // sidebar stats should not block main file flow
    }
  }, [setStorageStats])

  useEffect(() => {
    if (!authChecked || !authenticated) {
      return
    }

    refreshFolders().catch((err: unknown) => {
      if (isUnauthorized(err)) {
        setAuthenticated(false)
      }
    })
    refreshStorageStats().catch(() => {})
  }, [authChecked, authenticated, refreshFolders, refreshStorageStats, setAuthenticated])

  useEffect(() => {
    setPagination((prev) => {
      if (prev.page === 1) {
        return prev
      }
      return { ...prev, page: 1 }
    })
  }, [currentFolderId, searchQuery, section, setPagination, sortBy, sortOrder])

  useEffect(() => {
    if (folderRouteClearing) {
      return
    }
    if (routeFolderId !== currentFolderId) {
      return
    }
    void refreshItems()
  }, [currentFolderId, folderRouteClearing, refreshItems, routeFolderId])

  useEffect(() => {
    setSelectedIds((prev) => keepExistingSelectedIds(prev, displayItems))
  }, [displayItems, setSelectedIds])

  const pageCount = useMemo(() => Math.max(1, pagination.totalPages), [pagination.totalPages])
  const {
    toggleSelectFile,
    clearSelection,
    openFolder,
    navigateBreadcrumb,
    updateSearch,
    updateSort,
    updateSection,
    changePage,
    changePageSize,
  } = useFilesNavigationActions({
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
  })

  const createFolder = useCallback(async (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return null
    if (section === "vault") {
      throw new Error("Please switch to files view before creating a folder")
    }
    const created = await createFolderItem(currentFolderId, trimmed)
    await refreshFolders()
    await refreshItems()
    return created
  }, [currentFolderId, refreshFolders, refreshItems, section])

  const resolvedError = section === "vault" ? (vaultError || error) : error

  return {
    items,
    folders,
    viewMode,
    setViewMode,
    section,
    setSection: updateSection,
    searchQuery,
    setSearchQuery: updateSearch,
    sortBy,
    sortOrder,
    setSortBy: updateSort,
    loading,
    error: resolvedError,
    pagination,
    breadcrumbs,
    displayItems,
    selectedIds,
    toggleSelectFile,
    clearSelection,
    openFolder,
    navigateBreadcrumb,
    changePage,
    changePageSize,
    refreshFolders,
    refreshItems,
    currentFolderId,
    createFolder,
    vaultStatusLoading,
    vaultUnlocking,
    vaultEnabled,
    vaultUnlocked,
    vaultExpiresAt,
    refreshVaultStatus,
    unlockVault,
    lockVault,
  }
}
