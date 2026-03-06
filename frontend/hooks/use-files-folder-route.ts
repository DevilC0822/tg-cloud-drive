import { useCallback, useEffect, useMemo, useRef } from "react"
import type { Dispatch, MutableRefObject, SetStateAction } from "react"
import type { SetURLSearchParams } from "react-router-dom"
import { normalizeFolderParam } from "@/hooks/files-data-utils"

interface UseFilesFolderRouteOptions {
  currentFolderId: string | null
  folderRouteClearing: boolean
  searchParams: URLSearchParams
  setCurrentFolderId: Dispatch<SetStateAction<string | null>>
  setFolderRouteClearing: Dispatch<SetStateAction<boolean>>
  setSearchParams: SetURLSearchParams
}

interface UseFilesFolderRouteResult {
  currentFolderIdRef: MutableRefObject<string | null>
  routeFolderId: string | null
  clearCurrentFolderRoute: () => void
  updateFolderRoute: (nextFolderId: string | null, replace?: boolean) => void
}

export function useFilesFolderRoute({
  currentFolderId,
  folderRouteClearing,
  searchParams,
  setCurrentFolderId,
  setFolderRouteClearing,
  setSearchParams,
}: UseFilesFolderRouteOptions): UseFilesFolderRouteResult {
  const routeFolderId = useMemo(() => normalizeFolderParam(searchParams.get("folder")), [searchParams])
  const currentFolderIdRef = useRef(currentFolderId)

  useEffect(() => {
    currentFolderIdRef.current = currentFolderId
  }, [currentFolderId])

  const updateFolderRoute = useCallback((nextFolderId: string | null, replace = false) => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous)
      if (nextFolderId) next.set("folder", nextFolderId)
      else next.delete("folder")
      return next
    }, { replace })
  }, [setSearchParams])

  const clearCurrentFolderRoute = useCallback(() => {
    currentFolderIdRef.current = null
    if (routeFolderId !== null) {
      setFolderRouteClearing(true)
      updateFolderRoute(null, true)
      return
    }
    if (currentFolderId !== null) {
      setCurrentFolderId(null)
    }
  }, [currentFolderId, routeFolderId, setCurrentFolderId, setFolderRouteClearing, updateFolderRoute])

  useEffect(() => {
    if (folderRouteClearing) {
      if (routeFolderId !== null) return
      if (currentFolderId !== null) {
        setCurrentFolderId(null)
        return
      }
      setFolderRouteClearing(false)
      return
    }
    if (routeFolderId === currentFolderId) {
      return
    }
    setCurrentFolderId(routeFolderId)
  }, [currentFolderId, folderRouteClearing, routeFolderId, setCurrentFolderId, setFolderRouteClearing])

  return {
    currentFolderIdRef,
    routeFolderId,
    clearCurrentFolderRoute,
    updateFolderRoute,
  }
}
