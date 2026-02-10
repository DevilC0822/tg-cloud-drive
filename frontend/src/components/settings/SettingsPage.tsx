import { useAtom } from 'jotai';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentType, type KeyboardEvent, type ReactNode } from 'react';
import { Clock3, Download, HardDrive, KeyRound, Save, SlidersHorizontal, Upload, Video } from 'lucide-react';
import {
  downloadConcurrencyAtom,
  reservedDiskBytesAtom,
  uploadConcurrencyAtom,
} from '@/stores/uiAtoms';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/hooks/useToast';
import { ApiError, apiFetchJson } from '@/utils/api';

function cn(...inputs: Parameters<typeof clsx>) {
  return twMerge(clsx(inputs));
}

const DEFAULT_CHUNK_LIMIT_MB = 20;
const BYTES_PER_GB = 1024 * 1024 * 1024;
const BYTES_PER_MB = 1024 * 1024;
const SETTINGS_TAB_STORAGE_KEY = 'tgcd-settings-active-tab';

const SETTINGS_TABS = [
  { key: 'transfer', label: '传输', icon: Upload },
  { key: 'storage', label: '存储', icon: HardDrive },
  { key: 'sessions', label: '会话', icon: Clock3 },
  { key: 'vault', label: '密码箱', icon: KeyRound },
] as const;

type SettingsTabKey = (typeof SETTINGS_TABS)[number]['key'];

function isSettingsTabKey(value: string | null): value is SettingsTabKey {
  return SETTINGS_TABS.some((tab) => tab.key === value);
}

function getTabId(key: SettingsTabKey) {
  return `settings-tab-${key}`;
}

function getPanelId(key: SettingsTabKey) {
  return `settings-panel-${key}`;
}

type RuntimeSettingsDTO = {
  uploadConcurrency: number;
  downloadConcurrency: number;
  reservedDiskBytes: number;
  uploadSessionTtlHours: number;
  uploadSessionCleanupIntervalMinutes: number;
  thumbnailCacheMaxBytes: number;
  thumbnailCacheTtlHours: number;
  thumbnailGenerateConcurrency: number;
  vaultSessionTtlMinutes: number;
  vaultPasswordEnabled: boolean;
  chunkSizeBytes: number;
};

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 w-9 h-9 rounded-xl bg-[#D4AF37]/10 dark:bg-[#D4AF37]/15 flex items-center justify-center">
        <Icon className="w-4 h-4 text-[#D4AF37]" />
      </div>
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">{title}</h2>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{description}</p>
      </div>
    </div>
  );
}

function SettingsRow({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white/90 dark:bg-neutral-900/70 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
        <div className="min-w-0">
          <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{title}</div>
          <div className="mt-1 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">{description}</div>
        </div>
        <div className="w-full md:w-[280px] shrink-0">{children}</div>
      </div>
    </div>
  );
}

