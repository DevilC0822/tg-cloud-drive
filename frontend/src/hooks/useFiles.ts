import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  foldersAtom,
  selectedFileIdsAtom,
  currentFolderIdAtom,
  sortConfigAtom,
  searchQueryAtom,
  isLoadingAtom,
  currentPageAtom,
  pageSizeAtom,
} from '@/stores/fileAtoms';
import { activeNavAtom, previewModalAtom } from '@/stores/uiAtoms';
import { authCheckedAtom, authenticatedAtom } from '@/stores/authAtoms';
import type { FileItem, SortBy, BreadcrumbItem } from '@/types';
import { apiFetchJson, dtoToFileItem, ApiError, type ItemDTO } from '@/utils/api';

type RouteView = 'files' | 'favorites' | 'recent' | 'trash' | 'settings' | 'transfers' | 'vault';

type PaginationState = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

type VaultStatusDTO = {
  enabled: boolean;
  unlocked: boolean;
  expiresAt?: string;
};

function normalizePathname(pathname: string): string {
  const withLeadingSlash = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const cleaned = withLeadingSlash.replace(/\/+$/, '');
  return cleaned || '/';
}

function normalizeBasePath(baseUrl: string): string {
  const normalized = normalizePathname(baseUrl || '/');
  return normalized === '/' ? '' : normalized;
}

const APP_BASE_PATH = normalizeBasePath(import.meta.env.BASE_URL ?? '/');

function stripBasePath(pathname: string): string {
  const normalized = normalizePathname(pathname);
  if (!APP_BASE_PATH) return normalized;
  if (normalized === APP_BASE_PATH) return '/';
  if (normalized.startsWith(`${APP_BASE_PATH}/`)) {
    return normalized.slice(APP_BASE_PATH.length) || '/';
  }
  return normalized;
}

function prependBasePath(pathname: string): string {
  const normalized = normalizePathname(pathname);
  if (!APP_BASE_PATH) return normalized;
  if (normalized === '/') return APP_BASE_PATH;
  return `${APP_BASE_PATH}${normalized}`;
}

function viewFromPathname(pathname: string): RouteView {
  const normalized = stripBasePath(pathname);
  if (normalized === '/transfers') return 'transfers';
  if (normalized === '/settings') return 'settings';
  if (normalized === '/vault') return 'vault';
  if (normalized === '/favorites') return 'favorites';
  if (normalized === '/recent') return 'recent';
  if (normalized === '/trash') return 'trash';
  return 'files';
}

function encodeFolderPathToRoute(folderPath: string): string {
  const parts = folderPath
    .split('/')
    .filter(Boolean)
    .map((part) => encodeURIComponent(part));
  if (parts.length === 0) return '/files';
  return `/files/${parts.join('/')}`;
}

function decodeFolderPathFromRoute(pathname: string): string {
  const normalized = stripBasePath(pathname);
  if (normalized === '/' || normalized === '/files') return '/';
  if (!normalized.startsWith('/files/')) return '/';

  const encodedParts = normalized.slice('/files/'.length).split('/').filter(Boolean);
  const decodedParts = encodedParts.map((part) => {
    try {
      return decodeURIComponent(part);
    } catch {
      return part;
    }
  });

  return `/${decodedParts.join('/')}`;
}

function isUnauthorized(err: unknown): boolean {
  return err instanceof ApiError && err.status === 401;
}

/**
 * 文件操作 Hook（后端真实数据）
 */
