import { useState, useCallback, useEffect, useMemo } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { useLocation, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { FileBrowser } from '@/components/file/FileBrowser';
import { FilePreview } from '@/components/file/FilePreview';
import { UploadProgress } from '@/components/upload/UploadProgress';
import { SettingsPage } from '@/components/settings/SettingsPage';
import { TransferCenterPage } from '@/components/transfer/TransferCenterPage';
import { PasswordVaultPage } from '@/components/vault/PasswordVaultPage';
import {
  SetupInitPage,
  type SetupAccessMethod,
  type SetupConnectionTestDetails,
} from '@/components/setup/SetupInitPage';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ToastContainer } from '@/components/ui/ToastContainer';
import { useFiles } from '@/hooks/useFiles';
import { useToast } from '@/hooks/useToast';
import { useUpload } from '@/hooks/useUpload';
import { useTransferCenter } from '@/hooks/useTransferCenter';
import { useTheme } from '@/hooks/useTheme';
import {
  previewModalAtom,
  newFolderModalAtom,
  renameModalAtom,
  deleteModalAtom,
  contextMenuAtom,
} from '@/stores/uiAtoms';
import { authCheckedAtom, authenticatedAtom } from '@/stores/authAtoms';
import type { FileItem, SortBy, BreadcrumbItem } from '@/types';
import { collectDescendantIds } from '@/utils/fileUtils';
import { formatDateTime, formatFileSize } from '@/utils/formatters';
import { apiFetchJson, ApiError } from '@/utils/api';

function isGifOrWebpFile(file: FileItem): boolean {
  const mime = file.mimeType?.trim().toLowerCase() || '';
  if (mime === 'image/gif' || mime === 'image/webp') {
    return true;
  }
  const ext = (file.extension || file.name.split('.').pop() || '')
    .trim()
    .toLowerCase()
    .replace(/^\./, '');
  return ext === 'gif' || ext === 'webp';
}

interface SetupStatusResponse {
  initialized: boolean;
  accessMethod?: SetupAccessMethod;
  tgApiId?: number | null;
  tgApiHash?: string | null;
}

interface SetupTestConnectionResponse {
  ok: boolean;
  details: SetupConnectionTestDetails;
}

const setupRoutePath = '/setup';

