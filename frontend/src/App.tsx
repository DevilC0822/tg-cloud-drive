import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { useLocation, useNavigate } from 'react-router-dom';
import { Checkbox as HeroCheckbox, Label as HeroLabel, ListBox as HeroListBox, Select as HeroSelect } from '@heroui/react';
import { ArrowDown, ArrowUp, ArrowUpDown, CloudUpload, FileArchive, FileText, Link2 } from 'lucide-react';
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
import { ActionTextButton } from '@/components/ui/HeroActionPrimitives';
import { ToastContainer } from '@/components/ui/ToastContainer';
import { useFiles } from '@/hooks/useFiles';
import { useToast } from '@/hooks/useToast';
import { useUpload } from '@/hooks/useUpload';
import { useTransferCenter } from '@/hooks/useTransferCenter';
import { useTorrentTasks } from '@/hooks/useTorrentTasks';
import { useTheme } from '@/hooks/useTheme';
import {
  previewModalAtom,
  newFolderModalAtom,
  renameModalAtom,
  deleteModalAtom,
  contextMenuAtom,
} from '@/stores/uiAtoms';
import { authCheckedAtom, authenticatedAtom } from '@/stores/authAtoms';
import type { FileItem, SortBy, BreadcrumbItem, TorrentMetaPreview, TorrentTask } from '@/types';
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

function buildBatchUploadFolderName(date: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());
  return `批量上传_${year}${month}${day}_${hour}${minute}`;
}

function buildTorrentSelectionFolderName(torrentName: string, date: Date = new Date()): string {
  const base = torrentName.trim() || 'Torrent';
  return `${base}_筛选下载_${buildBatchUploadFolderName(date).replace(/^批量上传_/, '')}`;
}

function inferTorrentFileType(filePath: string): string {
  const lowerPath = filePath.trim().toLowerCase();
  const ext = lowerPath.includes('.') ? lowerPath.split('.').pop() || '' : '';
  if (!ext) {
    return '未知';
  }

  if (['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v', 'ts'].includes(ext)) {
    return '视频';
  }
  if (['mp3', 'flac', 'wav', 'aac', 'ogg', 'm4a', 'ape'].includes(ext)) {
    return '音频';
  }
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'heic', 'svg'].includes(ext)) {
    return '图片';
  }
  if (['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'md', 'epub'].includes(ext)) {
    return '文档';
  }
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(ext)) {
    return '压缩包';
  }
  if (['srt', 'ass', 'ssa', 'vtt', 'sub'].includes(ext)) {
    return '字幕';
  }
  if (['exe', 'msi', 'dmg', 'pkg', 'apk', 'ipa'].includes(ext)) {
    return '安装包';
  }
  return '其他';
}