export function useFiles() {
  const routeHydratedRef = useRef(false);
  const applyingRouteRef = useRef(false);

  const [folders, setFolders] = useAtom(foldersAtom);
  const [selectedIds, setSelectedIds] = useAtom(selectedFileIdsAtom);
  const [currentFolderId, setCurrentFolderId] = useAtom(currentFolderIdAtom);
  const [sortConfig, setSortConfig] = useAtom(sortConfigAtom);
  const searchQuery = useAtomValue(searchQueryAtom);
  const setIsLoading = useSetAtom(isLoadingAtom);
  const activeNav = useAtomValue(activeNavAtom);
  const setActiveNav = useSetAtom(activeNavAtom);
  const [currentPage, setCurrentPage] = useAtom(currentPageAtom);
  const [pageSize, setPageSize] = useAtom(pageSizeAtom);
  const authChecked = useAtomValue(authCheckedAtom);
  const authenticated = useAtomValue(authenticatedAtom);
  const setAuthenticated = useSetAtom(authenticatedAtom);

  const setPreviewModal = useSetAtom(previewModalAtom);

  const [items, setItems] = useState<FileItem[]>([]);
  const [vaultStatusChecked, setVaultStatusChecked] = useState(false);
  const [vaultUnlocked, setVaultUnlocked] = useState(false);
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    pageSize,
    totalCount: 0,
    totalPages: 1,
  });
  const isVaultView = activeNav === 'vault';
  const isVaultDataReady = !isVaultView || (vaultStatusChecked && vaultUnlocked);
  const isDataView =
    activeNav === 'files' ||
    activeNav === 'favorites' ||
    activeNav === 'recent' ||
    activeNav === 'trash' ||
    (activeNav === 'vault' && isVaultDataReady);

  const resolveFolderIdByPath = useCallback(
    (folderPath: string) => {
      if (folderPath === '/') return null;
      const folder = folders.find((f) => f.type === 'folder' && f.path === folderPath);
      return folder?.id ?? null;
    },
    [folders],
  );

  const applyRouteFromPathname = useCallback(
    (pathname: string, options?: { waitForFolders?: boolean }) => {
      const routeView = viewFromPathname(pathname);

      if (routeView === 'files') {
        const routeFolderPath = decodeFolderPathFromRoute(pathname);
        if (options?.waitForFolders && routeFolderPath !== '/' && folders.length === 0) {
          return false;
        }

        setActiveNav('files');
        setCurrentFolderId(resolveFolderIdByPath(routeFolderPath));
        return true;
      }

      setActiveNav(routeView);
      setCurrentFolderId(null);
      return true;
    },
    [folders.length, resolveFolderIdByPath, setActiveNav, setCurrentFolderId],
  );

  // 首次加载：从 URL 恢复视图和目录
  useEffect(() => {
    if (routeHydratedRef.current) return;
    if (!authChecked || !authenticated) return;

    applyingRouteRef.current = true;
    const hydrated = applyRouteFromPathname(window.location.pathname, { waitForFolders: true });
    if (!hydrated) {
      applyingRouteRef.current = false;
      return;
    }

    queueMicrotask(() => {
      applyingRouteRef.current = false;
    });
    routeHydratedRef.current = true;
  }, [applyRouteFromPathname, authChecked, authenticated]);

  // 浏览器前进/后退：从 URL 还原状态
  useEffect(() => {
    const handlePopState = () => {
      if (!routeHydratedRef.current) return;
      applyingRouteRef.current = true;
      applyRouteFromPathname(window.location.pathname);
      queueMicrotask(() => {
        applyingRouteRef.current = false;
      });
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [applyRouteFromPathname]);

  // 状态变化：同步 URL（无路由库场景下的轻量地址管理）
  useEffect(() => {
    if (!routeHydratedRef.current || applyingRouteRef.current) return;
    if (!authChecked || !authenticated) return;

    let nextPathname = '/files';

    if (activeNav === 'favorites') {
      nextPathname = '/favorites';
    } else if (activeNav === 'recent') {
      nextPathname = '/recent';
    } else if (activeNav === 'trash') {
      nextPathname = '/trash';
    } else if (activeNav === 'transfers') {
      nextPathname = '/transfers';
    } else if (activeNav === 'settings') {
      nextPathname = '/settings';
    } else if (activeNav === 'vault') {
      nextPathname = '/vault';
    } else {
      const folder = currentFolderId ? folders.find((f) => f.id === currentFolderId && f.type === 'folder') : null;
      nextPathname = folder ? encodeFolderPathToRoute(folder.path) : '/files';
    }

    const currentRoutePath = stripBasePath(window.location.pathname);
    const normalizedCurrentRoute = currentRoutePath === '/' ? '/files' : currentRoutePath;
    if (nextPathname !== normalizedCurrentRoute) {
      const nextFullPathname = prependBasePath(nextPathname);
      window.history.pushState(null, '', nextFullPathname);
    }
  }, [activeNav, authChecked, authenticated, currentFolderId, folders]);

  // 切换目录/视图/搜索时，回到第一页
  useEffect(() => {
    setCurrentPage(1);
  }, [activeNav, currentFolderId, searchQuery, setCurrentPage]);

  const refreshFolders = useCallback(async () => {
    const data = await apiFetchJson<{ items: ItemDTO[] }>('/api/folders');
    setFolders(data.items.map(dtoToFileItem));
  }, [setFolders]);

  const refreshVaultStatus = useCallback(async () => {
    if (!authChecked || !authenticated) {
      setVaultStatusChecked(false);
      setVaultUnlocked(false);
      return { enabled: false, unlocked: false } as VaultStatusDTO;
    }

    try {
      const status = await apiFetchJson<VaultStatusDTO>('/api/vault/status');
      const unlocked = !!status.enabled && !!status.unlocked;
      setVaultUnlocked(unlocked);
      setVaultStatusChecked(true);
      return status;
    } catch (err: unknown) {
      setVaultUnlocked(false);
      setVaultStatusChecked(true);
      if (isUnauthorized(err)) {
        setAuthenticated(false);
      }
      throw err;
    }
  }, [authChecked, authenticated, setAuthenticated]);

  // 密码箱视图请求门控：仅在已解锁状态下允许拉取 vault 列表。
  useEffect(() => {
    if (!authChecked || !authenticated) {
      setVaultStatusChecked(false);
      setVaultUnlocked(false);
      return;
    }

    if (!isVaultView) {
      setVaultStatusChecked(false);
      setVaultUnlocked(false);
      return;
    }

    setVaultStatusChecked(false);
    refreshVaultStatus().catch(() => {
      // 具体错误提示由密码箱页面处理，这里只控制列表请求时机。
    });
  }, [authChecked, authenticated, isVaultView, refreshVaultStatus]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set('view', isDataView ? activeNav : 'files');

    if (activeNav === 'files' && currentFolderId) {
      params.set('parentId', currentFolderId);
    }
    if (searchQuery.trim()) {
      params.set('search', searchQuery.trim());
    }

    params.set('sortBy', sortConfig.by);
    params.set('sortOrder', sortConfig.order);
    params.set('page', String(currentPage));
    params.set('pageSize', String(pageSize));

    return params.toString();
  }, [activeNav, currentFolderId, currentPage, isDataView, pageSize, searchQuery, sortConfig.by, sortConfig.order]);

  const refreshItems = useCallback(async () => {
    const data = await apiFetchJson<{
      items: ItemDTO[];
      pagination: PaginationState;
    }>(`/api/items?${queryString}`);

    setItems(data.items.map(dtoToFileItem));
    setPagination(data.pagination);

    if (data.pagination.totalPages > 0 && currentPage > data.pagination.totalPages) {
      setCurrentPage(data.pagination.totalPages);
    }
  }, [currentPage, queryString, setCurrentPage]);

  // 拉取文件夹索引（用于面包屑/路径解析）
  useEffect(() => {
    if (!authChecked || !authenticated) return;
    refreshFolders().catch((err: unknown) => {
      if (isUnauthorized(err)) {
        setAuthenticated(false);
      }
    });
  }, [authChecked, authenticated, refreshFolders, setAuthenticated]);

  // 如果当前目录在 folder 索引中已不存在（比如被移入回收站），自动回到根目录
  useEffect(() => {
    if (!currentFolderId) return;
    if (folders.some((f) => f.id === currentFolderId)) return;
    setCurrentFolderId(null);
  }, [currentFolderId, folders, setCurrentFolderId]);

  // 拉取列表数据（由后端处理过滤/排序/分页）
  useEffect(() => {
    if (!authChecked || !authenticated) {
      setItems([]);
      setPagination({ page: 1, pageSize, totalCount: 0, totalPages: 1 });
      return;
    }

    if (!isDataView) {
      setItems([]);
      setPagination({ page: 1, pageSize, totalCount: 0, totalPages: 1 });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    refreshItems()
      .catch((err: unknown) => {
        if (isUnauthorized(err)) {
          setAuthenticated(false);
          return;
        }
        setItems([]);
        setPagination({ page: 1, pageSize, totalCount: 0, totalPages: 1 });
      })
      .finally(() => setIsLoading(false));
  }, [authChecked, authenticated, isDataView, pageSize, refreshItems, setAuthenticated, setIsLoading]);

  const selectFile = useCallback(
    (fileId: string, multiSelect = false) => {
      setSelectedIds((prev: Set<string>) => {
        const newSet = new Set<string>(multiSelect ? prev : []);
        if (newSet.has(fileId)) {
          newSet.delete(fileId);
        } else {
          newSet.add(fileId);
        }
        return newSet;
      });
    },
    [setSelectedIds],
  );

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set<string>());
  }, [setSelectedIds]);

  const getPreviewUrl = useCallback((file: FileItem) => {
    if (file.type === 'folder') return undefined;
    return `/api/items/${file.id}/content`;
  }, []);

  const downloadFile = useCallback((file: FileItem) => {
    if (file.type === 'folder') {
      return { ok: false as const, reason: '文件夹暂不支持下载' };
    }

    const url = `/api/items/${file.id}/content?download=1`;
    return { ok: true as const, url };
  }, []);

  const openFile = useCallback(
    (file: FileItem) => {
      if (file.type === 'folder') {
        if (activeNav !== 'vault') {
          setActiveNav('files');
        }
        setCurrentFolderId(file.id);
        clearSelection();
      } else {
        setPreviewModal({ visible: true, file });
      }
    },
    [activeNav, clearSelection, setActiveNav, setCurrentFolderId, setPreviewModal],
  );

  const navigateTo = useCallback(
    (breadcrumb: BreadcrumbItem) => {
      if (activeNav !== 'vault') {
        setActiveNav('files');
      }
      setCurrentFolderId(breadcrumb.id === 'root' ? null : breadcrumb.id);
      clearSelection();
    },
    [activeNav, clearSelection, setActiveNav, setCurrentFolderId],
  );

  const createFolder = useCallback(
    async (name: string) => {
      const cleanedName = name.trim();
      if (!cleanedName) return null;

      const res = await apiFetchJson<{ item: ItemDTO }>('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId: currentFolderId, name: cleanedName }),
      });

      await refreshFolders();
      await refreshItems();
      return dtoToFileItem(res.item);
    },
    [currentFolderId, refreshFolders, refreshItems],
  );

  const renameFile = useCallback(
    async (fileId: string, newName: string) => {
      const cleanedName = newName.trim();
      if (!cleanedName) return;

      await apiFetchJson<{ item: ItemDTO }>(`/api/items/${fileId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cleanedName }),
      });

      await refreshFolders();
      await refreshItems();
    },
    [refreshFolders, refreshItems],
  );

  const moveItem = useCallback(
    async (itemId: string, destinationFolderId: string | null) => {
      try {
        const res = await apiFetchJson<{ item: ItemDTO }>(`/api/items/${itemId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parentId: destinationFolderId }),
        });

        await refreshFolders();
        await refreshItems();
        const updated = dtoToFileItem(res.item);
        return { ok: true as const, newName: updated.name, newPath: updated.path };
      } catch (err: unknown) {
        if (isUnauthorized(err)) setAuthenticated(false);
        return { ok: false as const, reason: (err as ApiError)?.message || '移动失败' };
      }
    },
    [refreshFolders, refreshItems, setAuthenticated],
  );

  const copyItem = useCallback(
    async (itemId: string, destinationFolderId?: string | null) => {
      try {
        const res = await apiFetchJson<{ item: ItemDTO }>(`/api/items/${itemId}/copy`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ destinationParentId: destinationFolderId ?? null }),
        });

        await refreshFolders();
        await refreshItems();
        return { ok: true as const, idPairs: [] as const, item: dtoToFileItem(res.item) };
      } catch (err: unknown) {
        if (isUnauthorized(err)) setAuthenticated(false);
        return { ok: false as const, reason: (err as ApiError)?.message || '复制失败', idPairs: [] as const };
      }
    },
    [refreshFolders, refreshItems, setAuthenticated],
  );

  const trashFiles = useCallback(
    async (fileIds: string[]) => {
      if (fileIds.length === 0) return;
      await Promise.all(
        fileIds.map((id) => apiFetchJson<{ ok: boolean }>(`/api/items/${id}/trash`, { method: 'POST' })),
      );
      clearSelection();
      await refreshFolders();
      await refreshItems();
    },
    [clearSelection, refreshFolders, refreshItems],
  );

  const restoreFiles = useCallback(
    async (fileIds: string[]) => {
      if (fileIds.length === 0) return;
      await Promise.all(
        fileIds.map((id) => apiFetchJson<{ ok: boolean }>(`/api/items/${id}/restore`, { method: 'POST' })),
      );
      await refreshFolders();
      await refreshItems();
    },
    [refreshFolders, refreshItems],
  );

  const deleteFilesPermanently = useCallback(
    async (fileIds: string[]) => {
      if (fileIds.length === 0) return;
      const responses = await Promise.all(
        fileIds.map((id) =>
          apiFetchJson<{
            ok: boolean;
            telegramCleanup?: {
              attempted: number;
              deleted: number;
              failed: number;
            };
          }>(`/api/items/${id}`, { method: 'DELETE' }),
        ),
      );
      clearSelection();
      await refreshFolders();
      await refreshItems();
      const telegramCleanupFailed = responses.reduce((sum, item) => {
        const failed = item.telegramCleanup?.failed ?? 0;
        return sum + (Number.isFinite(failed) ? failed : 0);
      }, 0);
      return { telegramCleanupFailed };
    },
    [clearSelection, refreshFolders, refreshItems],
  );

  const toggleFavorite = useCallback(
    async (fileId: string) => {
      const target = items.find((f) => f.id === fileId);
      const next = !target?.isFavorite;

      await apiFetchJson<{ item: ItemDTO }>(`/api/items/${fileId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFavorite: next }),
      });

      await refreshItems();
    },
    [items, refreshItems],
  );

  const toggleSort = useCallback(
    (by: SortBy) => {
      setSortConfig((prev) => {
        if (prev.by === by) {
          return { by, order: prev.order === 'asc' ? 'desc' : 'asc' };
        }
        return { by, order: 'asc' };
      });
      setCurrentPage(1);
    },
    [setCurrentPage, setSortConfig],
  );

  const changePage = useCallback(
    (page: number) => {
      const nextPage = Math.min(Math.max(1, page), pagination.totalPages);
      setCurrentPage(nextPage);
    },
    [pagination.totalPages, setCurrentPage],
  );

  const changePageSize = useCallback(
    (size: number) => {
      const nextSize = Math.max(1, Math.floor(size));
      setPageSize(nextSize);
      setCurrentPage(1);
    },
    [setCurrentPage, setPageSize],
  );

  const openPreview = useCallback(
    (file: FileItem) => {
      setPreviewModal({ visible: true, file });
    },
    [setPreviewModal],
  );

  const shareItem = useCallback(
    async (fileId: string) => {
      const res = await apiFetchJson<{ shareCode: string; shareUrl: string }>(`/api/items/${fileId}/share`, {
        method: 'POST',
      });
      await refreshItems();
      return res;
    },
    [refreshItems],
  );

  const unshareItem = useCallback(
    async (fileId: string) => {
      await apiFetchJson<{ ok: boolean }>(`/api/items/${fileId}/share`, { method: 'DELETE' });
      await refreshItems();
    },
    [refreshItems],
  );

  const toggleVault = useCallback(
    async (fileId: string, enabled: boolean) => {
      const res = await apiFetchJson<{
        item: ItemDTO;
        spoilerApplied?: boolean;
        spoilerEligible?: boolean;
      }>(`/api/items/${fileId}/vault`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      await refreshItems();
      return {
        item: dtoToFileItem(res.item),
        spoilerApplied: !!res.spoilerApplied,
        spoilerEligible: !!res.spoilerEligible,
      };
    },
    [refreshItems],
  );

  return {
    folders,
    selectedIds,
    activeNav,
    allVisibleFiles: items,
    displayFiles: items,
    pagination,
    selectFile,
    openFile,
    navigateTo,
    createFolder,
    renameFile,
    moveItem,
    copyItem,
    trashFiles,
    restoreFiles,
    deleteFilesPermanently,
    toggleFavorite,
    toggleVault,
    toggleSort,
    changePage,
    changePageSize,
    openPreview,
    getPreviewUrl,
    downloadFile,
    refreshFolders,
    refreshItems,
    refreshVaultStatus,
    shareItem,
    unshareItem,
  };
}