export default function App() {
  // 初始化主题
  useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const isSetupRoute = location.pathname === setupRoutePath;

  // 鉴权状态
  const [authChecked, setAuthChecked] = useAtom(authCheckedAtom);
  const [authenticated, setAuthenticated] = useAtom(authenticatedAtom);
  const transferCenterEnabled = !isSetupRoute && authChecked && authenticated;

  // 状态管理
  const [previewModal, setPreviewModal] = useAtom(previewModalAtom);
  const [newFolderModal, setNewFolderModal] = useAtom(newFolderModalAtom);
  const [renameModal, setRenameModal] = useAtom(renameModalAtom);
  const [deleteModal, setDeleteModal] = useAtom(deleteModalAtom);
  const setContextMenu = useSetAtom(contextMenuAtom);
  const { pushToast } = useToast();

  const {
    folders,
    displayFiles,
    allVisibleFiles,
    pagination,
    selectedIds,
    activeNav,
    selectFile,
    openFile,
    openPreview,
    navigateTo,
    createFolder,
    renameFile,
    toggleFavorite,
    toggleVault,
    moveItem,
    copyItem,
    restoreFiles,
    deleteFilesPermanently,
    trashFiles,
    toggleSort,
    changePage,
    changePageSize,
    getPreviewUrl,
    downloadFile,
    refreshFolders,
    refreshItems,
    refreshVaultStatus,
    shareItem,
    unshareItem,
  } = useFiles();

  const { uploadFiles, retryTask } = useUpload({
    onUploaded: () => {
      refreshFolders();
      refreshItems();
    },
  });

  const {
    uploadTasks,
    downloadTasks,
    history,
    historyFilter,
    historyLoading,
    historyPagination,
    startDownload,
    retryDownload,
    cancelDownload,
    clearFinishedDownloads,
    clearHistory,
    clearHistoryByDays,
    removeHistoryItem,
    changeHistoryFilter,
    changeHistoryPage,
    changeHistoryPageSize,
  } = useTransferCenter({ enabled: transferCenterEnabled });

  // 本地状态
  const [newFolderName, setNewFolderName] = useState('');
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState('');
  const [moveModal, setMoveModal] = useState<{
    visible: boolean;
    file: FileItem | null;
    action: 'move' | 'copy';
  }>({
    visible: false,
    file: null,
    action: 'move',
  });
  const [moveTargetFolderId, setMoveTargetFolderId] = useState<string>('root');
  const [uploadTargetModal, setUploadTargetModal] = useState<{
    visible: boolean;
    files: File[];
  }>({
    visible: false,
    files: [],
  });
  const [uploadTargetFolderId, setUploadTargetFolderId] = useState<string>('root');
  const [infoFile, setInfoFile] = useState<FileItem | null>(null);
  const [permanentDeleteModal, setPermanentDeleteModal] = useState<{
    visible: boolean;
    file: FileItem | null;
  }>({
    visible: false,
    file: null,
  });
  const [permanentDeleteLoading, setPermanentDeleteLoading] = useState(false);

  // 登录表单
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // 系统初始化状态
  const [setupChecked, setSetupChecked] = useState(false);
  const [setupInitialized, setSetupInitialized] = useState(false);
  const [setupBotToken, setSetupBotToken] = useState('');
  const [setupStorageChatID, setSetupStorageChatID] = useState('');
  const [setupAccessMethod, setSetupAccessMethod] = useState<SetupAccessMethod>('official_bot_api');
  const [setupApiId, setSetupApiId] = useState('');
  const [setupApiHash, setSetupApiHash] = useState('');
  const [setupAdminPassword, setSetupAdminPassword] = useState('');
  const [setupAdminPasswordConfirm, setSetupAdminPasswordConfirm] = useState('');
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupTestLoading, setSetupTestLoading] = useState(false);
  const [setupTestDetails, setSetupTestDetails] = useState<SetupConnectionTestDetails | null>(null);

  // 首次检查初始化状态
  useEffect(() => {
    let cancelled = false;
    let retryTimer: number | null = null;
    let retryCount = 0;
    let retryNotified = false;

    const loadSetupStatus = () => {
      apiFetchJson<SetupStatusResponse>('/api/setup/status')
        .then((res) => {
          if (cancelled) return;
          setSetupInitialized(!!res.initialized);
          if (
            res.accessMethod === 'official_bot_api' ||
            res.accessMethod === 'self_hosted_bot_api' ||
            res.accessMethod === 'mtproto'
          ) {
            setSetupAccessMethod(res.accessMethod);
          }
          setSetupApiId(res.tgApiId != null ? String(res.tgApiId) : '');
          setSetupApiHash(res.tgApiHash || '');
          setSetupChecked(true);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          const e = err as ApiError;
          const status = Number.isFinite(e?.status) ? e.status : 0;
          const isRetryable =
            status === 0 ||
            status === 429 ||
            status === 502 ||
            status === 503 ||
            status === 504 ||
            status >= 500;
          if (isRetryable) {
            retryCount += 1;
            if (retryCount >= 3 && !retryNotified) {
              pushToast({ type: 'info', message: '服务启动中，正在重试读取初始化状态...' });
              retryNotified = true;
            }
            const backoffMs = Math.min(1000 * (retryCount + 1), 8000);
            retryTimer = window.setTimeout(loadSetupStatus, backoffMs);
            return;
          }

          pushToast({ type: 'error', message: e?.message || '读取初始化状态失败' });
          setSetupInitialized(false);
          setSetupChecked(true);
        });
    };

    loadSetupStatus();

    return () => {
      cancelled = true;
      if (retryTimer != null) {
        window.clearTimeout(retryTimer);
      }
    };
  }, [pushToast]);

  // 根据初始化状态控制是否进入初始化路由
  useEffect(() => {
    if (!setupChecked) return;

    if (!setupInitialized) {
      if (!isSetupRoute) {
        navigate(setupRoutePath, { replace: true });
      }
      return;
    }

    if (isSetupRoute) {
      navigate('/', { replace: true });
    }
  }, [isSetupRoute, navigate, setupChecked, setupInitialized]);

  // 初始化完成后检查鉴权
  useEffect(() => {
    if (!setupChecked || !setupInitialized) {
      setAuthChecked(false);
      setAuthenticated(false);
      return;
    }

    let cancelled = false;
    setAuthChecked(false);
    apiFetchJson<{ authenticated: boolean }>('/api/auth/me')
      .then((res) => {
        if (cancelled) return;
        setAuthenticated(!!res.authenticated);
        setAuthChecked(true);
      })
      .catch(() => {
        if (cancelled) return;
        setAuthenticated(false);
        setAuthChecked(true);
      });

    return () => {
      cancelled = true;
    };
  }, [setAuthChecked, setAuthenticated, setupChecked, setupInitialized]);

  const handleSetupTestConnection = useCallback(async () => {
    const token = setupBotToken.trim();
    const chatID = setupStorageChatID.trim();
    const apiId = setupApiId.trim();
    const apiHash = setupApiHash.trim();

    if (!token || !chatID) {
      pushToast({ type: 'error', message: '请先填写 Bot Token 与 Chat ID' });
      return;
    }
    if (setupAccessMethod === 'mtproto') {
      pushToast({ type: 'error', message: 'MTProto 暂未开放，请选择其他接入方式' });
      return;
    }
    let normalizedApiID: number | undefined;
    if (setupAccessMethod === 'self_hosted_bot_api') {
      if (!apiId || !apiHash) {
        pushToast({ type: 'error', message: '自建 Bot API 模式需要填写 API ID 和 API Hash' });
        return;
      }
      const parsedApiID = Number.parseInt(apiId, 10);
      if (!Number.isFinite(parsedApiID) || parsedApiID <= 0) {
        pushToast({ type: 'error', message: 'API ID 必须是正整数' });
        return;
      }
      normalizedApiID = parsedApiID;
    }

    setSetupTestLoading(true);
    try {
      const res = await apiFetchJson<SetupTestConnectionResponse>('/api/setup/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessMethod: setupAccessMethod,
          tgBotToken: token,
          tgStorageChatId: chatID,
          tgApiId: normalizedApiID,
          tgApiHash: setupAccessMethod === 'self_hosted_bot_api' ? apiHash : undefined,
        }),
      });
      setSetupTestDetails(res.details || null);
      if (res.ok) {
        pushToast({ type: 'success', message: '连接测试通过' });
      } else {
        pushToast({ type: 'error', message: '连接测试未通过，请检查详情后重试' });
      }
    } catch (err: unknown) {
      const e = err as ApiError;
      pushToast({ type: 'error', message: e?.message || '连接测试失败' });
    } finally {
      setSetupTestLoading(false);
    }
  }, [
    pushToast,
    setupAccessMethod,
    setupApiHash,
    setupApiId,
    setupBotToken,
    setupStorageChatID,
  ]);

  const handleSetupInit = useCallback(async () => {
    const token = setupBotToken.trim();
    const chatID = setupStorageChatID.trim();
    const apiId = setupApiId.trim();
    const apiHash = setupApiHash.trim();
    const password = setupAdminPassword.trim();
    const confirmPassword = setupAdminPasswordConfirm.trim();

    if (!token || !chatID || !password) {
      pushToast({ type: 'error', message: '请完整填写初始化必填项' });
      return;
    }
    if (setupAccessMethod === 'mtproto') {
      pushToast({ type: 'error', message: 'MTProto 暂未开放，请选择其他接入方式' });
      return;
    }
    let normalizedApiID: number | undefined;
    if (setupAccessMethod === 'self_hosted_bot_api') {
      if (!apiId || !apiHash) {
        pushToast({ type: 'error', message: '自建 Bot API 模式需要填写 API ID 和 API Hash' });
        return;
      }
      const parsedApiID = Number.parseInt(apiId, 10);
      if (!Number.isFinite(parsedApiID) || parsedApiID <= 0) {
        pushToast({ type: 'error', message: 'API ID 必须是正整数' });
        return;
      }
      normalizedApiID = parsedApiID;
    }
    if (password !== confirmPassword) {
      pushToast({ type: 'error', message: '两次输入的管理员密码不一致' });
      return;
    }

    setSetupLoading(true);
    try {
      await apiFetchJson<{ ok: boolean }>('/api/setup/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessMethod: setupAccessMethod,
          tgBotToken: token,
          tgStorageChatId: chatID,
          tgApiId: normalizedApiID,
          tgApiHash: setupAccessMethod === 'self_hosted_bot_api' ? apiHash : undefined,
          adminPassword: password,
        }),
      });
      setSetupInitialized(true);
      setAuthenticated(true);
      setAuthChecked(true);
      setSetupApiId('');
      setSetupApiHash('');
      setSetupAdminPassword('');
      setSetupAdminPasswordConfirm('');
      setSetupTestDetails(null);
      pushToast({ type: 'success', message: '初始化完成' });
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const e = err as ApiError;
      pushToast({ type: 'error', message: e?.message || '初始化失败' });
      setAuthenticated(false);
    } finally {
      setSetupLoading(false);
    }
  }, [
    pushToast,
    setAuthChecked,
    setAuthenticated,
    setupAdminPassword,
    setupAdminPasswordConfirm,
    setupAccessMethod,
    setupApiHash,
    setupApiId,
    setupBotToken,
    setupStorageChatID,
    navigate,
  ]);

  const handleLogin = useCallback(async () => {
    const pwd = loginPassword.trim();
    if (!pwd) {
      pushToast({ type: 'error', message: '请输入密码' });
      return;
    }

    setLoginLoading(true);
    try {
      await apiFetchJson<{ ok: boolean }>('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwd }),
      });
      setAuthenticated(true);
      pushToast({ type: 'success', message: '登录成功' });
    } catch (err: unknown) {
      const e = err as ApiError;
      pushToast({ type: 'error', message: e?.message || '登录失败' });
      setAuthenticated(false);
    } finally {
      setLoginLoading(false);
    }
  }, [loginPassword, pushToast, setAuthenticated]);

  // 处理新建文件夹
  const handleNewFolder = useCallback(() => {
    if (activeNav !== 'files') {
      pushToast({ type: 'info', message: '请先切换到“我的文件”再执行新建文件夹' });
      return;
    }
    setNewFolderName('');
    setNewFolderModal(true);
  }, [activeNav, pushToast, setNewFolderModal]);

  const handleCreateFolder = useCallback(async () => {
    const name = newFolderName.trim();
    if (!name) return;

    try {
      await createFolder(name);
      setNewFolderModal(false);
      setNewFolderName('');
      pushToast({ type: 'success', message: '文件夹已创建' });
    } catch (err: unknown) {
      const e = err as ApiError;
      pushToast({ type: 'error', message: e?.message || '创建失败' });
    }
  }, [createFolder, newFolderName, pushToast, setNewFolderModal]);

  const openFilePicker = useCallback((onSelected: (files: File[]) => void) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.autocomplete = 'off';
    input.multiple = true;
    input.onchange = (e) => {
      const list = (e.target as HTMLInputElement).files;
      if (!list || list.length === 0) return;
      onSelected(Array.from(list));
    };
    input.click();
  }, []);

  const openUploadModal = useCallback((presetFiles: File[] = []) => {
    setUploadTargetFolderId('root');
    setUploadTargetModal({
      visible: true,
      files: presetFiles,
    });
  }, []);

  const handleSelectUploadFiles = useCallback(() => {
    openFilePicker((pickedFiles) => {
      setUploadTargetModal((prev) => ({
        ...prev,
        files: pickedFiles,
      }));
    });
  }, [openFilePicker]);

  // 处理上传
  const handleUpload = useCallback(() => {
    openUploadModal();
  }, [openUploadModal]);

  // 处理文件上传（拖拽）
  const handleFileDrop = useCallback(
    (files: FileList | File[]) => {
      const droppedFiles = Array.from(files);
      if (droppedFiles.length === 0) return;
      openUploadModal(droppedFiles);
    },
    [openUploadModal]
  );

  // 处理右键菜单
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, file: FileItem) => {
      e.preventDefault();
      setContextMenu({
        visible: true,
        position: { x: e.clientX, y: e.clientY },
        targetFile: file,
      });
    },
    [setContextMenu]
  );

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu({
      visible: false,
      position: { x: 0, y: 0 },
      targetFile: null,
    });
  }, [setContextMenu]);

  // 处理预览
  const handlePreview = useCallback(
    (file: FileItem) => {
      if (file.type === 'folder') {
        openFile(file);
      } else {
        openPreview(file);
      }
    },
    [openFile, openPreview]
  );

  // 处理重命名
  const handleRename = useCallback(
    (file: FileItem) => {
      setRenameValue(file.name);
      setRenameError('');
      setRenameModal({ visible: true, file });
    },
    [setRenameModal]
  );

  const handleConfirmRename = useCallback(async () => {
    if (!renameModal.file) return;
    const nextName = renameValue.trim();
    if (!nextName) return;

    try {
      await renameFile(renameModal.file.id, nextName);
      setRenameModal({ visible: false, file: null });
      pushToast({ type: 'success', message: '重命名成功' });
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 409) {
        setRenameError('同一目录下已存在同名文件或文件夹');
        return;
      }
      const e = err as ApiError;
      pushToast({ type: 'error', message: e?.message || '重命名失败' });
    }
  }, [pushToast, renameFile, renameModal.file, renameValue, setRenameModal]);

  // 处理删除（移入回收站）
  const handleDelete = useCallback(
    (file: FileItem) => {
      setDeleteModal({ visible: true, files: [file] });
    },
    [setDeleteModal]
  );

  const handleConfirmDelete = useCallback(async () => {
    if (deleteModal.files.length === 0) return;

    try {
      await trashFiles(deleteModal.files.map((f) => f.id));
      setDeleteModal({ visible: false, files: [] });
      pushToast({ type: 'success', message: '已移入回收站' });
    } catch (err: unknown) {
      const e = err as ApiError;
      pushToast({ type: 'error', message: e?.message || '删除失败' });
    }
  }, [deleteModal.files, pushToast, setDeleteModal, trashFiles]);

  // 处理排序
  const handleSort = useCallback(
    (by: SortBy) => {
      toggleSort(by);
    },
    [toggleSort]
  );

  const handleDownload = useCallback(
    (file: FileItem) => {
      const result = downloadFile(file);
      if (!result.ok) {
        pushToast({ type: 'error', message: result.reason });
        return;
      }
      const downloadResult = startDownload(file, result.url);
      if (!downloadResult.ok) {
        pushToast({ type: 'error', message: downloadResult.reason });
      }
    },
    [downloadFile, pushToast, startDownload]
  );

  const handleRetryDownloadTask = useCallback(
    (taskId: string) => {
      const result = retryDownload(taskId);
      if (!result.ok) {
        pushToast({ type: 'error', message: result.reason });
      }
    },
    [pushToast, retryDownload]
  );

  const handleClearHistory = useCallback(async () => {
    const result = await clearHistory();
    if (!result.ok) {
      pushToast({ type: 'error', message: result.reason });
      return;
    }
    pushToast({ type: 'success', message: '历史记录已清空' });
  }, [clearHistory, pushToast]);

  const handleClearHistoryByDays = useCallback(
    async (days: number) => {
      const result = await clearHistoryByDays(days);
      if (!result.ok) {
        pushToast({ type: 'error', message: result.reason });
        return;
      }
      pushToast({ type: 'success', message: `已清理 ${days} 天前的历史记录` });
    },
    [clearHistoryByDays, pushToast]
  );

  const handleRemoveHistoryItem = useCallback(
    async (id: string) => {
      const result = await removeHistoryItem(id);
      if (!result.ok) {
        pushToast({ type: 'error', message: result.reason });
      }
    },
    [pushToast, removeHistoryItem]
  );

  const copyToClipboard = useCallback(
    async (text: string) => {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
      }
      const input = document.createElement('input');
      input.value = text;
      input.autocomplete = 'off';
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    },
    []
  );

  const handleShare = useCallback(
    async (file: FileItem) => {
      if (file.type === 'folder') {
        pushToast({ type: 'info', message: '文件夹暂不支持分享' });
        return;
      }

      try {
        // 始终基于当前站点 origin 组装，避免反代 Host 头缺失端口导致链接不可访问。
        const shareCode = file.isShared && file.shareCode
          ? file.shareCode
          : (await shareItem(file.id)).shareCode;
        const shareUrl = `${window.location.origin}/d/${shareCode}`;

        await copyToClipboard(shareUrl);
        pushToast({ type: 'success', message: '分享链接已复制到剪贴板' });
      } catch (err: unknown) {
        const e = err as ApiError;
        pushToast({ type: 'error', message: e?.message || '分享失败' });
      }
    },
    [copyToClipboard, pushToast, shareItem]
  );

  const handleUnshare = useCallback(
    async (file: FileItem) => {
      if (file.type === 'folder') return;
      try {
        await unshareItem(file.id);
        pushToast({ type: 'success', message: '已取消分享' });
      } catch (err: unknown) {
        const e = err as ApiError;
        pushToast({ type: 'error', message: e?.message || '取消分享失败' });
      }
    },
    [pushToast, unshareItem]
  );

  const handleVaultIn = useCallback(
    async (file: FileItem) => {
      if (file.type === 'folder') {
        pushToast({ type: 'info', message: '目录暂不支持移入密码箱' });
        return;
      }
      try {
        const isGifOrWebp = isGifOrWebpFile(file);
        const result = await toggleVault(file.id, true);
        if (isGifOrWebp && result.spoilerApplied) {
          pushToast({
            type: 'info',
            message: '已移入密码箱（gif/webp 已走动画 spoiler 路径，若 Telegram 客户端不展示则回退为仅密码箱可见）',
          });
          return;
        }
        if (result.spoilerEligible && !result.spoilerApplied) {
          if (isGifOrWebp) {
            pushToast({
              type: 'info',
              message: '已移入密码箱（gif/webp 当前未触发 Telegram 动画 spoiler，已回退为仅密码箱可见）',
            });
            return;
          }
          pushToast({ type: 'info', message: '已移入密码箱（该文件类型暂不支持 Telegram 原生模糊）' });
          return;
        }
        pushToast({ type: 'success', message: '已移入密码箱' });
      } catch (err: unknown) {
        const e = err as ApiError;
        pushToast({ type: 'error', message: e?.message || '移入密码箱失败' });
      }
    },
    [pushToast, toggleVault]
  );

  const handleVaultOut = useCallback(
    async (file: FileItem) => {
      if (file.type === 'folder') {
        pushToast({ type: 'info', message: '目录暂不支持移出密码箱' });
        return;
      }
      try {
        const isGifOrWebp = isGifOrWebpFile(file);
        const result = await toggleVault(file.id, false);
        if (isGifOrWebp && result.spoilerApplied) {
          pushToast({
            type: 'info',
            message: '已移出密码箱（已取消 gif/webp 动画 spoiler 尝试）',
          });
          return;
        }
        if (isGifOrWebp && result.spoilerEligible && !result.spoilerApplied) {
          pushToast({
            type: 'info',
            message: '已移出密码箱（gif/webp 未触发动画 spoiler 取消，已按普通可见处理）',
          });
          return;
        }
        pushToast({ type: 'success', message: '已移出密码箱' });
      } catch (err: unknown) {
        const e = err as ApiError;
        pushToast({ type: 'error', message: e?.message || '移出密码箱失败' });
      }
    },
    [pushToast, toggleVault]
  );

  const handleMove = useCallback((file: FileItem) => {
    setMoveModal({ visible: true, file, action: 'move' });
    setMoveTargetFolderId(file.parentId ?? 'root');
  }, []);

  const handleCopy = useCallback((file: FileItem) => {
    setMoveModal({ visible: true, file, action: 'copy' });
    setMoveTargetFolderId(file.parentId ?? 'root');
  }, []);

  const closeMoveModal = useCallback(() => {
    setMoveModal({ visible: false, file: null, action: 'move' });
    setMoveTargetFolderId('root');
  }, []);

  const closeUploadTargetModal = useCallback(() => {
    setUploadTargetModal({ visible: false, files: [] });
    setUploadTargetFolderId('root');
  }, []);

  const uploadTargetFolders = useMemo(
    () =>
      folders
        .filter((f) => f.type === 'folder' && !f.trashedAt)
        .sort((a, b) => a.path.localeCompare(b.path, 'zh-CN')),
    [folders]
  );

  const uploadTargetTotalBytes = useMemo(
    () => uploadTargetModal.files.reduce((sum, file) => sum + file.size, 0),
    [uploadTargetModal.files]
  );

  const handleConfirmUploadTarget = useCallback(() => {
    if (uploadTargetModal.files.length === 0) return;
    const selectedFiles = uploadTargetModal.files.slice();
    const destinationFolderId = uploadTargetFolderId === 'root' ? null : uploadTargetFolderId;
    setUploadTargetModal({ visible: false, files: [] });
    setUploadTargetFolderId('root');
    pushToast({ type: 'success', message: `已加入上传队列（${selectedFiles.length} 个文件）` });

    void (async () => {
      const results = await uploadFiles(selectedFiles, destinationFolderId);
      const successCount = results.filter((item) => !!item).length;
      if (successCount === selectedFiles.length) {
        return;
      }
      if (successCount > 0) {
        pushToast({
          type: 'info',
          message: `其中 ${selectedFiles.length - successCount} 个文件上传失败，请在传输中心重试`,
        });
        return;
      }
      pushToast({ type: 'error', message: '本次上传全部失败，请在传输中心重试' });
    })();
  }, [pushToast, uploadFiles, uploadTargetFolderId, uploadTargetModal.files]);

  const moveTargetFolders = useMemo(() => {
    const targetFile = moveModal.file;
    const allFolders = folders.filter((f) => f.type === 'folder');
    if (!targetFile) {
      return allFolders.slice().sort((a, b) => a.path.localeCompare(b.path, 'zh-CN'));
    }

    const blockedIds =
      moveModal.action === 'move' && targetFile.type === 'folder'
        ? collectDescendantIds(allFolders, targetFile.id)
        : new Set<string>();

    return allFolders
      .filter((f) => f.id !== targetFile.id && !blockedIds.has(f.id))
      .sort((a, b) => a.path.localeCompare(b.path, 'zh-CN'));
  }, [folders, moveModal.action, moveModal.file]);

  const handleConfirmMoveOrCopy = useCallback(async () => {
    if (!moveModal.file) return;
    const destinationFolderId = moveTargetFolderId === 'root' ? null : moveTargetFolderId;

    if (moveModal.action === 'move') {
      const result = await moveItem(moveModal.file.id, destinationFolderId);
      if (!result.ok) {
        pushToast({ type: 'error', message: result.reason });
        return;
      }
      pushToast({ type: 'success', message: `已移动到 ${destinationFolderId ? result.newPath : '根目录'}` });
      closeMoveModal();
      return;
    }

    const result = await copyItem(moveModal.file.id, destinationFolderId);
    if (!result.ok) {
      pushToast({ type: 'error', message: result.reason });
      return;
    }
    pushToast({ type: 'success', message: '复制成功' });
    closeMoveModal();
  }, [closeMoveModal, copyItem, moveItem, moveModal.action, moveModal.file, moveTargetFolderId, pushToast]);

  const handleRestore = useCallback(
    async (file: FileItem) => {
      try {
        await restoreFiles([file.id]);
        pushToast({ type: 'success', message: `已还原 ${file.name}` });
      } catch (err: unknown) {
        const e = err as ApiError;
        pushToast({ type: 'error', message: e?.message || '还原失败' });
      }
    },
    [pushToast, restoreFiles]
  );

  const closePermanentDeleteModal = useCallback(() => {
    if (permanentDeleteLoading) return;
    setPermanentDeleteModal({
      visible: false,
      file: null,
    });
  }, [permanentDeleteLoading]);

  const handleDeletePermanently = useCallback((file: FileItem) => {
    setPermanentDeleteModal({
      visible: true,
      file,
    });
  }, []);

  const handleConfirmPermanentDelete = useCallback(async () => {
    const target = permanentDeleteModal.file;
    if (!target || permanentDeleteLoading) return;

    setPermanentDeleteLoading(true);
    try {
      const result = await deleteFilesPermanently([target.id]);
      const failedCount = result?.telegramCleanupFailed ?? 0;
      if (failedCount > 0) {
        pushToast({
          type: 'info',
          message: `已永久删除 ${target.name}，但有 ${failedCount} 个 Telegram 分片未删除，已记录失败项`,
          durationMs: 4500,
        });
      } else {
        pushToast({ type: 'success', message: `已永久删除 ${target.name}` });
      }
      setPermanentDeleteModal({
        visible: false,
        file: null,
      });
    } catch (err: unknown) {
      const e = err as ApiError;
      pushToast({ type: 'error', message: e?.message || '永久删除失败' });
    } finally {
      setPermanentDeleteLoading(false);
    }
  }, [deleteFilesPermanently, permanentDeleteLoading, permanentDeleteModal.file, pushToast]);

  const handleInfo = useCallback((file: FileItem) => {
    setInfoFile(file);
  }, []);

  const handleNavigate = useCallback(
    (item: BreadcrumbItem) => {
      navigateTo(item);
    },
    [navigateTo]
  );

  const handlePreviewNavigate = useCallback(
    (file: FileItem) => {
      openPreview(file);
    },
    [openPreview]
  );

  const previewableFiles = allVisibleFiles.filter((f) => f.type !== 'folder');

  if (!setupChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950">
        <div className="text-sm text-neutral-500 dark:text-neutral-400">正在加载...</div>
      </div>
    );
  }

  if (!setupInitialized && !isSetupRoute) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950">
        <div className="text-sm text-neutral-500 dark:text-neutral-400">正在跳转初始化页面...</div>
      </div>
    );
  }

  if (isSetupRoute) {
    if (setupInitialized) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950">
          <div className="text-sm text-neutral-500 dark:text-neutral-400">正在跳转...</div>
        </div>
      );
    }
    return (
      <SetupInitPage
        accessMethod={setupAccessMethod}
        botToken={setupBotToken}
        storageChatId={setupStorageChatID}
        apiId={setupApiId}
        apiHash={setupApiHash}
        adminPassword={setupAdminPassword}
        adminPasswordConfirm={setupAdminPasswordConfirm}
        loading={setupLoading}
        testLoading={setupTestLoading}
        testDetails={setupTestDetails}
        onAccessMethodChange={setSetupAccessMethod}
        onBotTokenChange={setSetupBotToken}
        onStorageChatIdChange={setSetupStorageChatID}
        onApiIdChange={setSetupApiId}
        onApiHashChange={setSetupApiHash}
        onAdminPasswordChange={setSetupAdminPassword}
        onAdminPasswordConfirmChange={setSetupAdminPasswordConfirm}
        onTestConnection={handleSetupTestConnection}
        onSubmit={handleSetupInit}
      />
    );
  }

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950">
        <div className="text-sm text-neutral-500 dark:text-neutral-400">正在加载...</div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950 px-4">
        <div className="w-full max-w-sm rounded-2xl border border-neutral-200/60 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/60 backdrop-blur p-6 shadow-xl">
          <div className="mb-6">
            <div className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">TG Cloud Drive</div>
            <div className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">请输入管理员密码登录</div>
          </div>

          <Input
            label="密码"
            type="password"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            placeholder="管理员密码"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />

          <div className="mt-6 flex gap-3">
            <Button variant="gold" onClick={handleLogin} disabled={loginLoading} fullWidth>
              {loginLoading ? '登录中...' : '登录'}
            </Button>
          </div>

          <div className="mt-4 text-xs text-neutral-500 dark:text-neutral-500">
            提示：分享链接下载不需要登录。
          </div>

          <ToastContainer />
        </div>
      </div>
    );
  }

  return (
    <>
      <MainLayout onNewFolder={handleNewFolder} onUpload={handleUpload}>
        {activeNav === 'settings' ? (
          <SettingsPage />
        ) : activeNav === 'transfers' ? (
          <TransferCenterPage
            uploadTasks={uploadTasks}
            downloadTasks={downloadTasks}
            history={history}
            historyFilter={historyFilter}
            historyLoading={historyLoading}
            historyPagination={historyPagination}
            onRetryUpload={retryTask}
            onRetryDownload={handleRetryDownloadTask}
            onCancelDownload={cancelDownload}
            onClearFinishedDownloads={clearFinishedDownloads}
            onClearHistory={handleClearHistory}
            onClearHistoryByDays={handleClearHistoryByDays}
            onRemoveHistoryItem={handleRemoveHistoryItem}
            onHistoryFilterChange={changeHistoryFilter}
            onHistoryPageChange={changeHistoryPage}
            onHistoryPageSizeChange={changeHistoryPageSize}
          />
        ) : activeNav === 'vault' ? (
          <PasswordVaultPage
            onUnlocked={() => {
              void refreshVaultStatus().catch(() => {});
            }}
            onLocked={() => {
              void refreshVaultStatus().catch(() => {});
            }}
          >
            <FileBrowser
              files={displayFiles}
              selectedIds={selectedIds}
              onSelect={selectFile}
              onOpen={openFile}
              onNavigate={handleNavigate}
              onToggleFavorite={toggleFavorite}
              onSort={handleSort}
              onContextMenu={handleContextMenu}
              onCloseContextMenu={handleCloseContextMenu}
              onPreview={handlePreview}
              onRename={handleRename}
              onDelete={handleDelete}
              onUpload={handleFileDrop}
              onDownload={handleDownload}
              onMove={handleMove}
              onCopy={handleCopy}
              onShare={handleShare}
              onUnshare={handleUnshare}
              onInfo={handleInfo}
              onRestore={handleRestore}
              onDeletePermanently={handleDeletePermanently}
              onVaultIn={handleVaultIn}
              onVaultOut={handleVaultOut}
              pagination={pagination}
              onPageChange={changePage}
              onPageSizeChange={changePageSize}
            />
          </PasswordVaultPage>
        ) : (
          <FileBrowser
            files={displayFiles}
            selectedIds={selectedIds}
            onSelect={selectFile}
            onOpen={openFile}
            onNavigate={handleNavigate}
            onToggleFavorite={toggleFavorite}
            onSort={handleSort}
            onContextMenu={handleContextMenu}
            onCloseContextMenu={handleCloseContextMenu}
            onPreview={handlePreview}
            onRename={handleRename}
            onDelete={handleDelete}
            onUpload={handleFileDrop}
            onDownload={handleDownload}
            onMove={handleMove}
            onCopy={handleCopy}
            onShare={handleShare}
            onUnshare={handleUnshare}
            onInfo={handleInfo}
            onRestore={handleRestore}
            onDeletePermanently={handleDeletePermanently}
            onVaultIn={handleVaultIn}
            onVaultOut={handleVaultOut}
            pagination={pagination}
            onPageChange={changePage}
            onPageSizeChange={changePageSize}
          />
        )}
      </MainLayout>

      {/* 文件预览 */}
      <FilePreview
        open={previewModal.visible}
        file={previewModal.file}
        files={previewableFiles}
        onClose={() => setPreviewModal({ visible: false, file: null })}
        onNavigate={handlePreviewNavigate}
        getPreviewUrl={getPreviewUrl}
        onDownload={handleDownload}
        onShare={handleShare}
      />

      {/* 上传进度 */}
      <UploadProgress />

      {/* 新建文件夹模态框 */}
      <Modal
        open={newFolderModal}
        onClose={() => setNewFolderModal(false)}
        title="新建文件夹"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setNewFolderModal(false)}>
              取消
            </Button>
            <Button variant="gold" onClick={handleCreateFolder}>
              创建
            </Button>
          </>
        }
      >
        <Input
          label="文件夹名称"
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          placeholder="请输入文件夹名称"
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
        />
      </Modal>

      {/* 重命名模态框 */}
      <Modal
        open={renameModal.visible}
        onClose={() => {
          setRenameModal({ visible: false, file: null });
          setRenameError('');
        }}
        title="重命名"
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setRenameModal({ visible: false, file: null });
                setRenameError('');
              }}
            >
              取消
            </Button>
            <Button variant="gold" onClick={handleConfirmRename}>
              确定
            </Button>
          </>
        }
      >
        <Input
          label="新名称"
          value={renameValue}
          onChange={(e) => {
            setRenameValue(e.target.value);
            setRenameError('');
          }}
          placeholder="请输入新名称"
          autoFocus
          error={renameError}
          onKeyDown={(e) => e.key === 'Enter' && handleConfirmRename()}
        />
      </Modal>

      {/* 删除确认模态框 */}
      <Modal
        open={deleteModal.visible}
        onClose={() => setDeleteModal({ visible: false, files: [] })}
        title="确认删除"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteModal({ visible: false, files: [] })}>
              取消
            </Button>
            <Button variant="danger" onClick={handleConfirmDelete}>
              删除
            </Button>
          </>
        }
      >
        <p className="text-neutral-600 dark:text-neutral-400">
          确定要删除{' '}
          <span className="font-medium text-neutral-900 dark:text-neutral-100">
            {deleteModal.files.length === 1
              ? deleteModal.files[0].name
              : `${deleteModal.files.length} 个文件`}
          </span>{' '}
          吗？此操作将把文件移至回收站。
        </p>
      </Modal>

      {/* 统一上传文件弹窗 */}
      <Modal
        open={uploadTargetModal.visible}
        onClose={closeUploadTargetModal}
        title="上传文件"
        description="先选择上传路径，再选择文件并确认上传。"
        size="2xl"
        closeOnOverlayClick={false}
        closeOnEscape={false}
        footer={
          <>
            <Button variant="ghost" onClick={closeUploadTargetModal}>
              取消
            </Button>
            <Button
              variant="gold"
              onClick={handleConfirmUploadTarget}
              disabled={uploadTargetModal.files.length === 0}
            >
              开始上传
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <section className="rounded-2xl border border-neutral-200/70 dark:border-neutral-700/70 bg-neutral-50/70 dark:bg-neutral-900/40 p-4 space-y-3">
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">上传路径</label>
              <select
                value={uploadTargetFolderId}
                onChange={(e) => setUploadTargetFolderId(e.target.value)}
                className="w-full rounded-xl border bg-white dark:bg-neutral-900 px-4 py-2.5 text-sm text-neutral-900 dark:text-neutral-100 border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:border-[#D4AF37]"
              >
                <option value="root">/（根目录）</option>
                {uploadTargetFolders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.path}
                  </option>
                ))}
              </select>
              <div className="pt-1">
                <Button variant="secondary" onClick={handleSelectUploadFiles} fullWidth>
                  选择上传文件
                </Button>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                支持多选；点击“开始上传”后可在传输中心查看进度。
              </p>
            </section>

            <section className="rounded-2xl border border-neutral-200/70 dark:border-neutral-700/70 bg-white dark:bg-neutral-900 p-4">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-200/70 dark:border-neutral-700/70">
                <h3 className="text-sm font-medium text-neutral-800 dark:text-neutral-200">文件列表</h3>
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  {uploadTargetModal.files.length} 个 · {formatFileSize(uploadTargetTotalBytes)}
                </span>
              </div>
              <div className="mt-3 max-h-72 overflow-auto">
                {uploadTargetModal.files.length === 0 ? (
                  <div className="h-28 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 flex items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">
                    还未选择文件
                  </div>
                ) : (
                  <ul className="divide-y divide-neutral-200/70 dark:divide-neutral-700/70">
                    {uploadTargetModal.files.map((file, index) => (
                      <li key={`${file.name}-${file.size}-${index}`} className="py-2.5 flex items-center justify-between gap-3">
                        <span className="text-sm text-neutral-700 dark:text-neutral-300 truncate">{file.name}</span>
                        <span className="text-xs text-neutral-500 dark:text-neutral-400 shrink-0">
                          {formatFileSize(file.size)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </div>
        </div>
      </Modal>

      <Modal
        open={permanentDeleteModal.visible}
        onClose={closePermanentDeleteModal}
        title="永久删除确认"
        size="sm"
        closeOnOverlayClick={!permanentDeleteLoading}
        closeOnEscape={!permanentDeleteLoading}
        showCloseButton={!permanentDeleteLoading}
        footer={
          <>
            <Button variant="ghost" onClick={closePermanentDeleteModal} disabled={permanentDeleteLoading}>
              取消
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmPermanentDelete}
              loading={permanentDeleteLoading}
              disabled={permanentDeleteLoading}
            >
              确认永久删除
            </Button>
          </>
        }
      >
        <p className="text-neutral-600 dark:text-neutral-400">
          确定要永久删除{' '}
          <span className="font-medium text-neutral-900 dark:text-neutral-100">
            {permanentDeleteModal.file?.name}
          </span>{' '}
          吗？该操作会尝试同步删除 Telegram 频道中的分片消息，且不可恢复。
        </p>
      </Modal>

      {/* 移动/复制 模态框 */}
      <Modal
        open={moveModal.visible}
        onClose={closeMoveModal}
        title={moveModal.action === 'move' ? '移动到' : '复制到'}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={closeMoveModal}>
              取消
            </Button>
            <Button variant="gold" onClick={handleConfirmMoveOrCopy}>
              {moveModal.action === 'move' ? '移动' : '复制'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">目标文件：{moveModal.file?.name}</p>
          <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">目标目录</label>
          <select
            value={moveTargetFolderId}
            onChange={(e) => setMoveTargetFolderId(e.target.value)}
            className="w-full rounded-xl border bg-white dark:bg-neutral-900 px-4 py-2.5 text-sm text-neutral-900 dark:text-neutral-100 border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:border-[#D4AF37]"
          >
            <option value="root">/（根目录）</option>
            {moveTargetFolders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.path}
              </option>
            ))}
          </select>
        </div>
      </Modal>

      {/* 文件信息模态框 */}
      <Modal open={!!infoFile} onClose={() => setInfoFile(null)} title="文件信息" size="md">
        {infoFile && (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-neutral-500 dark:text-neutral-400">名称</span>
              <span className="text-neutral-900 dark:text-neutral-100 text-right break-all">{infoFile.name}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-neutral-500 dark:text-neutral-400">类型</span>
              <span className="text-neutral-900 dark:text-neutral-100">{infoFile.type}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-neutral-500 dark:text-neutral-400">大小</span>
              <span className="text-neutral-900 dark:text-neutral-100">
                {infoFile.type === 'folder' ? '-' : formatFileSize(infoFile.size)}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-neutral-500 dark:text-neutral-400">路径</span>
              <span className="text-neutral-900 dark:text-neutral-100 text-right break-all">{infoFile.path}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-neutral-500 dark:text-neutral-400">创建时间</span>
              <span className="text-neutral-900 dark:text-neutral-100">{formatDateTime(infoFile.createdAt)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-neutral-500 dark:text-neutral-400">更新时间</span>
              <span className="text-neutral-900 dark:text-neutral-100">{formatDateTime(infoFile.updatedAt)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-neutral-500 dark:text-neutral-400">收藏</span>
              <span className="text-neutral-900 dark:text-neutral-100">{infoFile.isFavorite ? '是' : '否'}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-neutral-500 dark:text-neutral-400">分享</span>
              <span className="text-neutral-900 dark:text-neutral-100">{infoFile.isShared ? '是' : '否'}</span>
            </div>
            {infoFile.trashedAt && (
              <div className="flex justify-between gap-4">
                <span className="text-neutral-500 dark:text-neutral-400">回收站时间</span>
                <span className="text-neutral-900 dark:text-neutral-100">{formatDateTime(infoFile.trashedAt)}</span>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ToastContainer />
    </>
  );
}