type TorrentPreviewSortField = 'source' | 'filePath' | 'fileSize';

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
  const torrentTasksEnabled = transferCenterEnabled && activeNav === 'transfers';

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

  const {
    tasks: torrentTasks,
    loading: torrentTasksLoading,
    submitting: torrentTaskSubmitting,
    previewTorrent,
    createTask: createTorrentTask,
    getTaskDetail: getTorrentTaskDetail,
    dispatchTask: dispatchTorrentTask,
    deleteTask: deleteTorrentTask,
    retryTask: retryTorrentTask,
  } = useTorrentTasks({ enabled: torrentTasksEnabled });

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
  const [uploadTargetMode, setUploadTargetMode] = useState<'file' | 'torrent'>('file');
  const [uploadTargetFolderId, setUploadTargetFolderId] = useState<string>('root');
  const [uploadCreateFolderEnabled, setUploadCreateFolderEnabled] = useState(false);
  const [uploadCreateFolderName, setUploadCreateFolderName] = useState('');
  const [uploadTorrentURL, setUploadTorrentURL] = useState('');
  const [uploadTorrentFile, setUploadTorrentFile] = useState<File | null>(null);
  const [torrentPreview, setTorrentPreview] = useState<TorrentMetaPreview | null>(null);
  const [torrentPreviewLoading, setTorrentPreviewLoading] = useState(false);
  const [torrentPreviewError, setTorrentPreviewError] = useState('');
  const [torrentPreviewSelectedFileIndexes, setTorrentPreviewSelectedFileIndexes] = useState<number[]>([]);
  const [torrentPreviewSortField, setTorrentPreviewSortField] = useState<TorrentPreviewSortField>('source');
  const [torrentPreviewSortOrder, setTorrentPreviewSortOrder] = useState<'asc' | 'desc'>('asc');
  const [torrentSelectionModal, setTorrentSelectionModal] = useState<{
    visible: boolean;
    task: TorrentTask | null;
    selectedFileIndexes: number[];
    loading: boolean;
  }>({
    visible: false,
    task: null,
    selectedFileIndexes: [],
    loading: false,
  });
  const uploadTorrentFileInputRef = useRef<HTMLInputElement>(null);
  const torrentPreviewRequestSeqRef = useRef(0);
  const lastTorrentSelectionCountRef = useRef(0);
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
    setUploadTargetMode('file');
    setUploadTargetFolderId('root');
    setUploadCreateFolderEnabled(false);
    setUploadCreateFolderName('');
    setUploadTorrentURL('');
    setUploadTorrentFile(null);
    setTorrentPreview(null);
    setTorrentPreviewLoading(false);
    setTorrentPreviewError('');
    setTorrentPreviewSelectedFileIndexes([]);
    setTorrentPreviewSortField('source');
    setTorrentPreviewSortOrder('asc');
    torrentPreviewRequestSeqRef.current += 1;
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

  const handleSelectTorrentSeedFile = useCallback(() => {
    uploadTorrentFileInputRef.current?.click();
  }, []);

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

  const closeTorrentSelectionModal = useCallback(() => {
    setTorrentSelectionModal({
      visible: false,
      task: null,
      selectedFileIndexes: [],
      loading: false,
    });
  }, []);

  const handleOpenTorrentSelection = useCallback(
    async (taskId: string) => {
      setTorrentSelectionModal({
        visible: true,
        task: null,
        selectedFileIndexes: [],
        loading: true,
      });

      const result = await getTorrentTaskDetail(taskId);
      if (!result.ok) {
        closeTorrentSelectionModal();
        pushToast({ type: 'error', message: result.reason });
        return;
      }
      const task = result.task;
      const defaultIndexes = (task.files || [])
        .filter((file) => file.selected)
        .map((file) => file.fileIndex);

      setTorrentSelectionModal({
        visible: true,
        task,
        selectedFileIndexes: defaultIndexes,
        loading: false,
      });
    },
    [closeTorrentSelectionModal, getTorrentTaskDetail, pushToast]
  );

  const handleToggleTorrentSelectionFile = useCallback((fileIndex: number) => {
    setTorrentSelectionModal((prev) => {
      const selected = new Set(prev.selectedFileIndexes);
      if (selected.has(fileIndex)) {
        selected.delete(fileIndex);
      } else {
        selected.add(fileIndex);
      }
      return {
        ...prev,
        selectedFileIndexes: Array.from(selected.values()).sort((a, b) => a - b),
      };
    });
  }, []);

  const handleConfirmTorrentDispatch = useCallback(async () => {
    const task = torrentSelectionModal.task;
    if (!task) return;
    const fileIndexes = torrentSelectionModal.selectedFileIndexes;
    if (fileIndexes.length === 0) {
      pushToast({ type: 'error', message: '请至少选择一个文件' });
      return;
    }

    setTorrentSelectionModal((prev) => ({ ...prev, loading: true }));
    const result = await dispatchTorrentTask(task.id, fileIndexes);
    if (!result.ok) {
      setTorrentSelectionModal((prev) => ({ ...prev, loading: false }));
      pushToast({ type: 'error', message: result.reason });
      return;
    }

    closeTorrentSelectionModal();
    pushToast({ type: 'success', message: '文件选择已提交，任务将开始发送到 Telegram' });
  }, [
    closeTorrentSelectionModal,
    dispatchTorrentTask,
    pushToast,
    torrentSelectionModal.selectedFileIndexes,
    torrentSelectionModal.task,
  ]);

  const handleDeleteTorrentTask = useCallback(
    async (taskID: string) => {
      const id = taskID.trim();
      if (!id) {
        return;
      }
      const confirmed = window.confirm('删除后将尝试清理 qBittorrent 任务和未完成下载文件，是否继续？');
      if (!confirmed) {
        return;
      }

      const result = await deleteTorrentTask(id);
      if (!result.ok) {
        pushToast({ type: 'error', message: result.reason });
        return;
      }
      const warnings = result.cleanupWarnings || [];
      if (warnings.length > 0) {
        pushToast({ type: 'info', message: `任务已删除，清理告警：${warnings[0]}` });
        return;
      }
      pushToast({ type: 'success', message: 'Torrent 任务已删除' });
    },
    [deleteTorrentTask, pushToast]
  );

  const handleRetryTorrentTask = useCallback(
    async (taskID: string) => {
      const id = taskID.trim();
      if (!id) {
        return;
      }
      const result = await retryTorrentTask(id);
      if (!result.ok) {
        pushToast({ type: 'error', message: result.reason });
        return;
      }
      const warnings = result.cleanupWarnings || [];
      if (warnings.length > 0) {
        pushToast({ type: 'info', message: `已加入重试队列，清理告警：${warnings[0]}` });
        return;
      }
      pushToast({ type: 'success', message: '已加入重试队列，任务将重新下载' });
    },
    [pushToast, retryTorrentTask]
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
    setUploadTargetMode('file');
    setUploadCreateFolderEnabled(false);
    setUploadCreateFolderName('');
    setUploadTorrentURL('');
    setUploadTorrentFile(null);
    setTorrentPreview(null);
    setTorrentPreviewLoading(false);
    setTorrentPreviewError('');
    setTorrentPreviewSelectedFileIndexes([]);
    setTorrentPreviewSortField('source');
    setTorrentPreviewSortOrder('asc');
    torrentPreviewRequestSeqRef.current += 1;
  }, []);

  useEffect(() => {
    if (uploadTargetMode === 'file') {
      if (uploadTargetModal.files.length > 1) {
        return;
      }
      setUploadCreateFolderEnabled(false);
      setUploadCreateFolderName('');
      return;
    }
    if (uploadTargetMode === 'torrent') {
      if (torrentPreview && torrentPreviewSelectedFileIndexes.length > 1) {
        return;
      }
      setUploadCreateFolderEnabled(false);
      setUploadCreateFolderName('');
      return;
    }
    setUploadCreateFolderEnabled(false);
    setUploadCreateFolderName('');
  }, [
    uploadTargetMode,
    uploadTargetModal.files.length,
    torrentPreview,
    torrentPreviewSelectedFileIndexes.length,
  ]);

  useEffect(() => {
    if (!uploadTargetModal.visible || uploadTargetMode !== 'torrent') {
      setTorrentPreview(null);
      setTorrentPreviewLoading(false);
      setTorrentPreviewError('');
      setTorrentPreviewSelectedFileIndexes([]);
      torrentPreviewRequestSeqRef.current += 1;
      return;
    }

    const torrentUrl = uploadTorrentURL.trim();
    const torrentFile = uploadTorrentFile;
    const hasURL = torrentUrl.length > 0;
    const hasFile = !!torrentFile;

    if (!hasURL && !hasFile) {
      setTorrentPreview(null);
      setTorrentPreviewLoading(false);
      setTorrentPreviewError('');
      setTorrentPreviewSelectedFileIndexes([]);
      torrentPreviewRequestSeqRef.current += 1;
      return;
    }

    if (!hasFile && !/^https?:\/\//i.test(torrentUrl)) {
      setTorrentPreview(null);
      setTorrentPreviewLoading(false);
      setTorrentPreviewError('请输入有效的 http(s) 种子链接，或直接选择种子文件');
      setTorrentPreviewSelectedFileIndexes([]);
      torrentPreviewRequestSeqRef.current += 1;
      return;
    }

    const requestSeq = torrentPreviewRequestSeqRef.current + 1;
    torrentPreviewRequestSeqRef.current = requestSeq;
    const parseDelay = hasFile ? 0 : 450;
    const timer = window.setTimeout(() => {
      setTorrentPreviewLoading(true);
      setTorrentPreviewError('');

      void (async () => {
        const result = await previewTorrent({
          torrentUrl: hasURL ? torrentUrl : undefined,
          torrentFile: torrentFile ?? undefined,
        });
        if (torrentPreviewRequestSeqRef.current !== requestSeq) {
          return;
        }
        if (!result.ok) {
          setTorrentPreview(null);
          setTorrentPreviewError(result.reason);
          setTorrentPreviewSelectedFileIndexes([]);
          return;
        }
        const defaultSelectedIndexes = result.preview.files.map((file) => file.fileIndex);
        setTorrentPreviewSortField('source');
        setTorrentPreviewSortOrder('asc');
        setTorrentPreviewSelectedFileIndexes(defaultSelectedIndexes);
        setUploadCreateFolderEnabled(defaultSelectedIndexes.length > 1);
        setUploadCreateFolderName('');
        setTorrentPreview(result.preview);
        setTorrentPreviewError('');
      })().finally(() => {
        if (torrentPreviewRequestSeqRef.current === requestSeq) {
          setTorrentPreviewLoading(false);
        }
      });
    }, parseDelay);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    previewTorrent,
    uploadTargetModal.visible,
    uploadTargetMode,
    uploadTorrentFile,
    uploadTorrentURL,
  ]);

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
    const destinationFolderId = uploadTargetFolderId === 'root' ? null : uploadTargetFolderId;

    if (uploadTargetMode === 'torrent') {
      const torrentFile = uploadTorrentFile;
      const torrentUrl = torrentFile ? '' : uploadTorrentURL.trim();
      const selectedFileIndexes = Array.from(
        new Set(torrentPreviewSelectedFileIndexes.filter((idx) => Number.isInteger(idx) && idx >= 0))
      ).sort((a, b) => a - b);
      if (!torrentUrl && !torrentFile) {
        pushToast({ type: 'error', message: '请填写 Torrent URL 或选择种子文件' });
        return;
      }
      if (torrentPreviewLoading) {
        pushToast({ type: 'info', message: '正在解析种子内容，请稍候再创建任务' });
        return;
      }
      if (!torrentPreview) {
        pushToast({ type: 'error', message: '请先完成种子解析并确认文件列表' });
        return;
      }
      if (selectedFileIndexes.length === 0) {
        pushToast({ type: 'error', message: '请至少选择一个种子文件' });
        return;
      }
      const shouldCreateBatchFolder = uploadCreateFolderEnabled && selectedFileIndexes.length > 1;
      const fallbackBatchFolderName = buildTorrentSelectionFolderName(torrentPreview.torrentName);
      const requestedBatchFolderName = uploadCreateFolderName.trim() || fallbackBatchFolderName;

      void (async () => {
        let resolvedDestinationFolderId = destinationFolderId;
        if (shouldCreateBatchFolder) {
          try {
            const created = await apiFetchJson<{ item: { id: string; name: string } }>('/api/folders', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ parentId: destinationFolderId, name: requestedBatchFolderName }),
            });
            resolvedDestinationFolderId = created.item.id;
            pushToast({
              type: 'info',
              message: `已创建文件夹“${created.item.name}”，Torrent 文件将保存到该目录`,
            });
          } catch (err: unknown) {
            const e = err as ApiError;
            pushToast({ type: 'error', message: e?.message || '创建下载文件夹失败，本次任务已取消' });
            return;
          }
        }

        const result = await createTorrentTask({
          parentId: resolvedDestinationFolderId,
          torrentUrl: torrentUrl || undefined,
          torrentFile,
          selectedFileIndexes,
        });
        if (!result.ok) {
          pushToast({ type: 'error', message: result.reason });
          return;
        }
        closeUploadTargetModal();
        pushToast({ type: 'success', message: 'Torrent 任务已创建，可在传输中心查看进度' });
      })();
      return;
    }

    if (uploadTargetModal.files.length === 0) return;
    const selectedFiles = uploadTargetModal.files.slice();
    const shouldCreateBatchFolder = uploadCreateFolderEnabled && selectedFiles.length > 1;
    const fallbackBatchFolderName = buildBatchUploadFolderName();
    const requestedBatchFolderName = uploadCreateFolderName.trim() || fallbackBatchFolderName;
    closeUploadTargetModal();

    void (async () => {
      let resolvedDestinationFolderId = destinationFolderId;

      if (shouldCreateBatchFolder) {
        try {
          const created = await apiFetchJson<{ item: { id: string; name: string } }>('/api/folders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ parentId: destinationFolderId, name: requestedBatchFolderName }),
          });
          resolvedDestinationFolderId = created.item.id;
          pushToast({
            type: 'info',
            message: `已创建文件夹“${created.item.name}”，即将开始上传`,
          });
        } catch (err: unknown) {
          const e = err as ApiError;
          pushToast({ type: 'error', message: e?.message || '创建上传文件夹失败，本次上传已取消' });
          return;
        }
      }

      pushToast({ type: 'success', message: `已加入上传队列（${selectedFiles.length} 个文件）` });
      const results = await uploadFiles(selectedFiles, resolvedDestinationFolderId);
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
  }, [
    closeUploadTargetModal,
    createTorrentTask,
    pushToast,
    uploadFiles,
    uploadCreateFolderEnabled,
    uploadCreateFolderName,
    uploadTargetFolderId,
    uploadTargetModal.files,
    uploadTargetMode,
    torrentPreview,
    torrentPreviewLoading,
    torrentPreviewSelectedFileIndexes,
    uploadTorrentFile,
    uploadTorrentURL,
  ]);

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
  const hasTorrentURL = uploadTorrentURL.trim().length > 0;
  const hasTorrentFile = Boolean(uploadTorrentFile);
  const torrentSourceReady = hasTorrentURL || hasTorrentFile;
  const torrentPreviewSelectedSet = useMemo(
    () => new Set(torrentPreviewSelectedFileIndexes),
    [torrentPreviewSelectedFileIndexes]
  );
  const selectedTorrentPreviewFileCount = useMemo(() => {
    if (!torrentPreview) {
      return 0;
    }
    return torrentPreview.files.reduce(
      (count, file) => (torrentPreviewSelectedSet.has(file.fileIndex) ? count + 1 : count),
      0
    );
  }, [torrentPreview, torrentPreviewSelectedSet]);
  const allTorrentPreviewFilesSelected = Boolean(
    torrentPreview &&
      torrentPreview.files.length > 0 &&
      selectedTorrentPreviewFileCount === torrentPreview.files.length
  );
  const isTorrentPreviewPartiallySelected = Boolean(
    torrentPreview &&
      selectedTorrentPreviewFileCount > 0 &&
      selectedTorrentPreviewFileCount < torrentPreview.files.length
  );
  useEffect(() => {
    if (uploadTargetMode !== 'torrent' || !torrentPreview) {
      lastTorrentSelectionCountRef.current = 0;
      return;
    }
    const previous = lastTorrentSelectionCountRef.current;
    if (previous <= 1 && selectedTorrentPreviewFileCount > 1) {
      setUploadCreateFolderEnabled(true);
    }
    lastTorrentSelectionCountRef.current = selectedTorrentPreviewFileCount;
  }, [selectedTorrentPreviewFileCount, torrentPreview, uploadTargetMode]);
  const torrentCreateDisabled =
    !torrentSourceReady ||
    torrentTaskSubmitting ||
    torrentPreviewLoading ||
    !torrentPreview ||
    selectedTorrentPreviewFileCount === 0;
  const sortedTorrentPreviewFiles = useMemo(() => {
    if (!torrentPreview) {
      return [];
    }
    const withType = torrentPreview.files.map((file) => ({
      ...file,
      fileType: inferTorrentFileType(file.filePath),
    }));

    if (torrentPreviewSortField === 'source') {
      return withType.sort((a, b) =>
        torrentPreviewSortOrder === 'asc' ? a.fileIndex - b.fileIndex : b.fileIndex - a.fileIndex
      );
    }

    if (torrentPreviewSortField === 'filePath') {
      return withType.sort((a, b) => {
        const compared = a.filePath.localeCompare(b.filePath, 'zh-CN');
        return torrentPreviewSortOrder === 'asc' ? compared : -compared;
      });
    }

    return withType.sort((a, b) => {
      if (a.fileSize !== b.fileSize) {
        return torrentPreviewSortOrder === 'asc' ? a.fileSize - b.fileSize : b.fileSize - a.fileSize;
      }
      return a.filePath.localeCompare(b.filePath, 'zh-CN');
    });
  }, [torrentPreview, torrentPreviewSortField, torrentPreviewSortOrder]);

  const handleToggleAllTorrentPreviewFiles = useCallback(() => {
    if (!torrentPreview) {
      return;
    }
    if (allTorrentPreviewFilesSelected) {
      setTorrentPreviewSelectedFileIndexes([]);
      return;
    }
    setTorrentPreviewSelectedFileIndexes(torrentPreview.files.map((file) => file.fileIndex));
  }, [allTorrentPreviewFilesSelected, torrentPreview]);

  const handleToggleTorrentPreviewFile = useCallback((fileIndex: number) => {
    setTorrentPreviewSelectedFileIndexes((prev) => {
      const selected = new Set(prev);
      if (selected.has(fileIndex)) {
        selected.delete(fileIndex);
      } else {
        selected.add(fileIndex);
      }
      return Array.from(selected.values()).sort((a, b) => a - b);
    });
  }, []);

  const handleTorrentPreviewSort = useCallback(
    (field: TorrentPreviewSortField) => {
      if (torrentPreviewSortField === field) {
        setTorrentPreviewSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
        return;
      }
      setTorrentPreviewSortField(field);
      setTorrentPreviewSortOrder('asc');
    },
    [torrentPreviewSortField]
  );

  const renderTorrentPreviewSortIcon = useCallback(
    (field: TorrentPreviewSortField) => {
      if (torrentPreviewSortField !== field) {
        return <ArrowUpDown className="h-3.5 w-3.5 text-neutral-400" />;
      }
      if (torrentPreviewSortOrder === 'asc') {
        return <ArrowUp className="h-3.5 w-3.5 text-[var(--theme-primary-ink)]" />;
      }
      return <ArrowDown className="h-3.5 w-3.5 text-[var(--theme-primary-ink)]" />;
    },
    [torrentPreviewSortField, torrentPreviewSortOrder]
  );

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
            <ActionTextButton
              tone="brand"
              density="cozy"
              className="w-full justify-center"
              onPress={handleLogin}
              isDisabled={loginLoading}
            >
              {loginLoading ? '登录中...' : '登录'}
            </ActionTextButton>
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
            torrentTasks={torrentTasks}
            torrentLoading={torrentTasksLoading}
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
            onOpenTorrentSelection={handleOpenTorrentSelection}
            onDeleteTorrentTask={handleDeleteTorrentTask}
            onRetryTorrentTask={handleRetryTorrentTask}
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
        description="创建后将出现在当前目录中，可继续重命名或移动。"
        size="sm"
        footer={
          <>
            <ActionTextButton onPress={() => setNewFolderModal(false)} className="min-w-[96px] justify-center">
              取消
            </ActionTextButton>
            <ActionTextButton
              tone="brand"
              onPress={handleCreateFolder}
              className="min-w-[108px] justify-center border-transparent bg-[var(--theme-primary)] text-neutral-900"
            >
              创建
            </ActionTextButton>
          </>
        }
      >
        <div className="space-y-3">
          <div className="rounded-xl border border-neutral-200/75 bg-neutral-50/80 p-3 dark:border-neutral-700/75 dark:bg-neutral-900/55">
            <Input
              label="文件夹名称"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="请输入文件夹名称"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
            />
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            建议使用有业务含义的命名，便于后续检索和批量管理。
          </p>
        </div>
      </Modal>

      {/* 重命名模态框 */}
      <Modal
        open={renameModal.visible}
        onClose={() => {
          setRenameModal({ visible: false, file: null });
          setRenameError('');
        }}
        title="重命名"
        description="更新文件名称，不会影响文件内容和存储位置。"
        size="sm"
        footer={
          <>
            <ActionTextButton
              onPress={() => {
                setRenameModal({ visible: false, file: null });
                setRenameError('');
              }}
              className="min-w-[96px] justify-center"
            >
              取消
            </ActionTextButton>
            <ActionTextButton
              tone="brand"
              onPress={handleConfirmRename}
              className="min-w-[108px] justify-center border-transparent bg-[var(--theme-primary)] text-neutral-900"
            >
              确定
            </ActionTextButton>
          </>
        }
      >
        <div className="space-y-3">
          <div className="rounded-xl border border-neutral-200/75 bg-neutral-50/80 p-3 dark:border-neutral-700/75 dark:bg-neutral-900/55">
            <p className="mb-2 text-xs text-neutral-500 dark:text-neutral-400">
              当前名称：<span className="text-neutral-700 dark:text-neutral-300">{renameModal.file?.name || '-'}</span>
            </p>
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
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            重命名后，分享链接和文件内容不会改变。
          </p>
        </div>
      </Modal>

      {/* 删除确认模态框 */}
      <Modal
        open={deleteModal.visible}
        onClose={() => setDeleteModal({ visible: false, files: [] })}
        title="确认删除"
        description="删除后文件将进入回收站，可在回收站中恢复。"
        size="sm"
        footer={
          <>
            <ActionTextButton
              onPress={() => setDeleteModal({ visible: false, files: [] })}
              className="min-w-[96px] justify-center"
            >
              取消
            </ActionTextButton>
            <ActionTextButton tone="danger" onPress={handleConfirmDelete} className="min-w-[120px] justify-center">
              删除
            </ActionTextButton>
          </>
        }
      >
        <div className="rounded-xl border border-amber-200/80 bg-amber-50/70 p-3 text-sm text-amber-800 dark:border-amber-800/70 dark:bg-amber-900/20 dark:text-amber-200">
          确定要删除{' '}
          <span className="font-semibold">
            {deleteModal.files.length === 1
              ? deleteModal.files[0].name
              : `${deleteModal.files.length} 个文件`}
          </span>{' '}
          吗？
        </div>
      </Modal>

      {/* 统一上传文件弹窗 */}
      <Modal
        open={uploadTargetModal.visible}
        onClose={closeUploadTargetModal}
        title="上传文件"
        description="支持本地文件上传或创建 Torrent 下载任务。"
        size="3xl"
        closeOnOverlayClick={false}
        closeOnEscape={false}
        footer={
          <>
            <ActionTextButton onPress={closeUploadTargetModal} className="min-w-[96px] justify-center">
              取消
            </ActionTextButton>
            <ActionTextButton
              tone="brand"
              onPress={handleConfirmUploadTarget}
              isDisabled={
                uploadTargetMode === 'file'
                  ? uploadTargetModal.files.length === 0
                  : torrentCreateDisabled
              }
              className="min-w-[124px] justify-center border-transparent bg-[var(--theme-primary)] text-neutral-900 shadow-[0_12px_24px_-18px_rgba(30,41,59,0.55)]"
            >
              {uploadTargetMode === 'torrent' && torrentTaskSubmitting
                ? '创建中...'
                : uploadTargetMode === 'torrent' && torrentPreviewLoading
                  ? '解析中...'
                : uploadTargetMode === 'file'
                  ? '开始上传'
                  : '创建任务'}
            </ActionTextButton>
          </>
        }
      >
        <div className="space-y-4">
          <section className="rounded-2xl border border-[var(--theme-primary-a24)] bg-[linear-gradient(138deg,var(--theme-primary-a20),var(--theme-primary-a08))] p-3.5 shadow-[0_14px_28px_-24px_rgba(30,41,59,0.5)]">
            <div className="inline-flex rounded-xl border border-neutral-200/80 bg-white/78 p-1 dark:border-neutral-700/80 dark:bg-neutral-900/68">
              <ActionTextButton
                tone="brand"
                active={uploadTargetMode === 'file'}
                density="cozy"
                className="min-w-[112px] justify-center"
                onPress={() => setUploadTargetMode('file')}
              >
                本地文件
              </ActionTextButton>
              <ActionTextButton
                tone="brand"
                active={uploadTargetMode === 'torrent'}
                density="cozy"
                className="min-w-[128px] justify-center"
                onPress={() => setUploadTargetMode('torrent')}
              >
                Torrent 下载
              </ActionTextButton>
            </div>
            <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-300">
              {uploadTargetMode === 'file'
                ? '选择本地文件并确认后，将立即加入上传队列。'
                : '填写 URL 或选择种子文件后，创建异步下载任务。'}
            </p>
          </section>

          <section className="rounded-2xl border border-neutral-200/70 bg-white p-4 dark:border-neutral-700/70 dark:bg-neutral-900">
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--theme-primary-a20)] text-[11px] font-semibold text-[var(--theme-primary-ink)]">
                1
              </span>
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                {uploadTargetMode === 'file' ? '选择上传文件' : '配置任务来源'}
              </h3>
            </div>

            <div className="mb-4 space-y-2">
              <label className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-500 dark:text-neutral-400">
                目标目录
              </label>
              <HeroSelect
                aria-label="上传目标目录"
                value={uploadTargetFolderId}
                onChange={(value) => setUploadTargetFolderId(value as string)}
                variant="secondary"
                className="w-full"
              >
                <HeroSelect.Trigger className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100">
                  <HeroSelect.Value />
                  <HeroSelect.Indicator />
                </HeroSelect.Trigger>
                <HeroSelect.Popover className="min-w-[var(--trigger-width)]">
                  <HeroListBox>
                    <HeroListBox.Item id="root" textValue="/（根目录）">
                      <HeroLabel>/（根目录）</HeroLabel>
                      <HeroListBox.ItemIndicator />
                    </HeroListBox.Item>
                    {uploadTargetFolders.map((folder) => (
                      <HeroListBox.Item key={folder.id} id={folder.id} textValue={folder.path}>
                        <HeroLabel>{folder.path}</HeroLabel>
                        <HeroListBox.ItemIndicator />
                      </HeroListBox.Item>
                    ))}
                  </HeroListBox>
                </HeroSelect.Popover>
              </HeroSelect>
            </div>

            {uploadTargetMode === 'file' ? (
              <div className="space-y-3">
                <div className="rounded-2xl border border-dashed border-[var(--theme-primary-a35)] bg-neutral-50/75 p-4 text-center dark:bg-neutral-800/45">
                  <CloudUpload className="mx-auto h-9 w-9 text-[var(--theme-primary)]" />
                  <p className="mt-2 text-sm font-medium text-neutral-800 dark:text-neutral-200">
                    选择要上传的本地文件
                  </p>
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                    支持多选，重复选择会覆盖当前列表。
                  </p>
                  <ActionTextButton
                    onPress={handleSelectUploadFiles}
                    density="cozy"
                    className="mt-3 w-full justify-center border-transparent bg-[var(--theme-primary-a20)] text-[var(--theme-primary-ink)]"
                  >
                    选择上传文件
                  </ActionTextButton>
                </div>

                {uploadTargetModal.files.length > 0 ? (
                  <div className="rounded-xl border border-neutral-200/75 bg-white/82 p-3 dark:border-neutral-700/75 dark:bg-neutral-900/62">
                    <p className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
                      已选择 {uploadTargetModal.files.length} 个文件（{formatFileSize(uploadTargetTotalBytes)}）
                    </p>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="space-y-3">
                <Input
                  label="Torrent URL"
                  value={uploadTorrentURL}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    setUploadTorrentURL(nextValue);
                    if (nextValue.trim()) {
                      setUploadTorrentFile(null);
                    }
                  }}
                  placeholder={
                    hasTorrentFile ? '已选择种子文件，删除后可输入 Torrent URL' : 'https://example.com/xxx.torrent'
                  }
                  disabled={hasTorrentFile}
                  autoComplete="off"
                />
                <input
                  ref={uploadTorrentFileInputRef}
                  type="file"
                  accept=".torrent,application/x-bittorrent"
                  autoComplete="off"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setUploadTorrentFile(file);
                    if (file) {
                      setUploadTorrentURL('');
                    }
                    e.target.value = '';
                  }}
                />
                {!hasTorrentURL ? (
                  <ActionTextButton
                    onPress={handleSelectTorrentSeedFile}
                    density="cozy"
                    className="w-full justify-center border-dashed border-neutral-300 dark:border-neutral-700"
                  >
                    选择种子文件
                  </ActionTextButton>
                ) : (
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    已输入 Torrent URL，如需改为种子文件请先删除当前 URL。
                  </p>
                )}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-neutral-200/70 bg-white p-4 dark:border-neutral-700/70 dark:bg-neutral-900">
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--theme-primary-a20)] text-[11px] font-semibold text-[var(--theme-primary-ink)]">
                2
              </span>
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">确认内容</h3>
            </div>

            {uploadTargetMode === 'file' ? (
              uploadTargetModal.files.length === 0 ? (
                <div className="flex h-28 flex-col items-center justify-center rounded-xl border border-dashed border-neutral-300 text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
                  <FileText className="mb-2 h-5 w-5 text-neutral-400 dark:text-neutral-500" />
                  请先选择要上传的文件
                </div>
              ) : (
                <div className="space-y-2">
                  {uploadTargetModal.files.slice(0, 6).map((file, index) => (
                    <div
                      key={`${file.name}-${file.size}-${index}`}
                      className="flex items-center gap-3 rounded-xl border border-neutral-200/75 bg-neutral-50/70 px-3 py-2.5 dark:border-neutral-700/75 dark:bg-neutral-800/58"
                    >
                      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--theme-primary-a20)] text-[11px] font-semibold text-[var(--theme-primary-ink)]">
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-neutral-700 dark:text-neutral-300">
                        {file.name}
                      </span>
                      <span className="shrink-0 text-xs text-neutral-500 dark:text-neutral-400">
                        {formatFileSize(file.size)}
                      </span>
                    </div>
                  ))}
                  {uploadTargetModal.files.length > 6 ? (
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      其余 {uploadTargetModal.files.length - 6} 个文件将在上传队列中处理
                    </p>
                  ) : null}
                  {uploadTargetModal.files.length > 1 ? (
                    <div className="rounded-xl border border-[var(--theme-primary-a24)] bg-[linear-gradient(138deg,var(--theme-primary-a12),var(--theme-primary-a08))] p-3">
                      <HeroCheckbox
                        isSelected={uploadCreateFolderEnabled}
                        onChange={() => setUploadCreateFolderEnabled((prev) => !prev)}
                        className="items-start gap-2.5"
                      >
                        <HeroCheckbox.Control className="mt-0.5">
                          <HeroCheckbox.Indicator />
                        </HeroCheckbox.Control>
                        <HeroCheckbox.Content className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                          为本次多文件上传创建新文件夹存放
                        </HeroCheckbox.Content>
                      </HeroCheckbox>
                      <p className="mt-1 pl-[1.625rem] text-xs text-neutral-600 dark:text-neutral-300">
                        勾选后会先在目标目录下创建子文件夹，再上传全部文件。
                      </p>
                      {uploadCreateFolderEnabled ? (
                        <div className="mt-3 pl-[1.625rem]">
                          <Input
                            label="新文件夹名称（可选）"
                            value={uploadCreateFolderName}
                            onChange={(e) => setUploadCreateFolderName(e.target.value)}
                            placeholder={buildBatchUploadFolderName()}
                            autoComplete="off"
                          />
                          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                            留空将自动使用默认名称。
                          </p>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )
            ) : (
              <div className="space-y-3">
                {uploadTorrentURL.trim() ? (
                  <div className="rounded-xl border border-dashed border-neutral-300 p-3 dark:border-neutral-700">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                        <Link2 className="h-3.5 w-3.5" />
                        Torrent URL
                      </div>
                      <ActionTextButton
                        density="cozy"
                        className="h-7 px-2 text-xs text-neutral-500 dark:text-neutral-400"
                        onPress={() => setUploadTorrentURL('')}
                      >
                        删除
                      </ActionTextButton>
                    </div>
                    <p className="truncate text-sm text-neutral-700 dark:text-neutral-300">{uploadTorrentURL.trim()}</p>
                  </div>
                ) : null}
                {uploadTorrentFile ? (
                  <div className="rounded-xl border border-dashed border-neutral-300 p-3 dark:border-neutral-700">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                        <FileArchive className="h-3.5 w-3.5" />
                        种子文件
                      </div>
                      <ActionTextButton
                        density="cozy"
                        className="h-7 px-2 text-xs text-neutral-500 dark:text-neutral-400"
                        onPress={() => setUploadTorrentFile(null)}
                      >
                        删除
                      </ActionTextButton>
                    </div>
                    <p className="truncate text-sm text-neutral-700 dark:text-neutral-300">{uploadTorrentFile.name}</p>
                  </div>
                ) : null}
                {!torrentSourceReady ? (
                  <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-neutral-300 text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
                    请填写 URL 或选择种子文件
                  </div>
                ) : null}
                {torrentPreviewLoading ? (
                  <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-[var(--theme-primary-a35)] bg-[var(--theme-primary-a08)] text-sm text-neutral-600 dark:text-neutral-300">
                    正在解析种子内容，请稍候...
                  </div>
                ) : null}
                {torrentPreviewError ? (
                  <div className="rounded-xl border border-amber-200/80 bg-amber-50/80 p-3 text-sm text-amber-800 dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-200">
                    {torrentPreviewError}
                  </div>
                ) : null}
                {torrentPreview ? (
                  <>
                    <div className="rounded-xl border border-neutral-200/75 bg-neutral-50/70 p-3 dark:border-neutral-700/75 dark:bg-neutral-800/58">
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">种子名称</p>
                      <p className="mt-1 truncate text-sm font-medium text-neutral-800 dark:text-neutral-200">
                        {torrentPreview.torrentName}
                      </p>
                      <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-neutral-600 dark:text-neutral-300 sm:grid-cols-3">
                        <span>文件数：{sortedTorrentPreviewFiles.length}</span>
                        <span>
                          已选择：{selectedTorrentPreviewFileCount}/{sortedTorrentPreviewFiles.length}
                        </span>
                        <span>总大小：{formatFileSize(torrentPreview.totalSize)}</span>
                        <span>{torrentPreview.isPrivate ? 'Private 种子' : '非 Private 种子'}</span>
                      </div>
                      <p className="mt-2 text-[11px] text-neutral-500 dark:text-neutral-400">
                        支持全选/取消全选，点击表头右侧图标切换排序
                      </p>
                    </div>
                    <div className="overflow-hidden rounded-xl border border-neutral-200/70 bg-white dark:border-neutral-700/70 dark:bg-neutral-900">
                      <div className="grid grid-cols-[40px_52px_minmax(0,1fr)_74px_92px] gap-3 border-b border-neutral-200/80 bg-neutral-50/96 px-3 py-2 text-[11px] font-medium tracking-[0.04em] text-neutral-500 backdrop-blur dark:border-neutral-700/80 dark:bg-neutral-900/95 dark:text-neutral-400">
                        <div className="flex items-center justify-center">
                          <HeroCheckbox
                            isSelected={allTorrentPreviewFilesSelected}
                            isIndeterminate={isTorrentPreviewPartiallySelected}
                            onChange={handleToggleAllTorrentPreviewFiles}
                            aria-label="全选种子文件"
                          >
                            <HeroCheckbox.Control>
                              <HeroCheckbox.Indicator />
                            </HeroCheckbox.Control>
                          </HeroCheckbox>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleTorrentPreviewSort('source')}
                          className="inline-flex items-center gap-1 text-left"
                        >
                          序号
                          {renderTorrentPreviewSortIcon('source')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTorrentPreviewSort('filePath')}
                          className="inline-flex items-center gap-1 text-left"
                        >
                          文件路径
                          {renderTorrentPreviewSortIcon('filePath')}
                        </button>
                        <span>类型</span>
                        <button
                          type="button"
                          onClick={() => handleTorrentPreviewSort('fileSize')}
                          className="ml-auto inline-flex items-center gap-1 text-right"
                        >
                          大小
                          {renderTorrentPreviewSortIcon('fileSize')}
                        </button>
                      </div>
                      {sortedTorrentPreviewFiles.map((file, rank) => (
                        <div
                          key={`${file.fileIndex}-${file.filePath}`}
                          className="grid grid-cols-[40px_52px_minmax(0,1fr)_74px_92px] items-center gap-3 border-b border-neutral-200/70 px-3 py-2.5 last:border-b-0 dark:border-neutral-700/70"
                        >
                          <div className="flex items-center justify-center">
                            <HeroCheckbox
                              isSelected={torrentPreviewSelectedSet.has(file.fileIndex)}
                              onChange={() => handleToggleTorrentPreviewFile(file.fileIndex)}
                              aria-label={`选择 ${file.filePath}`}
                            >
                              <HeroCheckbox.Control>
                                <HeroCheckbox.Indicator />
                              </HeroCheckbox.Control>
                            </HeroCheckbox>
                          </div>
                          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--theme-primary-a20)] text-[11px] font-semibold text-[var(--theme-primary-ink)]">
                            {rank + 1}
                          </span>
                          <span className="min-w-0 truncate text-sm text-neutral-700 dark:text-neutral-300">
                            {file.filePath}
                          </span>
                          <span className="inline-flex justify-center rounded-md bg-[var(--theme-primary-a12)] px-2 py-1 text-[11px] font-medium text-[var(--theme-primary-ink)]">
                            {file.fileType}
                          </span>
                          <span className="text-right text-xs text-neutral-500 dark:text-neutral-400">
                            {formatFileSize(file.fileSize)}
                          </span>
                        </div>
                      ))}
                    </div>
                    {selectedTorrentPreviewFileCount === 0 ? (
                      <div className="rounded-xl border border-amber-200/80 bg-amber-50/80 p-3 text-sm text-amber-800 dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-200">
                        请至少勾选一个种子文件后再创建任务
                      </div>
                    ) : null}
                    {selectedTorrentPreviewFileCount > 1 ? (
                      <div className="rounded-xl border border-[var(--theme-primary-a24)] bg-[linear-gradient(138deg,var(--theme-primary-a12),var(--theme-primary-a08))] p-3">
                        <HeroCheckbox
                          isSelected={uploadCreateFolderEnabled}
                          onChange={() => setUploadCreateFolderEnabled((prev) => !prev)}
                          className="items-start gap-2.5"
                        >
                          <HeroCheckbox.Control className="mt-0.5">
                            <HeroCheckbox.Indicator />
                          </HeroCheckbox.Control>
                          <HeroCheckbox.Content className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                            为本次多文件 Torrent 下载创建新文件夹存放
                          </HeroCheckbox.Content>
                        </HeroCheckbox>
                        <p className="mt-1 pl-[1.625rem] text-xs text-neutral-600 dark:text-neutral-300">
                          当前已勾选 {selectedTorrentPreviewFileCount} 个文件，默认已启用创建文件夹。
                        </p>
                        {uploadCreateFolderEnabled ? (
                          <div className="mt-3 pl-[1.625rem]">
                            <Input
                              label="新文件夹名称（可选）"
                              value={uploadCreateFolderName}
                              onChange={(e) => setUploadCreateFolderName(e.target.value)}
                              placeholder={buildTorrentSelectionFolderName(torrentPreview.torrentName)}
                              autoComplete="off"
                            />
                            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                              留空将自动使用默认名称。
                            </p>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
            )}
          </section>
        </div>
      </Modal>

      <Modal
        open={torrentSelectionModal.visible}
        onClose={closeTorrentSelectionModal}
        title="选择要发送的文件"
        description="多文件种子下载完成后，请勾选需要发送到 Telegram 的文件。"
        size="lg"
        footer={
          <>
            <ActionTextButton
              onPress={closeTorrentSelectionModal}
              isDisabled={torrentSelectionModal.loading}
              className="min-w-[96px] justify-center"
            >
              取消
            </ActionTextButton>
            <ActionTextButton
              tone="brand"
              onPress={handleConfirmTorrentDispatch}
              isDisabled={torrentSelectionModal.selectedFileIndexes.length === 0 || torrentSelectionModal.loading}
              className="min-w-[120px] justify-center border-transparent bg-[var(--theme-primary)] text-neutral-900"
            >
              {torrentSelectionModal.loading ? '发送中...' : '确认发送'}
            </ActionTextButton>
          </>
        }
      >
        {torrentSelectionModal.loading ? (
          <div className="py-8 text-sm text-neutral-500 dark:text-neutral-400">正在加载任务详情...</div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl border border-neutral-200/75 bg-neutral-50/70 px-3 py-2.5 dark:border-neutral-700/75 dark:bg-neutral-900/55">
              <p className="text-xs text-neutral-500 dark:text-neutral-400">任务名称</p>
              <p className="mt-1 text-sm font-medium text-neutral-800 dark:text-neutral-200">
                {torrentSelectionModal.task?.torrentName || '-'}
              </p>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                已勾选 {torrentSelectionModal.selectedFileIndexes.length} 项
              </p>
            </div>
            <div className="max-h-72 overflow-auto rounded-xl border border-neutral-200/70 bg-white dark:border-neutral-700/70 dark:bg-neutral-900">
              {(torrentSelectionModal.task?.files || []).map((file) => {
                const checked = torrentSelectionModal.selectedFileIndexes.includes(file.fileIndex);
                return (
                  <label
                    key={file.fileIndex}
                    className="flex items-center justify-between gap-3 border-b border-neutral-200/70 px-3 py-2.5 transition-colors hover:bg-neutral-50/80 last:border-b-0 dark:border-neutral-700/70 dark:hover:bg-neutral-800/70"
                  >
                    <div className="min-w-0 flex items-center gap-2.5">
                      <HeroCheckbox
                        isSelected={checked}
                        onChange={() => handleToggleTorrentSelectionFile(file.fileIndex)}
                      >
                        <HeroCheckbox.Content className="truncate text-sm text-neutral-800 dark:text-neutral-200">
                          {file.fileName}
                        </HeroCheckbox.Content>
                      </HeroCheckbox>
                    </div>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400 shrink-0">
                      {formatFileSize(file.fileSize)}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={permanentDeleteModal.visible}
        onClose={closePermanentDeleteModal}
        title="永久删除确认"
        description="该操作不可逆，且会尝试同步清理 Telegram 分片消息。"
        size="sm"
        closeOnOverlayClick={!permanentDeleteLoading}
        closeOnEscape={!permanentDeleteLoading}
        showCloseButton={!permanentDeleteLoading}
        footer={
          <>
            <ActionTextButton
              onPress={closePermanentDeleteModal}
              isDisabled={permanentDeleteLoading}
              className="min-w-[96px] justify-center"
            >
              取消
            </ActionTextButton>
            <ActionTextButton
              tone="danger"
              onPress={handleConfirmPermanentDelete}
              isDisabled={permanentDeleteLoading}
              className="min-w-[132px] justify-center"
            >
              {permanentDeleteLoading ? '删除中...' : '确认永久删除'}
            </ActionTextButton>
          </>
        }
      >
        <div className="rounded-xl border border-red-200 bg-red-50/80 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-300">
          确定要永久删除 <span className="font-semibold">{permanentDeleteModal.file?.name}</span> 吗？
          <p className="mt-1 text-xs text-red-600/90 dark:text-red-300/90">
            删除后无法恢复，请确认你已完成备份。
          </p>
        </div>
      </Modal>

      {/* 移动/复制 模态框 */}
      <Modal
        open={moveModal.visible}
        onClose={closeMoveModal}
        title={moveModal.action === 'move' ? '移动到' : '复制到'}
        description={moveModal.action === 'move' ? '将文件移动到新的目录位置。' : '复制一份文件到新的目录。'}
        size="sm"
        footer={
          <>
            <ActionTextButton onPress={closeMoveModal} className="min-w-[96px] justify-center">
              取消
            </ActionTextButton>
            <ActionTextButton
              tone="brand"
              onPress={handleConfirmMoveOrCopy}
              className="min-w-[108px] justify-center border-transparent bg-[var(--theme-primary)] text-neutral-900"
            >
              {moveModal.action === 'move' ? '移动' : '复制'}
            </ActionTextButton>
          </>
        }
      >
        <div className="space-y-3">
          <div className="rounded-xl border border-neutral-200/75 bg-neutral-50/70 px-3 py-2.5 dark:border-neutral-700/75 dark:bg-neutral-900/55">
            <p className="text-xs text-neutral-500 dark:text-neutral-400">目标文件</p>
            <p className="mt-1 truncate text-sm font-medium text-neutral-800 dark:text-neutral-200">{moveModal.file?.name}</p>
          </div>
          <label className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-500 dark:text-neutral-400">目标目录</label>
          <HeroSelect
            aria-label="移动复制目标目录"
            value={moveTargetFolderId}
            onChange={(value) => setMoveTargetFolderId(value as string)}
            variant="secondary"
            className="w-full"
          >
            <HeroSelect.Trigger className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100">
              <HeroSelect.Value />
              <HeroSelect.Indicator />
            </HeroSelect.Trigger>
            <HeroSelect.Popover className="min-w-[var(--trigger-width)]">
              <HeroListBox>
                <HeroListBox.Item id="root" textValue="/（根目录）">
                  <HeroLabel>/（根目录）</HeroLabel>
                  <HeroListBox.ItemIndicator />
                </HeroListBox.Item>
                {moveTargetFolders.map((folder) => (
                  <HeroListBox.Item key={folder.id} id={folder.id} textValue={folder.path}>
                    <HeroLabel>{folder.path}</HeroLabel>
                    <HeroListBox.ItemIndicator />
                  </HeroListBox.Item>
                ))}
              </HeroListBox>
            </HeroSelect.Popover>
          </HeroSelect>
        </div>
      </Modal>

      {/* 文件信息模态框 */}
      <Modal
        open={!!infoFile}
        onClose={() => setInfoFile(null)}
        title="文件信息"
        description="查看当前文件的基础属性与状态信息。"
        size="md"
      >
        {infoFile && (
          <div className="grid gap-2 text-sm">
            <div className="grid grid-cols-[88px_minmax(0,1fr)] items-start gap-3 rounded-xl border border-neutral-200/75 bg-neutral-50/70 px-3 py-2.5 dark:border-neutral-700/75 dark:bg-neutral-900/55">
              <span className="text-neutral-500 dark:text-neutral-400">名称</span>
              <span className="text-neutral-900 dark:text-neutral-100 text-right break-all">{infoFile.name}</span>
            </div>
            <div className="grid grid-cols-[88px_minmax(0,1fr)] items-start gap-3 rounded-xl border border-neutral-200/75 bg-neutral-50/70 px-3 py-2.5 dark:border-neutral-700/75 dark:bg-neutral-900/55">
              <span className="text-neutral-500 dark:text-neutral-400">类型</span>
              <span className="text-neutral-900 dark:text-neutral-100 text-right">{infoFile.type}</span>
            </div>
            <div className="grid grid-cols-[88px_minmax(0,1fr)] items-start gap-3 rounded-xl border border-neutral-200/75 bg-neutral-50/70 px-3 py-2.5 dark:border-neutral-700/75 dark:bg-neutral-900/55">
              <span className="text-neutral-500 dark:text-neutral-400">大小</span>
              <span className="text-neutral-900 dark:text-neutral-100 text-right">
                {infoFile.type === 'folder' ? '-' : formatFileSize(infoFile.size)}
              </span>
            </div>
            <div className="grid grid-cols-[88px_minmax(0,1fr)] items-start gap-3 rounded-xl border border-neutral-200/75 bg-neutral-50/70 px-3 py-2.5 dark:border-neutral-700/75 dark:bg-neutral-900/55">
              <span className="text-neutral-500 dark:text-neutral-400">路径</span>
              <span className="text-neutral-900 dark:text-neutral-100 text-right break-all">{infoFile.path}</span>
            </div>
            <div className="grid grid-cols-[88px_minmax(0,1fr)] items-start gap-3 rounded-xl border border-neutral-200/75 bg-neutral-50/70 px-3 py-2.5 dark:border-neutral-700/75 dark:bg-neutral-900/55">
              <span className="text-neutral-500 dark:text-neutral-400">创建时间</span>
              <span className="text-neutral-900 dark:text-neutral-100 text-right">{formatDateTime(infoFile.createdAt)}</span>
            </div>
            <div className="grid grid-cols-[88px_minmax(0,1fr)] items-start gap-3 rounded-xl border border-neutral-200/75 bg-neutral-50/70 px-3 py-2.5 dark:border-neutral-700/75 dark:bg-neutral-900/55">
              <span className="text-neutral-500 dark:text-neutral-400">更新时间</span>
              <span className="text-neutral-900 dark:text-neutral-100 text-right">{formatDateTime(infoFile.updatedAt)}</span>
            </div>
            <div className="grid grid-cols-[88px_minmax(0,1fr)] items-start gap-3 rounded-xl border border-neutral-200/75 bg-neutral-50/70 px-3 py-2.5 dark:border-neutral-700/75 dark:bg-neutral-900/55">
              <span className="text-neutral-500 dark:text-neutral-400">收藏</span>
              <span className="text-neutral-900 dark:text-neutral-100 text-right">{infoFile.isFavorite ? '是' : '否'}</span>
            </div>
            <div className="grid grid-cols-[88px_minmax(0,1fr)] items-start gap-3 rounded-xl border border-neutral-200/75 bg-neutral-50/70 px-3 py-2.5 dark:border-neutral-700/75 dark:bg-neutral-900/55">
              <span className="text-neutral-500 dark:text-neutral-400">分享</span>
              <span className="text-neutral-900 dark:text-neutral-100 text-right">{infoFile.isShared ? '是' : '否'}</span>
            </div>
            {infoFile.trashedAt && (
              <div className="grid grid-cols-[88px_minmax(0,1fr)] items-start gap-3 rounded-xl border border-neutral-200/75 bg-neutral-50/70 px-3 py-2.5 dark:border-neutral-700/75 dark:bg-neutral-900/55">
                <span className="text-neutral-500 dark:text-neutral-400">回收站时间</span>
                <span className="text-neutral-900 dark:text-neutral-100 text-right">{formatDateTime(infoFile.trashedAt)}</span>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ToastContainer />
    </>
  );
}
