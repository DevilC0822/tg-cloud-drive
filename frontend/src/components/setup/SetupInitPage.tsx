import { AlertTriangle, Bot, CheckCircle2, CloudOff, Eye, EyeOff, LockKeyhole, ServerCog, ShieldCheck } from 'lucide-react';
import { useState, type ComponentType } from 'react';
import { ActionIconButton, ActionTextButton } from '@/components/ui/HeroActionPrimitives';
import { Input } from '@/components/ui/Input';
import { ToastContainer } from '@/components/ui/ToastContainer';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export type SetupAccessMethod = 'official_bot_api' | 'self_hosted_bot_api' | 'mtproto';

export interface SetupConnectionTestDetails {
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
}

interface SetupInitPageProps {
  accessMethod: SetupAccessMethod;
  botToken: string;
  storageChatId: string;
  apiId: string;
  apiHash: string;
  adminPassword: string;
  adminPasswordConfirm: string;
  loading: boolean;
  testLoading: boolean;
  testDetails: SetupConnectionTestDetails | null;
  onAccessMethodChange: (method: Exclude<SetupAccessMethod, 'mtproto'>) => void;
  onBotTokenChange: (value: string) => void;
  onStorageChatIdChange: (value: string) => void;
  onApiIdChange: (value: string) => void;
  onApiHashChange: (value: string) => void;
  onAdminPasswordChange: (value: string) => void;
  onAdminPasswordConfirmChange: (value: string) => void;
  onTestConnection: () => void;
  onSubmit: () => void;
}

function cn(...inputs: (string | undefined | null | boolean)[]) {
  return twMerge(clsx(inputs));
}

type AccessOption = {
  key: SetupAccessMethod;
  title: string;
  desc: string;
  badge: string;
  disabled?: boolean;
  Icon: ComponentType<{ className?: string }>;
};

const ACCESS_OPTIONS: AccessOption[] = [
  {
    key: 'official_bot_api',
    title: '官方 Bot API',
    desc: '官方接入，配置简单，适合大多数场景。',
    badge: '推荐',
    Icon: ShieldCheck,
  },
  {
    key: 'self_hosted_bot_api',
    title: '自建 Bot API',
    desc: '使用自建网关，需额外提供 API ID / API Hash。',
    badge: '高级',
    Icon: ServerCog,
  },
  {
    key: 'mtproto',
    title: 'MTProto',
    desc: '目前暂不开放，后续版本支持。',
    badge: '暂时禁用',
    disabled: true,
    Icon: CloudOff,
  },
];

