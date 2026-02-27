import { useAtom, useSetAtom } from 'jotai';
import {
  Menu,
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
  Upload,
  Plus,
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Dropdown as HeroDropdown, Label as HeroLabel } from '@heroui/react';
import { mobileSidebarOpenAtom } from '@/stores/uiAtoms';
import { searchQueryAtom } from '@/stores/fileAtoms';
import { SearchBar } from '@/components/ui/SearchBar';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { ActionIconButton, ActionStatusPill, ActionTextButton } from '@/components/ui/HeroActionPrimitives';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/hooks/useToast';
import { useState, useEffect, useCallback, useMemo, type ComponentType } from 'react';
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
    className: 'border-sky-200 text-sky-700 bg-sky-50 dark:border-sky-800 dark:text-sky-300 dark:bg-sky-900/20',
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

export interface HeaderProps {
  onNewFolder?: () => void;
  onUpload?: () => void;
}

export function Header({ onNewFolder, onUpload }: HeaderProps) {
  const [searchQuery, setSearchQuery] = useAtom(searchQueryAtom);
  const setMobileSidebarOpen = useSetAtom(mobileSidebarOpenAtom);
  const setAuthenticated = useSetAtom(authenticatedAtom);
  const setAuthChecked = useSetAtom(authCheckedAtom);
  const { theme, changeTheme } = useTheme();
  const { pushToast } = useToast();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
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
  const [switchTargetMethod, setSwitchTargetMethod] =
    useState<Exclude<SetupAccessMethod, 'mtproto'>>('official_bot_api');
  const [switchBotToken, setSwitchBotToken] = useState('');
  const [switchStorageChatId, setSwitchStorageChatId] = useState('');
  const [switchApiId, setSwitchApiId] = useState('');
  const [switchApiHash, setSwitchApiHash] = useState('');
  const [showSwitchBotToken, setShowSwitchBotToken] = useState(false);
  const [showSwitchApiHash, setShowSwitchApiHash] = useState(false);
  const [switchDetails, setSwitchDetails] = useState<SetupConnectionTestDetails | null>(null);

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
    if (!userMenuOpen) return;
    void fetchStorageStats();
  }, [fetchStorageStats, userMenuOpen]);

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
      setUserMenuOpen(false);
    }
  }, [setAuthChecked, setAuthenticated]);

  const storageRows = useMemo(() => {
    return STORAGE_TYPE_META.map((meta) => ({
      ...meta,
      bytes: storageStats.byType[meta.key].bytes,
      count: storageStats.byType[meta.key].count,
    })).sort((a, b) => b.bytes - a.bytes);
  }, [storageStats]);

  const currentMethod = normalizeAccessMethod(serviceAccess.accessMethod);
  const currentMethodMeta = ACCESS_METHOD_META[currentMethod];
  const switchTargetMeta = ACCESS_METHOD_META[switchTargetMethod];
  const isSwitchTargetSelfHosted = switchTargetMethod === 'self_hosted_bot_api';
  const capsuleFrameClass = 'h-10 rounded-2xl px-1 py-1';
  const capsuleGroupGapClass = 'gap-2 sm:gap-2.5 xl:gap-3';
  const capsuleInnerGapClass = 'gap-1 sm:gap-1.5 xl:gap-2';
  const capsuleDividerClass = 'mx-0.5 sm:mx-1 h-5 w-px shrink-0 bg-neutral-200/90 dark:bg-neutral-700/90';

  return (
    <>
      <header className="glass-header relative z-30 rounded-3xl px-4 py-3 shadow-lg lg:px-6">
        <div className={cn('flex items-center gap-2.5 xl:gap-3')}>
          <div
            className={cn(
              'flex shrink-0 items-center border border-[var(--theme-primary-a24)] bg-[linear-gradient(132deg,var(--theme-primary-a24),var(--theme-primary-a08))] shadow-[0_10px_20px_-16px_rgba(30,41,59,0.42)]',
              capsuleFrameClass,
              capsuleInnerGapClass,
            )}
          >
            <ActionIconButton
              icon={<Upload className="h-3.5 w-3.5" />}
              label="上传文件"
              tone="brand"
              onPress={onUpload}
              className="sm:hidden"
            />
            <ActionIconButton
              icon={<Plus className="h-3.5 w-3.5" />}
              label="新建文件夹"
              tone="neutral"
              onPress={onNewFolder}
              className="sm:hidden"
            />
            <ActionTextButton
              tone="brand"
              leadingIcon={<Upload className="h-3.5 w-3.5" />}
              onPress={onUpload}
              className="hidden border-transparent bg-white/78 text-[var(--theme-primary-ink)] shadow-[0_8px_16px_-14px_rgba(30,41,59,0.45)] sm:inline-flex dark:bg-neutral-900/70 dark:text-[var(--theme-primary-soft-hover)]"
            >
              上传文件
            </ActionTextButton>
            <ActionTextButton
              tone="neutral"
              leadingIcon={<Plus className="h-3.5 w-3.5" />}
              onPress={onNewFolder}
              className="hidden border-transparent bg-transparent text-neutral-700 sm:inline-flex dark:text-neutral-200"
            >
              新建文件夹
            </ActionTextButton>
          </div>

          <ActionIconButton
            icon={<Menu className="h-5 w-5" />}
            label="打开侧边栏"
            onPress={() => setMobileSidebarOpen(true)}
            className="lg:hidden"
          />

          <div className="min-w-0 flex-1">
            <div className={cn('flex items-center', capsuleGroupGapClass)}>
              <div className="w-full max-w-xl lg:max-w-2xl">
                <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="搜索文件和文件夹..." />
              </div>
            </div>
          </div>

          <div className={cn('ml-auto flex shrink-0 items-center', capsuleGroupGapClass)}>
            <div
              className={cn(
                'flex items-center border border-neutral-200/80 bg-white/56 lg:hidden dark:border-neutral-700/80 dark:bg-neutral-900/62',
                capsuleFrameClass,
                capsuleInnerGapClass,
              )}
            >
              <ActionIconButton
                icon={<ArrowRightLeft className="h-3.5 w-3.5" />}
                label="切换 Telegram 服务接入方式"
                tone="brand"
                onPress={openSwitchModal}
                className="border-transparent bg-transparent"
              />
            </div>

            <div
              className={cn(
                'hidden items-center border border-neutral-200/80 bg-white/56 lg:flex dark:border-neutral-700/80 dark:bg-neutral-900/62',
                capsuleFrameClass,
                capsuleInnerGapClass,
              )}
            >
              <ActionStatusPill
                tone={serviceAccessError ? 'danger' : currentMethod === 'self_hosted_bot_api' ? 'success' : 'brand'}
                className={cn('h-8 border border-white/40 px-2.5 dark:border-neutral-700/80', capsuleInnerGapClass)}
              >
                {serviceAccessLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : serviceAccessError ? (
                  <AlertCircle className="h-3.5 w-3.5" />
                ) : (
                  <currentMethodMeta.Icon className="h-3.5 w-3.5" />
                )}
                <span title={serviceAccessError || '当前 Telegram 服务接入方式'}>{currentMethodMeta.shortLabel}</span>
              </ActionStatusPill>

              <span className={capsuleDividerClass} />

              <ActionTextButton
                tone="brand"
                leadingIcon={<ArrowRightLeft className="h-3.5 w-3.5" />}
                onPress={openSwitchModal}
                className="border-transparent bg-transparent"
              >
                切换服务
              </ActionTextButton>
            </div>

            <div
              className={cn(
                'flex items-center border border-neutral-200/80 bg-white/56 shadow-[0_10px_20px_-16px_rgba(30,41,59,0.42)] dark:border-neutral-700/80 dark:bg-neutral-900/62',
                capsuleFrameClass,
                capsuleInnerGapClass,
              )}
            >
              <HeroDropdown>
                <HeroDropdown.Trigger>
                  <ActionIconButton
                    icon={<ThemeIcon className="h-5 w-5" />}
                    label="切换主题"
                    tone="neutral"
                    className="border-transparent bg-transparent"
                  />
                </HeroDropdown.Trigger>
                <HeroDropdown.Popover className="w-40 rounded-2xl border border-white/50 bg-white/40 p-1 shadow-[0_16px_40px_-16px_rgba(15,23,42,0.2)] backdrop-blur-xl dark:border-white/10 dark:bg-black/40 dark:shadow-[0_16px_40px_-16px_rgba(0,0,0,0.5)]">
                  <HeroDropdown.Menu
                    aria-label="主题切换"
                    onAction={(key) => changeTheme(key as 'light' | 'dark' | 'system')}
                  >
                    <HeroDropdown.Item
                      id="light"
                      textValue="浅色"
                      className={cn(theme === 'light' && 'text-[var(--theme-primary)]')}
                    >
                      <Sun className="h-4 w-4 text-current" />
                      <HeroLabel>浅色</HeroLabel>
                    </HeroDropdown.Item>
                    <HeroDropdown.Item
                      id="dark"
                      textValue="深色"
                      className={cn(theme === 'dark' && 'text-[var(--theme-primary)]')}
                    >
                      <Moon className="h-4 w-4 text-current" />
                      <HeroLabel>深色</HeroLabel>
                    </HeroDropdown.Item>
                    <HeroDropdown.Item
                      id="system"
                      textValue="跟随系统"
                      className={cn(theme === 'system' && 'text-[var(--theme-primary)]')}
                    >
                      <Monitor className="h-4 w-4 text-current" />
                      <HeroLabel>跟随系统</HeroLabel>
                    </HeroDropdown.Item>
                  </HeroDropdown.Menu>
                </HeroDropdown.Popover>
              </HeroDropdown>

              <HeroDropdown isOpen={userMenuOpen} onOpenChange={setUserMenuOpen}>
                <HeroDropdown.Trigger>
                  <ActionIconButton
                    icon={<span className="text-sm leading-none font-semibold">U</span>}
                    label="打开用户菜单"
                    aria-haspopup="menu"
                    aria-expanded={userMenuOpen}
                    className={cn(
                      'h-9 min-h-9 w-9 min-w-9 rounded-full',
                      'bg-gradient-to-br from-[var(--theme-primary)] to-[var(--theme-primary-strong)]',
                      'text-neutral-900',
                      'shadow-[0_12px_26px_-18px_rgba(30,41,59,0.58)]',
                      'data-[hovered=true]:bg-gradient-to-br data-[hovered=true]:from-[var(--theme-primary-soft-hover)] data-[hovered=true]:to-[var(--theme-primary-soft-2)]',
                      'data-[pressed=true]:bg-gradient-to-br data-[pressed=true]:from-[var(--theme-primary-soft-press)] data-[pressed=true]:to-[var(--theme-primary-deep)]',
                      userMenuOpen && 'ring-2 ring-[var(--theme-primary-a55)]',
                    )}
                  />
                </HeroDropdown.Trigger>
                <HeroDropdown.Popover
                  placement="bottom end"
                  className="w-[min(360px,calc(100svw-24px))] max-w-[calc(100svw-24px)] overflow-hidden rounded-3xl border border-white/50 bg-white/40 p-0 shadow-[0_16px_40px_-16px_rgba(15,23,42,0.2)] backdrop-blur-xl dark:border-white/10 dark:bg-black/40 dark:shadow-[0_16px_40px_-16px_rgba(0,0,0,0.5)]"
                >
                  <div className="border-b border-neutral-200/80 bg-gradient-to-r from-[var(--theme-primary-a20)] via-[var(--theme-primary-a08)] to-transparent px-4 py-3 dark:border-neutral-700/80 dark:to-transparent">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="relative shrink-0">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[var(--theme-primary)] to-[var(--theme-primary-strong)] font-semibold text-neutral-900 shadow-sm ring-1 ring-white/35 dark:ring-neutral-950/35">
                          U
                        </div>
                        <span className="absolute -right-0.5 -bottom-0.5 h-3.5 w-3.5 rounded-full border-2 border-neutral-50 bg-emerald-500 shadow-sm dark:border-neutral-950 dark:bg-emerald-400" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <div className="truncate font-semibold text-neutral-900 dark:text-neutral-100">管理员</div>
                          <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                            当前会话
                          </span>
                        </div>
                        <div className="mt-0.5 truncate text-xs text-neutral-500 dark:text-neutral-400">
                          TG Cloud Drive · 已登录
                        </div>
                      </div>

                      <span className="w-full sm:ml-auto sm:w-auto sm:shrink-0">
                        <ActionStatusPill tone="success" className="inline-flex gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          会话有效
                        </ActionStatusPill>
                      </span>
                    </div>
                  </div>

                  <div className="px-4 py-3">
                    <div className="rounded-xl border border-neutral-200/80 bg-white/48 p-3 dark:border-neutral-700/80 dark:bg-neutral-800/52">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-medium text-neutral-600 dark:text-neutral-300">
                          <HardDrive className="h-4 w-4" />
                          存储概览
                        </div>
                        {storageStatsLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin text-neutral-400 dark:text-neutral-500" />
                        ) : null}
                      </div>
                      {storageStatsError ? (
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-red-500 dark:text-red-400">
                          <AlertCircle className="h-3.5 w-3.5" />
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

                    <div className="mt-3 max-h-56 space-y-1.5 overflow-y-auto pr-1">
                      {storageRows.map((row) => {
                        const Icon = row.icon;
                        return (
                          <div
                            key={row.key}
                            className="flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800/80"
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <span className={cn('h-2 w-2 shrink-0 rounded-full', row.color)} />
                              <Icon className="h-3.5 w-3.5 shrink-0 text-neutral-500 dark:text-neutral-400" />
                              <span className="truncate text-xs font-medium text-neutral-700 dark:text-neutral-200">
                                {row.label}
                              </span>
                            </div>
                            <div className="ml-3 text-right">
                              <div className="text-xs font-medium text-neutral-700 dark:text-neutral-200">
                                {formatFileSize(row.bytes)}
                              </div>
                              <div className="text-[11px] text-neutral-500 dark:text-neutral-400">{row.count} 个</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <HeroDropdown.Menu
                    aria-label="用户菜单"
                    className="border-t border-neutral-200 p-2 dark:border-neutral-700"
                    onAction={(key) => {
                      if (key === 'refresh-storage') {
                        void fetchStorageStats();
                        return;
                      }
                      if (key === 'logout') {
                        void handleLogout();
                      }
                    }}
                  >
                    <HeroDropdown.Item id="refresh-storage" textValue="刷新存储概览" isDisabled={storageStatsLoading}>
                      <HardDrive className="h-4 w-4 text-current" />
                      <HeroLabel>刷新存储概览</HeroLabel>
                    </HeroDropdown.Item>
                    <HeroDropdown.Item id="logout" textValue="退出登录" variant="danger">
                      <LogOut className="h-4 w-4 text-current" />
                      <HeroLabel>退出登录</HeroLabel>
                    </HeroDropdown.Item>
                  </HeroDropdown.Menu>
                </HeroDropdown.Popover>
              </HeroDropdown>
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
            <ActionTextButton
              onPress={() => setSwitchModalOpen(false)}
              isDisabled={switching}
              className="min-w-[96px] justify-center"
            >
              取消
            </ActionTextButton>
            <ActionTextButton
              tone="brand"
              onPress={handleSwitchService}
              isDisabled={switching}
              leadingIcon={switching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : undefined}
              className="min-w-[120px] justify-center border-transparent bg-[var(--theme-primary)] text-neutral-900 shadow-[0_12px_24px_-18px_rgba(30,41,59,0.55)] dark:border-transparent dark:bg-[var(--theme-primary)] dark:text-neutral-900"
            >
              确认切换
            </ActionTextButton>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--theme-primary-a24)] bg-[linear-gradient(138deg,var(--theme-primary-a20),var(--theme-primary-a08))] p-3.5 shadow-[0_14px_28px_-22px_rgba(30,41,59,0.46)]">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-medium tracking-[0.12em] text-neutral-500 uppercase dark:text-neutral-400">
                切换预览
              </span>
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium',
                  currentMethodMeta.className,
                )}
              >
                <currentMethodMeta.Icon className="h-3.5 w-3.5" />
                {currentMethodMeta.label}
              </span>
              <ArrowRightLeft className="h-3.5 w-3.5 text-neutral-500 dark:text-neutral-400" />
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium',
                  switchTargetMeta.className,
                )}
              >
                <switchTargetMeta.Icon className="h-3.5 w-3.5" />
                {switchTargetMeta.label}
              </span>
            </div>
            <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-300">
              提交后将立即执行连接校验，若失败会自动回滚到当前服务配置。
            </p>
          </div>

          <section className="space-y-2">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-neutral-500 uppercase dark:text-neutral-400">
              步骤 1 · 选择目标服务
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {(Object.keys(ACCESS_METHOD_META) as Array<Exclude<SetupAccessMethod, 'mtproto'>>).map((key) => {
                const meta = ACCESS_METHOD_META[key];
                const active = switchTargetMethod === key;
                const isCurrent = currentMethod === key;
                return (
                  <ActionTextButton
                    key={key}
                    onPress={() => setSwitchTargetMethod(key)}
                    className={cn(
                      'h-auto min-h-0 w-full items-start justify-start rounded-xl border px-3 py-3 text-left',
                      'flex-col gap-2 whitespace-normal',
                      active
                        ? 'border-[var(--theme-primary-a70)] bg-[var(--theme-primary-a12)]'
                        : 'border-neutral-200 bg-white/58 hover:bg-white/80 dark:border-neutral-700 dark:bg-neutral-900/68 dark:hover:bg-neutral-800/88',
                    )}
                  >
                    <div className="flex w-full items-center gap-2">
                      <meta.Icon className="h-4 w-4 text-[var(--theme-primary)]" />
                      <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{meta.label}</span>
                      {isCurrent ? (
                        <span className="ml-auto rounded-full border border-neutral-200 bg-white/85 px-2 py-0.5 text-[10px] font-medium text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900/80 dark:text-neutral-400">
                          当前
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {key === 'official_bot_api' ? '使用 Telegram 官方基础服务' : '使用你自建的 Bot API 服务'}
                    </p>
                  </ActionTextButton>
                );
              })}
            </div>
          </section>

          <section className="space-y-2">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-neutral-500 uppercase dark:text-neutral-400">
              步骤 2 · 填写连接参数
            </p>
            <div className="space-y-3 rounded-2xl border border-neutral-200/75 bg-neutral-50/70 p-3 dark:border-neutral-700/80 dark:bg-neutral-900/55">
              <Input
                label="Telegram Bot Token"
                type={showSwitchBotToken ? 'text' : 'password'}
                value={switchBotToken}
                onChange={(e) => setSwitchBotToken(e.target.value)}
                placeholder="123456789:AA..."
                rightIcon={
                  <ActionIconButton
                    icon={showSwitchBotToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    label={showSwitchBotToken ? '隐藏 Bot Token' : '查看 Bot Token'}
                    aria-label={showSwitchBotToken ? '隐藏 Bot Token' : '查看 Bot Token'}
                    onPress={() => setShowSwitchBotToken((prev) => !prev)}
                    className="h-6 min-h-6 w-6 min-w-6"
                  />
                }
              />
              <Input
                label="Chat ID"
                value={switchStorageChatId}
                onChange={(e) => setSwitchStorageChatId(e.target.value)}
                placeholder="-100xxxxxxxxxx 或 @channelusername"
              />
            </div>
          </section>

          {isSwitchTargetSelfHosted && (
            <section className="space-y-2">
              <p className="text-[11px] font-semibold tracking-[0.14em] text-neutral-500 uppercase dark:text-neutral-400">
                步骤 3 · 自建服务参数
              </p>
              <div className="space-y-3 rounded-2xl border border-neutral-200/75 bg-neutral-50/70 p-3 dark:border-neutral-700/80 dark:bg-neutral-900/55">
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
                      <ActionIconButton
                        icon={showSwitchApiHash ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        label={showSwitchApiHash ? '隐藏 API Hash' : '查看 API Hash'}
                        aria-label={showSwitchApiHash ? '隐藏 API Hash' : '查看 API Hash'}
                        onPress={() => setShowSwitchApiHash((prev) => !prev)}
                        className="h-6 min-h-6 w-6 min-w-6"
                      />
                    }
                  />
                </div>
              </div>
            </section>
          )}

          {switchDetails && (
            <section className="rounded-2xl border border-neutral-200 bg-neutral-50/70 p-3.5 dark:border-neutral-700 dark:bg-neutral-800/50">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {switchDetails.overallOk ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  )}
                  <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-100">连接校验结果</p>
                </div>
                <span className="text-[11px] text-neutral-500 dark:text-neutral-400">{switchDetails.testedAt}</span>
              </div>

              <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-300">{switchDetails.summary}</p>
              {switchDetails.apiBaseUrl && (
                <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                  Bot API 地址：{switchDetails.apiBaseUrl}
                </p>
              )}

              <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
                <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-neutral-600 dark:text-neutral-300">Bot Token</span>
                    <span
                      className={cn(
                        switchDetails.bot.ok
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-orange-600 dark:text-orange-400',
                      )}
                    >
                      {switchDetails.bot.ok ? '通过' : '失败'}
                    </span>
                  </div>
                  <p className="mt-1 text-neutral-500 dark:text-neutral-400">
                    {switchDetails.bot.ok
                      ? `@${switchDetails.bot.username || '-'} · ID ${switchDetails.bot.id || '-'}`
                      : switchDetails.bot.error || 'Bot 校验失败'}
                  </p>
                </div>

                <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-neutral-600 dark:text-neutral-300">Chat ID</span>
                    <span
                      className={cn(
                        switchDetails.chat.ok
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-orange-600 dark:text-orange-400',
                      )}
                    >
                      {switchDetails.chat.ok ? '通过' : '失败'}
                    </span>
                  </div>
                  <p className="mt-1 text-neutral-500 dark:text-neutral-400">
                    {switchDetails.chat.ok
                      ? `${switchDetails.chat.title || '未命名会话'} · ${switchDetails.chat.type || '-'} · ID ${switchDetails.chat.id || '-'}`
                      : switchDetails.chat.error || 'Chat 校验失败'}
                  </p>
                </div>

                <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-neutral-600 dark:text-neutral-300">管理员权限</span>
                    <span
                      className={cn(
                        switchDetails.admin.ok
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-orange-600 dark:text-orange-400',
                      )}
                    >
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
            </section>
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
