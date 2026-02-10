import { useAtom, useSetAtom } from 'jotai';
import {
  Menu,
  Grid3X3,
  List,
  Sun,
  Moon,
  Monitor,
  LogOut,
  HardDrive,
  Image as ImageIcon,
  Film,
  Music2,
  FileText,
  Archive,
  Code2,
  Files,
  Loader2,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  ArrowRightLeft,
  ServerCog,
  ShieldCheck,
  Eye,
  EyeOff,
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { viewModeAtom, mobileSidebarOpenAtom } from '@/stores/uiAtoms';
import { searchQueryAtom } from '@/stores/fileAtoms';
import { SearchBar } from '@/components/ui/SearchBar';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/hooks/useToast';
import { useState, useRef, useEffect, useCallback, useMemo, type ComponentType } from 'react';
import { authCheckedAtom, authenticatedAtom } from '@/stores/authAtoms';
import { apiFetchJson, ApiError } from '@/utils/api';
import { formatFileSize } from '@/utils/formatters';
import type { StorageStats, StorageTypeKey } from '@/types';

function cn(...inputs: (string | undefined | null | boolean)[]) {
  return twMerge(clsx(inputs));
}

type StorageTypeStatsDTO = {
  bytes: number;
  count: number;
};

type StorageStatsDTO = {
  totalBytes: number;
  totalFiles: number;
  byType: Partial<Record<StorageTypeKey, StorageTypeStatsDTO>>;
};

type SetupAccessMethod = 'official_bot_api' | 'self_hosted_bot_api' | 'mtproto';

type ServiceAccessDTO = {
  accessMethod: SetupAccessMethod;
  tgBotToken?: string | null;
  tgStorageChatId?: string | null;
  tgApiId?: number | null;
  tgApiHash?: string | null;
  tgApiBaseUrl?: string | null;
};

type SetupConnectionTestDetails = {
  accessMethod: string;
  apiBaseUrl?: string;
  overallOk: boolean;
  summary: string;
  testedAt: string;
  bot: {
    ok: boolean;
    id?: number;
    username?: string;
    isBot: boolean;
    error?: string;
  };
  chat: {
    ok: boolean;
    id?: number;
    type?: string;
    title?: string;
    username?: string;
    error?: string;
  };
  admin: {
    ok: boolean;
    adminCount: number;
    error?: string;
  };
};

const STORAGE_TYPE_META: Array<{
  key: StorageTypeKey;
  label: string;
  color: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { key: 'image', label: '图片', color: 'bg-pink-500', icon: ImageIcon },
  { key: 'video', label: '视频', color: 'bg-purple-500', icon: Film },
  { key: 'audio', label: '音频', color: 'bg-green-500', icon: Music2 },
  { key: 'document', label: '文档', color: 'bg-blue-500', icon: FileText },
  { key: 'archive', label: '压缩包', color: 'bg-orange-500', icon: Archive },
  { key: 'code', label: '代码', color: 'bg-cyan-500', icon: Code2 },
  { key: 'other', label: '其他', color: 'bg-neutral-500', icon: Files },
];

const ACCESS_METHOD_META: Record<
  Exclude<SetupAccessMethod, 'mtproto'>,
  {
    label: string;
    shortLabel: string;
    Icon: ComponentType<{ className?: string }>;
    className: string;
  }
> = {
  official_bot_api: {
    label: '官方 Bot API',
    shortLabel: '官方',
    Icon: ShieldCheck,
    className:
      'border-sky-200 text-sky-700 bg-sky-50 dark:border-sky-800 dark:text-sky-300 dark:bg-sky-900/20',
  },
  self_hosted_bot_api: {
    label: '自建 Bot API',
    shortLabel: '自建',
    Icon: ServerCog,
    className:
      'border-emerald-200 text-emerald-700 bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:bg-emerald-900/20',
  },
};

function createEmptyStorageStats(): StorageStats {
  return {
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
  };
}

function normalizeStorageStats(dto?: StorageStatsDTO): StorageStats {
  const empty = createEmptyStorageStats();
  if (!dto) return empty;

  const normalizedByType = { ...empty.byType };
  for (const key of Object.keys(normalizedByType) as StorageTypeKey[]) {
    const source = dto.byType?.[key];
    normalizedByType[key] = {
      bytes: Number.isFinite(source?.bytes) ? Math.max(0, source?.bytes ?? 0) : 0,
      count: Number.isFinite(source?.count) ? Math.max(0, source?.count ?? 0) : 0,
    };
  }

  return {
    totalBytes: Number.isFinite(dto.totalBytes) ? Math.max(0, dto.totalBytes) : 0,
    totalFiles: Number.isFinite(dto.totalFiles) ? Math.max(0, dto.totalFiles) : 0,
    byType: normalizedByType,
  };
}

function normalizeAccessMethod(method: string | undefined): Exclude<SetupAccessMethod, 'mtproto'> {
  if (method === 'self_hosted_bot_api') return 'self_hosted_bot_api';
  return 'official_bot_api';
}

function normalizeServiceAccess(dto: ServiceAccessDTO): ServiceAccessDTO {
  return {
    accessMethod: normalizeAccessMethod(dto.accessMethod),
    tgBotToken: dto.tgBotToken ?? '',
    tgStorageChatId: dto.tgStorageChatId ?? '',
    tgApiId: dto.tgApiId ?? null,
    tgApiHash: dto.tgApiHash ?? '',
    tgApiBaseUrl: dto.tgApiBaseUrl ?? '',
  };
}

function isSetupConnectionTestDetails(value: unknown): value is SetupConnectionTestDetails {
  if (!value || typeof value !== 'object') return false;
  const maybe = value as Partial<SetupConnectionTestDetails>;
  return (
    typeof maybe.summary === 'string' &&
    typeof maybe.testedAt === 'string' &&
    typeof maybe.bot === 'object' &&
    maybe.bot !== null &&
    typeof maybe.chat === 'object' &&
    maybe.chat !== null &&
    typeof maybe.admin === 'object' &&
    maybe.admin !== null
  );
}

export function Header() {
  const [viewMode, setViewMode] = useAtom(viewModeAtom);
  const [searchQuery, setSearchQuery] = useAtom(searchQueryAtom);
  const setMobileSidebarOpen = useSetAtom(mobileSidebarOpenAtom);
  const setAuthenticated = useSetAtom(authenticatedAtom);
  const setAuthChecked = useSetAtom(authCheckedAtom);
  const { theme, changeTheme } = useTheme();
  const { pushToast } = useToast();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [storageStats, setStorageStats] = useState<StorageStats>(createEmptyStorageStats());
  const [storageStatsLoading, setStorageStatsLoading] = useState(false);
  const [storageStatsError, setStorageStatsError] = useState('');
  const [serviceAccess, setServiceAccess] = useState<ServiceAccessDTO>({
    accessMethod: 'official_bot_api',
    tgBotToken: '',
    tgStorageChatId: '',
    tgApiId: null,
    tgApiHash: '',
    tgApiBaseUrl: '',
  });
  const [serviceAccessLoading, setServiceAccessLoading] = useState(false);
  const [serviceAccessError, setServiceAccessError] = useState('');
  const [switchModalOpen, setSwitchModalOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [switchTargetMethod, setSwitchTargetMethod] = useState<Exclude<SetupAccessMethod, 'mtproto'>>('official_bot_api');
  const [switchBotToken, setSwitchBotToken] = useState('');
  const [switchStorageChatId, setSwitchStorageChatId] = useState('');
  const [switchApiId, setSwitchApiId] = useState('');
  const [switchApiHash, setSwitchApiHash] = useState('');
  const [showSwitchBotToken, setShowSwitchBotToken] = useState(false);
  const [showSwitchApiHash, setShowSwitchApiHash] = useState(false);
  const [switchDetails, setSwitchDetails] = useState<SetupConnectionTestDetails | null>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const themeMenuRef = useRef<HTMLDivElement>(null);
  const userMenuCloseTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target as Node)) {
        setShowThemeMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (userMenuCloseTimerRef.current !== null) {
        window.clearTimeout(userMenuCloseTimerRef.current);
      }
    };
  }, []);

  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;

  const fetchStorageStats = useCallback(async () => {
    setStorageStatsLoading(true);
    setStorageStatsError('');
    try {
      const res = await apiFetchJson<{ stats: StorageStatsDTO }>('/api/storage/stats');
      setStorageStats(normalizeStorageStats(res.stats));
    } catch (err: unknown) {
      const e = err as ApiError;
      setStorageStatsError(e?.message || '读取存储统计失败');
    } finally {
      setStorageStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!showUserMenu) return;
    void fetchStorageStats();
  }, [fetchStorageStats, showUserMenu]);

  const fetchServiceAccess = useCallback(async () => {
    setServiceAccessLoading(true);
    setServiceAccessError('');
    try {
      const res = await apiFetchJson<{ serviceAccess: ServiceAccessDTO }>('/api/settings/access');
      if (res?.serviceAccess) {
        setServiceAccess(normalizeServiceAccess(res.serviceAccess));
      }
    } catch (err: unknown) {
      const e = err as ApiError;
      setServiceAccessError(e?.message || '读取服务接入配置失败');
    } finally {
      setServiceAccessLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchServiceAccess();
  }, [fetchServiceAccess]);

  const openSwitchModal = useCallback(() => {
    setSwitchTargetMethod(normalizeAccessMethod(serviceAccess.accessMethod));
    setSwitchBotToken(serviceAccess.tgBotToken || '');
    setSwitchStorageChatId(serviceAccess.tgStorageChatId || '');
    setSwitchApiId(serviceAccess.tgApiId != null ? String(serviceAccess.tgApiId) : '');
    setSwitchApiHash(serviceAccess.tgApiHash || '');
    setShowSwitchBotToken(false);
    setShowSwitchApiHash(false);
    setSwitchDetails(null);
    setSwitchModalOpen(true);
  }, [serviceAccess]);

  const handleSwitchService = useCallback(async () => {
    const botToken = switchBotToken.trim();
    const storageChatId = switchStorageChatId.trim();
    if (!botToken || !storageChatId) {
      pushToast({ type: 'error', message: '请填写 Bot Token 与 Chat ID' });
      return;
    }

    let normalizedApiID: number | undefined;
    if (switchTargetMethod === 'self_hosted_bot_api') {
      const apiIDText = switchApiId.trim();
      const apiHash = switchApiHash.trim();
      if (!apiIDText || !apiHash) {
        pushToast({ type: 'error', message: '自建 Bot API 模式需要填写 API ID 和 API Hash' });
        return;
      }
      const parsedApiID = Number.parseInt(apiIDText, 10);
      if (!Number.isFinite(parsedApiID) || parsedApiID <= 0) {
        pushToast({ type: 'error', message: 'API ID 必须是正整数' });
        return;
      }
      normalizedApiID = parsedApiID;
    }

    setSwitching(true);
    try {
      const res = await apiFetchJson<{
        ok: boolean;
        rolledBack: boolean;
        message?: string;
        serviceAccess: ServiceAccessDTO;
        details?: SetupConnectionTestDetails;
      }>('/api/settings/access', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessMethod: switchTargetMethod,
          tgBotToken: botToken,
          tgStorageChatId: storageChatId,
          tgApiId: switchTargetMethod === 'self_hosted_bot_api' ? normalizedApiID : undefined,
          tgApiHash: switchTargetMethod === 'self_hosted_bot_api' ? switchApiHash.trim() : undefined,
        }),
      });
      setServiceAccess(normalizeServiceAccess(res.serviceAccess));
      setSwitchDetails(res.details || null);
      setSwitchModalOpen(false);
      pushToast({ type: 'success', message: res.message || '服务接入方式已切换' });
    } catch (err: unknown) {
      const e = err as ApiError;
      const failedDetails = e?.payload?.details;
      if (isSetupConnectionTestDetails(failedDetails)) {
        setSwitchDetails(failedDetails);
      }
      pushToast({ type: 'error', message: e?.message || '切换服务接入方式失败' });
      await fetchServiceAccess();
    } finally {
      setSwitching(false);
    }
  }, [
    fetchServiceAccess,
    pushToast,
    switchBotToken,
    switchApiHash,
    switchApiId,
    switchStorageChatId,
    switchTargetMethod,
  ]);

  const handleLogout = useCallback(async () => {
    try {
      await apiFetchJson<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
    } catch {
      // 忽略：即便后端不可用，也应尽快让 UI 回到未登录态
    } finally {
      setAuthenticated(false);
      setAuthChecked(true);
      setShowUserMenu(false);
    }
  }, [setAuthChecked, setAuthenticated]);

  const storageRows = useMemo(() => {
    return STORAGE_TYPE_META
      .map((meta) => ({
        ...meta,
        bytes: storageStats.byType[meta.key].bytes,
        count: storageStats.byType[meta.key].count,
      }))
      .sort((a, b) => b.bytes - a.bytes);
  }, [storageStats]);

  const currentMethod = normalizeAccessMethod(serviceAccess.accessMethod);
  const currentMethodMeta = ACCESS_METHOD_META[currentMethod];
  const isSwitchTargetSelfHosted = switchTargetMethod === 'self_hosted_bot_api';

  const openUserMenu = useCallback(() => {
    if (userMenuCloseTimerRef.current !== null) {
      window.clearTimeout(userMenuCloseTimerRef.current);
      userMenuCloseTimerRef.current = null;
    }
    setShowUserMenu(true);
  }, []);

  const closeUserMenuWithDelay = useCallback(() => {
    if (userMenuCloseTimerRef.current !== null) {
      window.clearTimeout(userMenuCloseTimerRef.current);
    }
    userMenuCloseTimerRef.current = window.setTimeout(() => {
      setShowUserMenu(false);
      userMenuCloseTimerRef.current = null;
    }, 140);
  }, []);

  const toggleUserMenu = useCallback(() => {
    if (userMenuCloseTimerRef.current !== null) {
      window.clearTimeout(userMenuCloseTimerRef.current);
      userMenuCloseTimerRef.current = null;
    }
    setShowUserMenu((prev) => !prev);
  }, []);

  return (
    <>
      <header className="glass-header sticky top-0 z-30 px-4 lg:px-6 py-3">
        <div className="flex items-center gap-4">
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="lg:hidden p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          <Menu className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="max-w-md">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="搜索文件和文件夹..."
            />
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium',
                currentMethodMeta.className
              )}
              title={serviceAccessError || '当前 Telegram 服务接入方式'}
            >
              {serviceAccessLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : serviceAccessError ? (
                <AlertCircle className="h-3.5 w-3.5" />
              ) : (
                <currentMethodMeta.Icon className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">{currentMethodMeta.shortLabel}</span>
            </div>

            <button
              type="button"
              onClick={openSwitchModal}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs',
                'border-neutral-200 text-neutral-700 hover:bg-neutral-100',
                'dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800',
                'transition-colors'
              )}
              title="切换 Telegram 服务接入方式"
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">切换服务</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center bg-neutral-100 dark:bg-neutral-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'p-1.5 rounded-md transition-colors',
                viewMode === 'grid'
                  ? 'bg-white dark:bg-neutral-700 shadow-sm text-neutral-900 dark:text-neutral-100'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300'
              )}
              title="网格视图"
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'p-1.5 rounded-md transition-colors',
                viewMode === 'list'
                  ? 'bg-white dark:bg-neutral-700 shadow-sm text-neutral-900 dark:text-neutral-100'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300'
              )}
              title="列表视图"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <div className="relative" ref={themeMenuRef}>
            <button
              onClick={() => setShowThemeMenu(!showThemeMenu)}
              className={cn(
                'p-2 rounded-lg transition-colors',
                'hover:bg-neutral-100 dark:hover:bg-neutral-800',
                'text-neutral-600 dark:text-neutral-400'
              )}
              title="切换主题"
            >
              <ThemeIcon className="w-5 h-5" />
            </button>

            {showThemeMenu && (
              <div className="absolute right-0 mt-2 w-36 py-1 bg-white dark:bg-neutral-800 rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-700 animate-scaleIn origin-top-right">
                <button
                  onClick={() => { changeTheme('light'); setShowThemeMenu(false); }}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300',
                    'hover:bg-neutral-100 dark:hover:bg-neutral-700',
                    theme === 'light' && 'text-[#D4AF37]'
                  )}
                >
                  <Sun className="w-4 h-4" />
                  浅色
                </button>
                <button
                  onClick={() => { changeTheme('dark'); setShowThemeMenu(false); }}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300',
                    'hover:bg-neutral-100 dark:hover:bg-neutral-700',
                    theme === 'dark' && 'text-[#D4AF37]'
                  )}
                >
                  <Moon className="w-4 h-4" />
                  深色
                </button>
                <button
                  onClick={() => { changeTheme('system'); setShowThemeMenu(false); }}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300',
                    'hover:bg-neutral-100 dark:hover:bg-neutral-700',
                    theme === 'system' && 'text-[#D4AF37]'
                  )}
                >
                  <Monitor className="w-4 h-4" />
                  跟随系统
                </button>
              </div>
            )}
          </div>

          <div
            className="relative"
            ref={userMenuRef}
            onMouseEnter={openUserMenu}
            onMouseLeave={closeUserMenuWithDelay}
          >
            <button
              onClick={toggleUserMenu}
              aria-haspopup="menu"
              aria-expanded={showUserMenu}
              className={cn(
                'w-9 h-9 rounded-full',
                'bg-gradient-to-br from-[#D4AF37] to-[#B8962E]',
                'flex items-center justify-center',
                'text-neutral-900 font-medium text-sm',
                'hover:shadow-lg transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]/60'
              )}
            >
              U
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-[360px] overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-2xl animate-scaleIn origin-top-right">
                <div className="px-4 py-3 bg-gradient-to-r from-[#D4AF37]/20 via-[#D4AF37]/10 to-transparent dark:from-[#D4AF37]/25 dark:via-[#D4AF37]/12 dark:to-transparent border-b border-neutral-200/80 dark:border-neutral-700/80">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#B8962E] flex items-center justify-center text-neutral-900 font-semibold">
                      U
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                        当前会话
                      </div>
                      <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                        已登录管理员
                      </div>
                    </div>
                    <span className="ml-auto shrink-0 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 px-2 py-0.5 text-[11px] font-medium">
                      在线
                    </span>
                  </div>
                </div>

                <div className="px-4 py-3">
                  <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-700/80 bg-neutral-50/80 dark:bg-neutral-800/50 p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-medium text-neutral-600 dark:text-neutral-300">
                        <HardDrive className="w-4 h-4" />
                        存储概览
                      </div>
                      {storageStatsLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin text-neutral-400 dark:text-neutral-500" />
                      ) : null}
                    </div>
                    {storageStatsError ? (
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-red-500 dark:text-red-400">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {storageStatsError}
                      </div>
                    ) : (
                      <>
                        <div className="mt-2 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                          {formatFileSize(storageStats.totalBytes)}
                        </div>
                        <div className="text-xs text-neutral-500 dark:text-neutral-400">
                          共 {storageStats.totalFiles} 个文件（不含目录）
                        </div>
                      </>
                    )}
                  </div>

                  <div className="mt-3 space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {storageRows.map((row) => {
                      const Icon = row.icon;
                      return (
                        <div
                          key={row.key}
                          className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800/80 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={cn('w-2 h-2 rounded-full shrink-0', row.color)} />
                            <Icon className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400 shrink-0" />
                            <span className="text-xs font-medium text-neutral-700 dark:text-neutral-200 truncate">
                              {row.label}
                            </span>
                          </div>
                          <div className="text-right ml-3">
                            <div className="text-xs font-medium text-neutral-700 dark:text-neutral-200">
                              {formatFileSize(row.bytes)}
                            </div>
                            <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                              {row.count} 个
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-neutral-200 dark:border-neutral-700 px-3 py-2">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    退出登录
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        </div>
      </header>

      <Modal
        open={switchModalOpen}
        onClose={() => {
          if (switching) return;
          setSwitchModalOpen(false);
        }}
        title="切换 Telegram 服务类型"
        description="将对目标配置执行连接校验，失败时自动回滚到当前服务类型。"
        size="lg"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setSwitchModalOpen(false)}
              disabled={switching}
            >
              取消
            </Button>
            <Button
              variant="gold"
              onClick={handleSwitchService}
              loading={switching}
              disabled={switching}
            >
              确认切换
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {(Object.keys(ACCESS_METHOD_META) as Array<Exclude<SetupAccessMethod, 'mtproto'>>).map((key) => {
              const meta = ACCESS_METHOD_META[key];
              const active = switchTargetMethod === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSwitchTargetMethod(key)}
                  className={cn(
                    'rounded-xl border p-3 text-left transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]/70',
                    active
                      ? 'border-[#D4AF37] bg-[#D4AF37]/10 dark:bg-[#D4AF37]/15'
                      : 'border-neutral-200 bg-white hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800'
                  )}
                >
                  <div className="flex items-center gap-2 text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    <meta.Icon className="h-4 w-4 text-[#D4AF37]" />
                    {meta.label}
                  </div>
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                    {key === 'official_bot_api' ? '使用 Telegram 官方基础服务' : '使用你自建的 Bot API 服务'}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="space-y-3 rounded-xl border border-neutral-200 dark:border-neutral-700 p-3">
            <Input
              label="Telegram Bot Token"
              type={showSwitchBotToken ? 'text' : 'password'}
              value={switchBotToken}
              onChange={(e) => setSwitchBotToken(e.target.value)}
              placeholder="123456789:AA..."
              rightIcon={
                <button
                  type="button"
                  className="cursor-pointer text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
                  onClick={() => setShowSwitchBotToken((prev) => !prev)}
                  aria-label={showSwitchBotToken ? '隐藏 Bot Token' : '查看 Bot Token'}
                >
                  {showSwitchBotToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />
            <Input
              label="Chat ID"
              value={switchStorageChatId}
              onChange={(e) => setSwitchStorageChatId(e.target.value)}
              placeholder="-100xxxxxxxxxx 或 @channelusername"
            />
          </div>

          {isSwitchTargetSelfHosted && (
            <div className="space-y-3 rounded-xl border border-neutral-200 dark:border-neutral-700 p-3">
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                自建 Bot API 地址将默认使用容器服务：`http://telegram-bot-api:8081`
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="API ID"
                  value={switchApiId}
                  onChange={(e) => setSwitchApiId(e.target.value)}
                  placeholder="例如：12345678"
                />
                <Input
                  label="API Hash"
                  type={showSwitchApiHash ? 'text' : 'password'}
                  value={switchApiHash}
                  onChange={(e) => setSwitchApiHash(e.target.value)}
                  placeholder="32 位哈希值"
                  rightIcon={
                    <button
                      type="button"
                      className="cursor-pointer text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
                      onClick={() => setShowSwitchApiHash((prev) => !prev)}
                      aria-label={showSwitchApiHash ? '隐藏 API Hash' : '查看 API Hash'}
                    >
                      {showSwitchApiHash ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  }
                />
              </div>
            </div>
          )}

          {switchDetails && (
            <div className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-3 dark:border-neutral-700 dark:bg-neutral-800/50">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {switchDetails.overallOk ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  )}
                  <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-100">连接测试详情</p>
                </div>
                <span className="text-[11px] text-neutral-500 dark:text-neutral-400">{switchDetails.testedAt}</span>
              </div>

              <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-300">{switchDetails.summary}</p>
              {switchDetails.apiBaseUrl && (
                <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                  Bot API 地址：{switchDetails.apiBaseUrl}
                </p>
              )}

              <div className="mt-3 grid gap-2 text-xs">
                <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-neutral-600 dark:text-neutral-300">Bot Token 校验</span>
                    <span className={cn(switchDetails.bot.ok ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400')}>
                      {switchDetails.bot.ok ? '通过' : '失败'}
                    </span>
                  </div>
                  <p className="mt-1 text-neutral-500 dark:text-neutral-400">
                    {switchDetails.bot.ok
                      ? `@${switchDetails.bot.username || '-'} · ID ${switchDetails.bot.id || '-'}`
                      : switchDetails.bot.error || 'Bot 校验失败'}
                  </p>
                </div>

                <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-neutral-600 dark:text-neutral-300">Chat ID 校验</span>
                    <span className={cn(switchDetails.chat.ok ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400')}>
                      {switchDetails.chat.ok ? '通过' : '失败'}
                    </span>
                  </div>
                  <p className="mt-1 text-neutral-500 dark:text-neutral-400">
                    {switchDetails.chat.ok
                      ? `${switchDetails.chat.title || '未命名会话'} · ${switchDetails.chat.type || '-'} · ID ${switchDetails.chat.id || '-'}`
                      : switchDetails.chat.error || 'Chat 校验失败'}
                  </p>
                </div>

                <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-neutral-600 dark:text-neutral-300">管理员权限校验</span>
                    <span className={cn(switchDetails.admin.ok ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400')}>
                      {switchDetails.admin.ok ? '通过' : '失败'}
                    </span>
                  </div>
                  <p className="mt-1 text-neutral-500 dark:text-neutral-400">
                    {switchDetails.admin.ok
                      ? `管理员数量 ${switchDetails.admin.adminCount}`
                      : switchDetails.admin.error || '管理员权限校验失败'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {serviceAccessError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
              {serviceAccessError}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