export function SetupInitPage({
  accessMethod,
  botToken,
  storageChatId,
  apiId,
  apiHash,
  adminPassword,
  adminPasswordConfirm,
  loading,
  testLoading,
  testDetails,
  onAccessMethodChange,
  onBotTokenChange,
  onStorageChatIdChange,
  onApiIdChange,
  onApiHashChange,
  onAdminPasswordChange,
  onAdminPasswordConfirmChange,
  onTestConnection,
  onSubmit,
}: SetupInitPageProps) {
  const isSelfHosted = accessMethod === 'self_hosted_bot_api';
  const [showBotToken, setShowBotToken] = useState(false);
  const [showApiHash, setShowApiHash] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [showAdminPasswordConfirm, setShowAdminPasswordConfirm] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--color-brand-50)] via-white to-stone-100 dark:from-neutral-950 dark:via-neutral-950 dark:to-neutral-900 px-4 py-8 md:px-6 md:py-12">
      <div className="mx-auto w-full max-w-4xl">
        <div className="rounded-3xl border border-[var(--theme-primary-a35)] dark:border-neutral-700 bg-white/92 dark:bg-neutral-900/85 backdrop-blur-xl shadow-[0_24px_48px_-34px_var(--theme-primary-a24)] dark:shadow-black/30 p-6 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--theme-primary-a35)] bg-[var(--theme-primary-a12)] px-3 py-1 text-xs text-[var(--theme-primary-ink)]">
                <Bot className="h-3.5 w-3.5" />
                初始化步骤 1 / 2
              </div>
              <h1 className="mt-3 text-2xl md:text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
                配置接入方式
              </h1>
              <p className="mt-2 text-sm md:text-base text-slate-600 dark:text-slate-300">
                选择一种接入模式并填写参数，保存前可以先测试连接。
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {ACCESS_OPTIONS.map((option) => {
              const active = accessMethod === option.key;
              const disabled = !!option.disabled;
              const Icon = option.Icon;
              return (
                <ActionTextButton
                  key={option.key}
                  tone="brand"
                  active={active}
                  isDisabled={disabled}
                  aria-pressed={active}
                  onPress={() => {
                    if (disabled) return;
                    onAccessMethodChange(option.key as Exclude<SetupAccessMethod, 'mtproto'>);
                  }}
                  className={cn(
                    'h-auto min-h-0 w-full items-stretch justify-start rounded-2xl border p-4 text-left',
                    'flex-col gap-0 whitespace-normal transition-colors duration-200',
                    disabled
                      ? 'opacity-55 cursor-not-allowed border-neutral-200 bg-neutral-100/70 dark:border-neutral-700 dark:bg-neutral-800/40'
                      : 'cursor-pointer',
                    !disabled && active && 'border-[var(--theme-primary)] bg-[var(--theme-primary-a08)]',
                    !disabled &&
                      !active &&
                      'border-neutral-200 bg-white hover:border-[var(--theme-primary-a55)] hover:bg-[var(--theme-primary-a08)] dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-neutral-600 dark:hover:bg-neutral-800'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="inline-flex items-center justify-center rounded-xl bg-[var(--theme-primary-a12)] text-[var(--theme-primary-ink)] p-2">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[11px] font-medium',
                        disabled
                          ? 'bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300'
                          : active
                          ? 'bg-[var(--theme-primary-a20)] text-[var(--theme-primary-ink-strong)]'
                          : 'bg-[var(--theme-primary-a12)] text-[var(--theme-primary-ink)]'
                      )}
                    >
                      {option.badge}
                    </span>
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-neutral-900 dark:text-neutral-100">{option.title}</h3>
                  <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{option.desc}</p>
                </ActionTextButton>
              );
            })}
          </div>

          <div className="mt-6 rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-4 md:p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-neutral-800 dark:text-neutral-200">
              <LockKeyhole className="h-4 w-4 text-[var(--theme-primary)]" />
              初始化参数
            </div>
            <div className="mt-4 grid gap-4">
              <Input
                label="Telegram Bot Token"
                type={showBotToken ? 'text' : 'password'}
                value={botToken}
                onChange={(e) => onBotTokenChange(e.target.value)}
                placeholder="123456789:AA..."
                autoFocus
                rightIcon={
                  <ActionIconButton
                    icon={showBotToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    label={showBotToken ? '隐藏 Bot Token' : '查看 Bot Token'}
                    aria-label={showBotToken ? '隐藏 Bot Token' : '查看 Bot Token'}
                    onPress={() => setShowBotToken((prev) => !prev)}
                    className="h-6 w-6 min-h-6 min-w-6"
                  />
                }
              />

              <Input
                label="Chat ID"
                value={storageChatId}
                onChange={(e) => onStorageChatIdChange(e.target.value)}
                placeholder="-100xxxxxxxxxx 或 @channelusername"
              />

              {isSelfHosted && (
                <div className="grid gap-4">
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    自建模式默认使用容器地址 `http://telegram-bot-api:8081`。
                  </p>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Input
                      label="API ID"
                      value={apiId}
                      onChange={(e) => onApiIdChange(e.target.value)}
                      placeholder="例如：12345678"
                    />
                    <Input
                      label="API Hash"
                      type={showApiHash ? 'text' : 'password'}
                      value={apiHash}
                      onChange={(e) => onApiHashChange(e.target.value)}
                      placeholder="32 位哈希值"
                      rightIcon={
                        <ActionIconButton
                          icon={showApiHash ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          label={showApiHash ? '隐藏 API Hash' : '查看 API Hash'}
                          aria-label={showApiHash ? '隐藏 API Hash' : '查看 API Hash'}
                          onPress={() => setShowApiHash((prev) => !prev)}
                          className="h-6 w-6 min-h-6 min-w-6"
                        />
                      }
                    />
                  </div>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  label="管理员密码"
                  type={showAdminPassword ? 'text' : 'password'}
                  value={adminPassword}
                  onChange={(e) => onAdminPasswordChange(e.target.value)}
                  placeholder="请输入管理员密码"
                  rightIcon={
                    <ActionIconButton
                      icon={showAdminPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      label={showAdminPassword ? '隐藏管理员密码' : '查看管理员密码'}
                      aria-label={showAdminPassword ? '隐藏管理员密码' : '查看管理员密码'}
                      onPress={() => setShowAdminPassword((prev) => !prev)}
                      className="h-6 w-6 min-h-6 min-w-6"
                    />
                  }
                />
                <Input
                  label="确认管理员密码"
                  type={showAdminPasswordConfirm ? 'text' : 'password'}
                  value={adminPasswordConfirm}
                  onChange={(e) => onAdminPasswordConfirmChange(e.target.value)}
                  placeholder="请再次输入管理员密码"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onSubmit();
                  }}
                  rightIcon={
                    <ActionIconButton
                      icon={showAdminPasswordConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      label={showAdminPasswordConfirm ? '隐藏确认密码' : '查看确认密码'}
                      aria-label={showAdminPasswordConfirm ? '隐藏确认密码' : '查看确认密码'}
                      onPress={() => setShowAdminPasswordConfirm((prev) => !prev)}
                      className="h-6 w-6 min-h-6 min-w-6"
                    />
                  }
                />
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-xs md:text-sm text-neutral-500 dark:text-neutral-400">
              当前配置仅用于初始化，后续可在“设置”页面修改。
            </p>
            <div className="w-full md:w-auto flex flex-col md:flex-row gap-2 md:min-w-[360px]">
              <ActionTextButton
                onPress={onTestConnection}
                isDisabled={loading || testLoading}
                density="cozy"
                className="w-full justify-center"
              >
                {testLoading ? '测试中...' : '先测试连接'}
              </ActionTextButton>
              <ActionTextButton
                tone="brand"
                onPress={onSubmit}
                isDisabled={loading}
                density="cozy"
                className="w-full justify-center"
              >
                {loading ? '初始化中...' : '保存并完成初始化'}
              </ActionTextButton>
            </div>
          </div>

          {testDetails && (
            <div className="mt-5 rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50/70 dark:bg-neutral-800/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {testDetails.overallOk ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  )}
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">连接测试详情</h3>
                </div>
                <span className="text-xs text-neutral-500 dark:text-neutral-400">{testDetails.testedAt}</span>
              </div>

              <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">{testDetails.summary}</p>
              {testDetails.apiBaseUrl && (
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                  Bot API 地址：{testDetails.apiBaseUrl}
                </p>
              )}

              <div className="mt-4 grid gap-2 text-xs">
                <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-neutral-600 dark:text-neutral-300">Bot Token 校验</span>
                    <span className={cn(testDetails.bot.ok ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400')}>
                      {testDetails.bot.ok ? '通过' : '失败'}
                    </span>
                  </div>
                  <p className="mt-1 text-neutral-500 dark:text-neutral-400">
                    {testDetails.bot.ok
                      ? `@${testDetails.bot.username || '-'} · ID ${testDetails.bot.id || '-'}`
                      : testDetails.bot.error || 'Bot 校验失败'}
                  </p>
                </div>

                <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-neutral-600 dark:text-neutral-300">Chat ID 校验</span>
                    <span className={cn(testDetails.chat.ok ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400')}>
                      {testDetails.chat.ok ? '通过' : '失败'}
                    </span>
                  </div>
                  <p className="mt-1 text-neutral-500 dark:text-neutral-400">
                    {testDetails.chat.ok
                      ? `${testDetails.chat.title || '未命名会话'} · ${testDetails.chat.type || '-'} · ID ${testDetails.chat.id || '-'}`
                      : testDetails.chat.error || 'Chat 校验失败'}
                  </p>
                </div>

                <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-neutral-600 dark:text-neutral-300">管理员权限校验</span>
                    <span className={cn(testDetails.admin.ok ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400')}>
                      {testDetails.admin.ok ? '通过' : '失败'}
                    </span>
                  </div>
                  <p className="mt-1 text-neutral-500 dark:text-neutral-400">
                    {testDetails.admin.ok
                      ? `管理员数量 ${testDetails.admin.adminCount}`
                      : testDetails.admin.error || '管理员权限校验失败'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <ToastContainer />
    </div>
  );
}
