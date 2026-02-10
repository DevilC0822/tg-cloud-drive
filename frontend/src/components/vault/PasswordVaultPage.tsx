import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { KeyRound, Lock, ShieldCheck, Unlock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ApiError, apiFetchJson } from '@/utils/api';
import { useToast } from '@/hooks/useToast';

type VaultStatusDTO = {
  enabled: boolean;
  unlocked: boolean;
  expiresAt?: string;
};

type PasswordVaultPageProps = {
  children?: ReactNode;
  onUnlocked?: () => void;
  onLocked?: () => void;
};

function formatExpireTime(value?: string): string {
  if (!value) return '未知';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '未知';
  return date.toLocaleString('zh-CN', { hour12: false });
}

export function PasswordVaultPage({ children, onUnlocked, onLocked }: PasswordVaultPageProps) {
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState(false);
  const [status, setStatus] = useState<VaultStatusDTO>({ enabled: false, unlocked: false });
  const [password, setPassword] = useState('');
  const { pushToast } = useToast();

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetchJson<VaultStatusDTO>('/api/vault/status');
      setStatus(res);
    } catch (err: unknown) {
      const e = err as ApiError;
      pushToast({ type: 'error', message: e?.message || '读取密码箱状态失败' });
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const handleUnlock = useCallback(async () => {
    const nextPassword = password.trim();
    if (!nextPassword) {
      pushToast({ type: 'error', message: '请输入密码箱密码' });
      return;
    }

    setUnlocking(true);
    try {
      const res = await apiFetchJson<{ ok: boolean; expiresAt?: string }>('/api/vault/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: nextPassword }),
      });
      setPassword('');
      setStatus({ enabled: true, unlocked: true, expiresAt: res.expiresAt });
      onUnlocked?.();
      pushToast({ type: 'success', message: '密码箱已解锁' });
    } catch (err: unknown) {
      const e = err as ApiError;
      pushToast({ type: 'error', message: e?.message || '密码箱解锁失败' });
    } finally {
      setUnlocking(false);
    }
  }, [onUnlocked, password, pushToast]);

  const handleLock = useCallback(async () => {
    try {
      await apiFetchJson<{ ok: boolean }>('/api/vault/lock', { method: 'POST' });
      setStatus((prev) => ({ ...prev, unlocked: false, expiresAt: '' }));
      onLocked?.();
      pushToast({ type: 'success', message: '已锁定密码箱' });
    } catch (err: unknown) {
      const e = err as ApiError;
      pushToast({ type: 'error', message: e?.message || '锁定失败' });
    }
  }, [onLocked, pushToast]);

  const expireText = useMemo(() => formatExpireTime(status.expiresAt), [status.expiresAt]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 md:px-6 py-8">
        <div className="rounded-3xl border border-neutral-200/80 dark:border-neutral-700/80 bg-white/80 dark:bg-neutral-900/70 p-6 text-sm text-neutral-500 dark:text-neutral-400">
          正在加载密码箱状态...
        </div>
      </div>
    );
  }

  if (!status.enabled) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 md:px-6 py-8">
        <div className="rounded-3xl border border-neutral-200/80 dark:border-neutral-700/80 bg-white/90 dark:bg-neutral-900/70 p-6 md:p-8">
          <div className="flex items-start gap-3">
            <KeyRound className="mt-0.5 h-5 w-5 text-[#D4AF37]" />
            <div>
              <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">密码箱未启用</h1>
              <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                请先到设置页面配置“密码箱密码”，配置后即可访问密码箱路由。
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!status.unlocked) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 md:px-6 py-8">
        <div className="rounded-3xl border border-neutral-200/80 dark:border-neutral-700/80 bg-white/90 dark:bg-neutral-900/70 p-6 md:p-8">
          <div className="flex items-start gap-3">
            <Lock className="mt-0.5 h-5 w-5 text-[#D4AF37]" />
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">密码箱已锁定</h1>
              <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                请输入密码箱访问密码进行解锁。
              </p>
            </div>
          </div>
          <div className="mt-6 max-w-md">
            <Input
              label="密码箱密码"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码箱密码"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  void handleUnlock();
                }
              }}
            />
            <div className="mt-4">
              <Button variant="gold" onClick={() => void handleUnlock()} loading={unlocking} disabled={unlocking}>
                解锁密码箱
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="mx-auto w-full max-w-5xl px-4 md:px-6 py-6 md:py-8">
        <div className="rounded-3xl border border-neutral-200/80 dark:border-neutral-700/80 bg-white/90 dark:bg-neutral-900/70 p-6 md:p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-[#D4AF37]" />
                <h1 className="text-xl md:text-2xl font-semibold text-neutral-900 dark:text-neutral-100">密码箱</h1>
              </div>
              <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                已解锁。此视图仅展示已移入密码箱的文件，移出后将回到普通文件视图。
              </p>
              <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">本次会话有效至：{expireText}</p>
            </div>
            <Button variant="secondary" onClick={() => void handleLock()} icon={<Unlock className="w-4 h-4" />}>
              重新锁定
            </Button>
          </div>
        </div>
      </div>
      {children ? <div className="min-h-0 flex-1">{children}</div> : null}
    </div>
  );
}
