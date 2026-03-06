"use client"

import { useMemo } from "react"
import { KeyRound, Lock, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { filesMessages } from "@/lib/i18n"

interface VaultStatePanelProps {
  text: (typeof filesMessages)["en"]
  locale: "en" | "zh"
  loading: boolean
  enabled: boolean
  unlocked: boolean
  expiresAt: string
  password: string
  unlocking: boolean
  onPasswordChange: (value: string) => void
  onUnlock: () => void
  onLock: () => void
}

function toExpireText(expiresAt: string, locale: "en" | "zh") {
  const parsed = Date.parse(expiresAt)
  if (!Number.isFinite(parsed)) return "-"
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(parsed))
}

export function VaultStatePanel({
  text,
  locale,
  loading,
  enabled,
  unlocked,
  expiresAt,
  password,
  unlocking,
  onPasswordChange,
  onUnlock,
  onLock,
}: VaultStatePanelProps) {
  const expireText = useMemo(() => toExpireText(expiresAt, locale), [expiresAt, locale])

  if (loading) {
    return (
      <div className="rounded-2xl border border-border/55 bg-secondary/35 px-4 py-6 text-sm text-muted-foreground">
        {text.vaultStatusLoading}
      </div>
    )
  }

  if (!enabled) {
    return (
      <div className="rounded-2xl border border-border/55 bg-secondary/35 px-4 py-6">
        <div className="flex items-start gap-2.5">
          <KeyRound className="mt-0.5 h-5 w-5 text-primary" />
          <div>
            <h3 className="text-base font-semibold text-foreground">{text.vaultNotEnabledTitle}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{text.vaultNotEnabledDesc}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!unlocked) {
    return (
      <div className="rounded-2xl border border-border/55 bg-secondary/35 px-4 py-6">
        <div className="flex items-start gap-2.5">
          <Lock className="mt-0.5 h-5 w-5 text-primary" />
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-foreground">{text.vaultLockedTitle}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{text.vaultLockedDesc}</p>
            <div className="mt-4 flex max-w-md flex-col gap-2 sm:flex-row">
              <Input
                type="password"
                value={password}
                placeholder={text.vaultPasswordLabel}
                onChange={(event) => onPasswordChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") onUnlock()
                }}
              />
              <Button onClick={onUnlock} disabled={unlocking} className="min-w-[116px]">
                {unlocking ? text.vaultUnlocking : text.vaultUnlockAction}
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-border/55 bg-secondary/35 px-4 py-3">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm font-medium text-foreground">
          <ShieldCheck className="h-4 w-4 text-primary" />
          {text.vaultUnlockedHint}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {text.vaultExpiresAt}: {expireText}
        </p>
      </div>
      <Button size="sm" variant="outline" onClick={onLock} className="shrink-0">
        {text.vaultLockAction}
      </Button>
    </div>
  )
}