function bytesToGBString(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return '0';
  const gb = v / BYTES_PER_GB;
  if (Number.isInteger(gb)) return String(gb);
  return gb.toFixed(2);
}

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTabKey>(() => {
    try {
      const stored = window.localStorage.getItem(SETTINGS_TAB_STORAGE_KEY);
      if (isSettingsTabKey(stored)) return stored;
    } catch {
      // 忽略：部分环境可能禁用 localStorage（如隐私模式/安全策略）
    }
    return 'transfer';
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(SETTINGS_TAB_STORAGE_KEY, activeTab);
    } catch {
      // 忽略：同上
    }
  }, [activeTab]);

  const [uploadConcurrency, setUploadConcurrency] = useAtom(uploadConcurrencyAtom);
  const [downloadConcurrency, setDownloadConcurrency] = useAtom(downloadConcurrencyAtom);
  const [reservedDiskBytes, setReservedDiskBytes] = useAtom(reservedDiskBytesAtom);
  const [uploadSessionTtlHours, setUploadSessionTtlHours] = useState(24);
  const [uploadSessionCleanupInterval, setUploadSessionCleanupInterval] = useState(30);
  const [thumbnailCacheMaxBytes, setThumbnailCacheMaxBytes] = useState(512 * 1024 * 1024);
  const [thumbnailCacheTtlHours, setThumbnailCacheTtlHours] = useState(24 * 30);
  const [thumbnailGenerateConcurrency, setThumbnailGenerateConcurrency] = useState(1);
  const [vaultSessionTtlMinutes, setVaultSessionTtlMinutes] = useState(60);
  const [vaultPasswordEnabled, setVaultPasswordEnabled] = useState(false);
  const { pushToast } = useToast();

  const [uploadConcurrencyInput, setUploadConcurrencyInput] = useState(String(uploadConcurrency));
  const [downloadConcurrencyInput, setDownloadConcurrencyInput] = useState(String(downloadConcurrency));
  const [reservedDiskGBInput, setReservedDiskGBInput] = useState(bytesToGBString(reservedDiskBytes));
  const [uploadSessionTtlHoursInput, setUploadSessionTtlHoursInput] = useState('24');
  const [uploadSessionCleanupIntervalInput, setUploadSessionCleanupIntervalInput] = useState('30');
  const [thumbnailCacheMaxMBInput, setThumbnailCacheMaxMBInput] = useState('512');
  const [thumbnailCacheTtlHoursInput, setThumbnailCacheTtlHoursInput] = useState('720');
  const [thumbnailGenerateConcurrencyInput, setThumbnailGenerateConcurrencyInput] = useState('1');
  const [vaultSessionTtlMinutesInput, setVaultSessionTtlMinutesInput] = useState('60');
  const [vaultPasswordInput, setVaultPasswordInput] = useState('');
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [chunkLimitMB, setChunkLimitMB] = useState(DEFAULT_CHUNK_LIMIT_MB);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const tablistRef = useRef<HTMLDivElement | null>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number } | null>(null);

  const handleTabKeyDown = useCallback((e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    // Tabs 键盘可达：左右切换、Home/End 跳转（符合常见 tablist 交互习惯）
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();

    const lastIndex = SETTINGS_TABS.length - 1;
    let nextIndex = index;
    if (e.key === 'ArrowRight') nextIndex = index >= lastIndex ? 0 : index + 1;
    if (e.key === 'ArrowLeft') nextIndex = index <= 0 ? lastIndex : index - 1;
    if (e.key === 'Home') nextIndex = 0;
    if (e.key === 'End') nextIndex = lastIndex;

    const next = SETTINGS_TABS[nextIndex];
    setActiveTab(next.key);
    tabRefs.current[nextIndex]?.focus();
  }, []);

  // 计算激活 tab 的指示器位置
  useLayoutEffect(() => {
    const activeIndex = SETTINGS_TABS.findIndex((t) => t.key === activeTab);
    const activeEl = tabRefs.current[activeIndex];
    const container = tablistRef.current;
    if (!activeEl || !container) return;

    const containerRect = container.getBoundingClientRect();
    const tabRect = activeEl.getBoundingClientRect();
    setIndicatorStyle({
      left: tabRect.left - containerRect.left + container.scrollLeft,
      width: tabRect.width,
    });
  }, [activeTab]);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetchJson<{ settings: RuntimeSettingsDTO }>('/api/settings');
      const next = res.settings;

      setUploadConcurrency(next.uploadConcurrency);
      setDownloadConcurrency(next.downloadConcurrency);
      setReservedDiskBytes(next.reservedDiskBytes);
      setUploadSessionTtlHours(next.uploadSessionTtlHours);
      setUploadSessionCleanupInterval(next.uploadSessionCleanupIntervalMinutes);
      setThumbnailCacheMaxBytes(next.thumbnailCacheMaxBytes);
      setThumbnailCacheTtlHours(next.thumbnailCacheTtlHours);
      setThumbnailGenerateConcurrency(next.thumbnailGenerateConcurrency);
      setVaultSessionTtlMinutes(next.vaultSessionTtlMinutes);
      setVaultPasswordEnabled(next.vaultPasswordEnabled);
      setChunkLimitMB(Math.max(1, Math.round(next.chunkSizeBytes / (1024 * 1024))));

      setUploadConcurrencyInput(String(next.uploadConcurrency));
      setDownloadConcurrencyInput(String(next.downloadConcurrency));
      setReservedDiskGBInput(bytesToGBString(next.reservedDiskBytes));
      setUploadSessionTtlHoursInput(String(next.uploadSessionTtlHours));
      setUploadSessionCleanupIntervalInput(String(next.uploadSessionCleanupIntervalMinutes));
      setThumbnailCacheMaxMBInput(String(Math.max(64, Math.round(next.thumbnailCacheMaxBytes / BYTES_PER_MB))));
      setThumbnailCacheTtlHoursInput(String(next.thumbnailCacheTtlHours));
      setThumbnailGenerateConcurrencyInput(String(next.thumbnailGenerateConcurrency));
      setVaultSessionTtlMinutesInput(String(next.vaultSessionTtlMinutes));
      setVaultPasswordInput('');
      setAdminPasswordInput('');
    } catch (err: unknown) {
      const e = err as ApiError;
      pushToast({ type: 'error', message: e?.message || '读取设置失败' });
    } finally {
      setLoading(false);
    }
  }, [pushToast, setDownloadConcurrency, setReservedDiskBytes, setUploadConcurrency]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleReset = useCallback(() => {
    setUploadConcurrencyInput(String(uploadConcurrency));
    setDownloadConcurrencyInput(String(downloadConcurrency));
    setReservedDiskGBInput(bytesToGBString(reservedDiskBytes));
    setUploadSessionTtlHoursInput(String(uploadSessionTtlHours));
    setUploadSessionCleanupIntervalInput(String(uploadSessionCleanupInterval));
    setThumbnailCacheMaxMBInput(String(Math.max(64, Math.round(thumbnailCacheMaxBytes / BYTES_PER_MB))));
    setThumbnailCacheTtlHoursInput(String(thumbnailCacheTtlHours));
    setThumbnailGenerateConcurrencyInput(String(thumbnailGenerateConcurrency));
    setVaultSessionTtlMinutesInput(String(vaultSessionTtlMinutes));
    setVaultPasswordInput('');
    setAdminPasswordInput('');
  }, [
    downloadConcurrency,
    reservedDiskBytes,
    thumbnailCacheMaxBytes,
    thumbnailCacheTtlHours,
    thumbnailGenerateConcurrency,
    uploadConcurrency,
    uploadSessionCleanupInterval,
    uploadSessionTtlHours,
    vaultSessionTtlMinutes,
  ]);

  const reservedDiskHint = useMemo(() => {
    const gb = Number.parseFloat(reservedDiskGBInput);
    if (!Number.isFinite(gb) || gb < 0) return '请输入大于等于 0 的数字';
    return `约 ${(gb * BYTES_PER_GB / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }, [reservedDiskGBInput]);

  const handleSave = useCallback(async () => {
    const nextUploadConcurrency = Number.parseInt(uploadConcurrencyInput.trim(), 10);
    const nextDownloadConcurrency = Number.parseInt(downloadConcurrencyInput.trim(), 10);
    const nextReservedGB = Number.parseFloat(reservedDiskGBInput.trim());
    const nextUploadSessionTtlHours = Number.parseInt(uploadSessionTtlHoursInput.trim(), 10);
    const nextUploadSessionCleanupInterval = Number.parseInt(uploadSessionCleanupIntervalInput.trim(), 10);
    const nextThumbnailCacheMaxMB = Number.parseInt(thumbnailCacheMaxMBInput.trim(), 10);
    const nextThumbnailCacheTtlHours = Number.parseInt(thumbnailCacheTtlHoursInput.trim(), 10);
    const nextThumbnailGenerateConcurrency = Number.parseInt(thumbnailGenerateConcurrencyInput.trim(), 10);
    const nextVaultSessionTtlMinutes = Number.parseInt(vaultSessionTtlMinutesInput.trim(), 10);
    const nextVaultPassword = vaultPasswordInput.trim();
    const nextAdminPassword = adminPasswordInput.trim();

    if (!Number.isFinite(nextUploadConcurrency) || nextUploadConcurrency < 1 || nextUploadConcurrency > 16) {
      pushToast({ type: 'error', message: '并发上传范围应为 1~16' });
      return;
    }
    if (
      !Number.isFinite(nextDownloadConcurrency) ||
      nextDownloadConcurrency < 1 ||
      nextDownloadConcurrency > 32
    ) {
      pushToast({ type: 'error', message: '并发下载范围应为 1~32' });
      return;
    }
    if (!Number.isFinite(nextReservedGB) || nextReservedGB < 0) {
      pushToast({ type: 'error', message: '预留硬盘空间必须为大于等于 0 的数字' });
      return;
    }
    if (!Number.isFinite(nextUploadSessionTtlHours) || nextUploadSessionTtlHours < 1 || nextUploadSessionTtlHours > 720) {
      pushToast({ type: 'error', message: '会话 TTL 范围应为 1~720 小时' });
      return;
    }
    if (
      !Number.isFinite(nextUploadSessionCleanupInterval) ||
      nextUploadSessionCleanupInterval < 1 ||
      nextUploadSessionCleanupInterval > 1440
    ) {
      pushToast({ type: 'error', message: '清理周期范围应为 1~1440 分钟' });
      return;
    }
    if (
      !Number.isFinite(nextThumbnailCacheMaxMB) ||
      nextThumbnailCacheMaxMB < 64 ||
      nextThumbnailCacheMaxMB > 10 * 1024
    ) {
      pushToast({ type: 'error', message: '缩略图缓存上限范围应为 64MB~10240MB' });
      return;
    }
    if (
      !Number.isFinite(nextThumbnailCacheTtlHours) ||
      nextThumbnailCacheTtlHours < 1 ||
      nextThumbnailCacheTtlHours > 24 * 365
    ) {
      pushToast({ type: 'error', message: '缩略图缓存 TTL 范围应为 1~8760 小时' });
      return;
    }
    if (
      !Number.isFinite(nextThumbnailGenerateConcurrency) ||
      nextThumbnailGenerateConcurrency < 1 ||
      nextThumbnailGenerateConcurrency > 4
    ) {
      pushToast({ type: 'error', message: '缩略图生成并发范围应为 1~4' });
      return;
    }
    if (
      !Number.isFinite(nextVaultSessionTtlMinutes) ||
      nextVaultSessionTtlMinutes < 1 ||
      nextVaultSessionTtlMinutes > 1440
    ) {
      pushToast({ type: 'error', message: '密码箱密码有效期范围应为 1~1440 分钟' });
      return;
    }
    if (nextVaultPassword && !nextAdminPassword) {
      pushToast({ type: 'error', message: '更换密码箱密码前，请输入管理员访问密码' });
      return;
    }

    const nextReservedBytes = Math.round(nextReservedGB * BYTES_PER_GB);
    const nextThumbnailCacheMaxBytes = Math.round(nextThumbnailCacheMaxMB * BYTES_PER_MB);

    setSaving(true);
    try {
      const res = await apiFetchJson<{ settings: RuntimeSettingsDTO }>('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploadConcurrency: nextUploadConcurrency,
          downloadConcurrency: nextDownloadConcurrency,
          reservedDiskBytes: nextReservedBytes,
          uploadSessionTtlHours: nextUploadSessionTtlHours,
          uploadSessionCleanupIntervalMinutes: nextUploadSessionCleanupInterval,
          thumbnailCacheMaxBytes: nextThumbnailCacheMaxBytes,
          thumbnailCacheTtlHours: nextThumbnailCacheTtlHours,
          thumbnailGenerateConcurrency: nextThumbnailGenerateConcurrency,
          vaultSessionTtlMinutes: nextVaultSessionTtlMinutes,
          vaultPassword: nextVaultPassword || undefined,
          adminPassword: nextAdminPassword || undefined,
        }),
      });

      const next = res.settings;
      setUploadConcurrency(next.uploadConcurrency);
      setDownloadConcurrency(next.downloadConcurrency);
      setReservedDiskBytes(next.reservedDiskBytes);
      setUploadSessionTtlHours(next.uploadSessionTtlHours);
      setUploadSessionCleanupInterval(next.uploadSessionCleanupIntervalMinutes);
      setThumbnailCacheMaxBytes(next.thumbnailCacheMaxBytes);
      setThumbnailCacheTtlHours(next.thumbnailCacheTtlHours);
      setThumbnailGenerateConcurrency(next.thumbnailGenerateConcurrency);
      setVaultSessionTtlMinutes(next.vaultSessionTtlMinutes);
      setVaultPasswordEnabled(next.vaultPasswordEnabled);
      setChunkLimitMB(Math.max(1, Math.round(next.chunkSizeBytes / (1024 * 1024))));

      setUploadConcurrencyInput(String(next.uploadConcurrency));
      setDownloadConcurrencyInput(String(next.downloadConcurrency));
      setReservedDiskGBInput(bytesToGBString(next.reservedDiskBytes));
      setUploadSessionTtlHoursInput(String(next.uploadSessionTtlHours));
      setUploadSessionCleanupIntervalInput(String(next.uploadSessionCleanupIntervalMinutes));
      setThumbnailCacheMaxMBInput(String(Math.max(64, Math.round(next.thumbnailCacheMaxBytes / BYTES_PER_MB))));
      setThumbnailCacheTtlHoursInput(String(next.thumbnailCacheTtlHours));
      setThumbnailGenerateConcurrencyInput(String(next.thumbnailGenerateConcurrency));
      setVaultSessionTtlMinutesInput(String(next.vaultSessionTtlMinutes));
      setVaultPasswordInput('');
      setAdminPasswordInput('');

      pushToast({ type: 'success', message: nextVaultPassword ? '设置已保存，密码箱密码已更新' : '设置已保存' });
    } catch (err: unknown) {
      const e = err as ApiError;
      pushToast({ type: 'error', message: e?.message || '保存设置失败' });
    } finally {
      setSaving(false);
    }
  }, [
    adminPasswordInput,
    downloadConcurrencyInput,
    pushToast,
    reservedDiskGBInput,
    thumbnailCacheMaxMBInput,
    thumbnailCacheTtlHoursInput,
    thumbnailGenerateConcurrencyInput,
    uploadSessionCleanupIntervalInput,
    uploadSessionTtlHoursInput,
    setDownloadConcurrency,
    setReservedDiskBytes,
    setUploadConcurrency,
    uploadConcurrencyInput,
    vaultPasswordInput,
    vaultSessionTtlMinutesInput,
  ]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 md:px-6 py-6 md:py-8">
      <div className="rounded-3xl border border-neutral-200/80 dark:border-neutral-700/80 bg-gradient-to-br from-white to-neutral-50 dark:from-neutral-900 dark:to-neutral-950 p-5 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
              设置
            </h1>
            <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
              按分类调整上传、下载、磁盘保护、会话清理与密码箱等运行时设置。
            </p>
          </div>
          <div
            className="hidden md:flex items-center gap-2 rounded-xl border border-neutral-200 dark:border-neutral-700 px-3 py-1.5 text-xs text-neutral-500 dark:text-neutral-400"
            aria-live="polite"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
            {loading ? '正在读取配置' : '配置已加载'}
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-8">
        {/* 横向 Tabs：分类切换 */}
        <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-700/80 bg-white/70 dark:bg-neutral-900/50 backdrop-blur-xl p-1">
          <div
            ref={tablistRef}
            className="relative flex items-center gap-1 overflow-x-auto"
            role="tablist"
            aria-label="设置分类"
          >
            {/* 滑动背景块指示器 */}
            {indicatorStyle && (
              <span
                aria-hidden="true"
                className="absolute top-0 bottom-0 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700/70 shadow-sm transition-all duration-300 ease-out pointer-events-none"
                style={{
                  left: indicatorStyle.left,
                  width: indicatorStyle.width,
                }}
              />
            )}
            {SETTINGS_TABS.map((tab, index) => {
              const isActive = tab.key === activeTab;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  ref={(node) => {
                    tabRefs.current[index] = node;
                  }}
                  type="button"
                  role="tab"
                  id={getTabId(tab.key)}
                  aria-selected={isActive}
                  aria-controls={getPanelId(tab.key)}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => setActiveTab(tab.key)}
                  onKeyDown={(e) => handleTabKeyDown(e, index)}
                  className={cn(
                    'relative z-10 inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap',
                    'transition-colors duration-200 outline-none',
                    isActive
                      ? 'text-neutral-900 dark:text-neutral-100'
                      : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'flex items-center justify-center w-5 h-5',
                      isActive ? 'text-[#D4AF37]' : 'text-neutral-400 dark:text-neutral-500'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                  </span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Panels - 使用网格堆叠避免切换抖动 */}
        <div className="grid grid-cols-1 grid-rows-1">
          <div
            role="tabpanel"
            id={getPanelId('transfer')}
            aria-labelledby={getTabId('transfer')}
            className={cn(
              'col-start-1 row-start-1 transition-opacity duration-200',
              activeTab === 'transfer' ? 'opacity-100' : 'opacity-0 pointer-events-none'
            )}
          >
            <div className="space-y-8">
              <section className="space-y-3">
                <SectionHeader
                  icon={Upload}
                  title="上传策略"
                  description="当前接入策略固定为浏览器分片上传；官方模式会继续分片写入 Telegram，自建模式会在服务端合并后单文件写入 Telegram。"
                />
                <SettingsRow
                  title="分片上传"
                  description={`已固定开启。浏览器会按 ${chunkLimitMB}MB 分片上传到后端，以支持断点续传与大文件稳定传输。`}
                >
                  <label className="inline-flex select-none items-center gap-2">
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                      已固定开启
                    </span>
                    <input
                      type="checkbox"
                      checked
                      disabled
                      autoComplete="off"
                      className="h-5 w-5 rounded border-neutral-300 dark:border-neutral-600 text-[#D4AF37] focus:ring-[#D4AF37]"
                    />
                  </label>
                </SettingsRow>
                <SettingsRow
                  title="并发上传"
                  description="后端会限制同时进行的上传请求；超过阈值的上传会进入排队等待，前端队列也按该值并行。"
                >
                  <Input
                    type="number"
                    min={1}
                    max={16}
                    value={uploadConcurrencyInput}
                    onChange={(e) => setUploadConcurrencyInput(e.target.value)}
                    placeholder="1 ~ 16"
                  />
                </SettingsRow>
              </section>

              <section className="space-y-3">
                <SectionHeader
                  icon={Download}
                  title="下载策略"
                  description="限制同时进行的下载/预览流，防止小内存机器被大量并发占满连接。"
                />
                <SettingsRow
                  title="并发下载"
                  description="超过阈值的新下载请求会进入排队等待，直到有空闲下载槽位。"
                >
                  <Input
                    type="number"
                    min={1}
                    max={32}
                    value={downloadConcurrencyInput}
                    onChange={(e) => setDownloadConcurrencyInput(e.target.value)}
                    placeholder="1 ~ 32"
                  />
                </SettingsRow>
              </section>
            </div>
          </div>

          <div
            role="tabpanel"
            id={getPanelId('storage')}
            aria-labelledby={getTabId('storage')}
            className={cn(
              'col-start-1 row-start-1 transition-opacity duration-200',
              activeTab === 'storage' ? 'opacity-100' : 'opacity-0 pointer-events-none'
            )}
          >
            <div className="space-y-8">
              <section className="space-y-3">
                <SectionHeader icon={HardDrive} title="磁盘保护" description="用于分片临时文件写入前检查，避免服务器磁盘被占满。" />
                <SettingsRow
                  title="预留硬盘空间（GB）"
                  description="上传时会为系统保留该容量；可用空间低于阈值时拒绝新上传。"
                >
                  <Input
                    type="number"
                    min={0}
                    step={0.1}
                    value={reservedDiskGBInput}
                    onChange={(e) => setReservedDiskGBInput(e.target.value)}
                    hint={reservedDiskHint}
                    placeholder="例如 2"
                  />
                </SettingsRow>
              </section>

              <section className="space-y-3">
                <SectionHeader
                  icon={Video}
                  title="视频缩略图缓存"
                  description="后端使用 ffmpeg 生成首帧缩略图并缓存，减少视频列表重复预览带宽与延迟。"
                />
                <SettingsRow title="缓存上限（MB）" description="缩略图缓存目录的最大占用，超过后按最久未访问优先清理。">
                  <Input
                    type="number"
                    min={64}
                    max={10240}
                    value={thumbnailCacheMaxMBInput}
                    onChange={(e) => setThumbnailCacheMaxMBInput(e.target.value)}
                    placeholder="64 ~ 10240"
                  />
                </SettingsRow>
                <SettingsRow title="缓存 TTL（小时）" description="超过该时长未被访问的缩略图会被后台清理。">
                  <Input
                    type="number"
                    min={1}
                    max={8760}
                    value={thumbnailCacheTtlHoursInput}
                    onChange={(e) => setThumbnailCacheTtlHoursInput(e.target.value)}
                    placeholder="1 ~ 8760"
                  />
                </SettingsRow>
                <SettingsRow title="生成并发" description="同一时刻允许并行生成视频缩略图的任务数，建议小机器保持 1。">
                  <Input
                    type="number"
                    min={1}
                    max={4}
                    value={thumbnailGenerateConcurrencyInput}
                    onChange={(e) => setThumbnailGenerateConcurrencyInput(e.target.value)}
                    placeholder="1 ~ 4"
                  />
                </SettingsRow>
              </section>
            </div>
          </div>

          <div
            role="tabpanel"
            id={getPanelId('sessions')}
            aria-labelledby={getTabId('sessions')}
            className={cn(
              'col-start-1 row-start-1 transition-opacity duration-200',
              activeTab === 'sessions' ? 'opacity-100' : 'opacity-0 pointer-events-none'
            )}
          >
            <section className="space-y-3">
              <SectionHeader
                icon={Clock3}
                title="会话清理"
                description="用于控制续传会话的过期时间和后台清理频率，避免长期残留无效分片。"
              />
              <SettingsRow
                title="会话 TTL（小时）"
                description="超过该时间仍未完成的续传会话会被判定为过期并参与清理。"
              >
                <Input
                  type="number"
                  min={1}
                  max={720}
                  value={uploadSessionTtlHoursInput}
                  onChange={(e) => setUploadSessionTtlHoursInput(e.target.value)}
                  placeholder="1 ~ 720"
                />
              </SettingsRow>
              <SettingsRow
                title="清理周期（分钟）"
                description="后台按该周期扫描并清理过期会话与对应残留分片。"
              >
                <Input
                  type="number"
                  min={1}
                  max={1440}
                  value={uploadSessionCleanupIntervalInput}
                  onChange={(e) => setUploadSessionCleanupIntervalInput(e.target.value)}
                  placeholder="1 ~ 1440"
                />
              </SettingsRow>
            </section>
          </div>

          <div
            role="tabpanel"
            id={getPanelId('vault')}
            aria-labelledby={getTabId('vault')}
            className={cn(
              'col-start-1 row-start-1 transition-opacity duration-200',
              activeTab === 'vault' ? 'opacity-100' : 'opacity-0 pointer-events-none'
            )}
          >
            <section className="space-y-3">
              <SectionHeader
                icon={KeyRound}
                title="密码箱"
                description="密码箱路由需要二次访问密码。更换密码时必须校验管理员访问密码。"
              />
              <SettingsRow title="密码箱状态" description="未配置密码时，密码箱无法启用。">
                <div className="text-sm text-neutral-700 dark:text-neutral-300">
                  {vaultPasswordEnabled ? '已启用' : '未启用'}
                </div>
              </SettingsRow>
              <SettingsRow title="密码箱密码有效期（分钟）" description="解锁密码箱后会话保持时长，默认 60 分钟。">
                <Input
                  type="number"
                  min={1}
                  max={1440}
                  value={vaultSessionTtlMinutesInput}
                  onChange={(e) => setVaultSessionTtlMinutesInput(e.target.value)}
                  placeholder="1 ~ 1440"
                />
              </SettingsRow>
              <SettingsRow title="更换密码箱密码" description="留空表示不修改；输入新密码后，需同时填写管理员访问密码。">
                <Input
                  type="password"
                  autoComplete="off"
                  value={vaultPasswordInput}
                  onChange={(e) => setVaultPasswordInput(e.target.value)}
                  placeholder="输入新的密码箱密码"
                />
              </SettingsRow>
              <SettingsRow title="管理员访问密码" description="仅用于验证更换密码箱密码，校验通过后不会持久保存。">
                <Input
                  type="password"
                  autoComplete="off"
                  value={adminPasswordInput}
                  onChange={(e) => setAdminPasswordInput(e.target.value)}
                  placeholder="输入 APP 登录密码"
                />
              </SettingsRow>
            </section>
          </div>

        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
          <Button variant="secondary" onClick={handleReset} disabled={saving || loading}>
            重置编辑
          </Button>
          <Button
            variant="gold"
            icon={<Save className="w-4 h-4" aria-hidden="true" />}
            onClick={handleSave}
            loading={saving}
            disabled={loading}
          >
            保存设置
          </Button>
        </div>
      </div>
    </div>
  );
}
