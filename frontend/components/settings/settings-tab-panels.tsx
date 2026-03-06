"use client"

import { useState, type ComponentType, type ReactNode } from "react"
import { AlertTriangle, ArrowRightLeft, CheckCircle2, Clock3, Eye, EyeOff, HardDrive, KeyRound, Magnet, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { RuntimeSettings } from "@/lib/settings-api"
import { cn } from "@/lib/utils"
import type { RuntimeFormState, ServiceFormState, ServiceSwitchResult } from "@/lib/settings-form"
import type { SettingsText } from "@/lib/settings-i18n"

export type SettingsTab = "transfer" | "storage" | "sessions" | "torrent" | "vault" | "service"

export const SETTINGS_TAB_OPTIONS: Array<{ id: SettingsTab; icon: ComponentType<{ className?: string }> }> = [
  { id: "transfer", icon: Upload },
  { id: "storage", icon: HardDrive },
  { id: "sessions", icon: Clock3 },
  { id: "torrent", icon: Magnet },
  { id: "vault", icon: KeyRound },
  { id: "service", icon: ArrowRightLeft },
]

interface SettingsRowProps {
  label: string
  hint?: string
  children: ReactNode
}

function SettingsRow({ label, hint, children }: SettingsRowProps) {
  return (
    <div className="rounded-xl border border-border/60 bg-secondary/25 p-3.5">
      <div className="mb-2">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
    </div>
  )
}

function SecretInput({
  value,
  onChange,
  placeholder,
  showLabel,
  hideLabel,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  showLabel: string
  hideLabel: string
}) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <Input
        type={visible ? "text" : "password"}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="pr-10"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="absolute right-1 top-1 h-7 w-7"
        onClick={() => setVisible((prev) => !prev)}
        aria-label={visible ? hideLabel : showLabel}
      >
        {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </Button>
    </div>
  )
}

interface RuntimeTabProps {
  text: SettingsText
  form: RuntimeFormState
  runtimeSettings: RuntimeSettings
  update: <K extends keyof RuntimeFormState>(field: K, value: RuntimeFormState[K]) => void
}

function TransferTab({ text, form, runtimeSettings, update }: RuntimeTabProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <SettingsRow label={text.transferUploadConcurrency}>
        <Input value={form.uploadConcurrency} onChange={(event) => update("uploadConcurrency", event.target.value)} />
      </SettingsRow>
      <SettingsRow label={text.transferDownloadConcurrency}>
        <Input value={form.downloadConcurrency} onChange={(event) => update("downloadConcurrency", event.target.value)} />
      </SettingsRow>
      <SettingsRow label={text.transferReservedDiskGb}>
        <Input value={form.reservedDiskGb} onChange={(event) => update("reservedDiskGb", event.target.value)} />
      </SettingsRow>
      <SettingsRow label={text.transferChunkSizeMb}>
        <Input value={String(Math.max(1, Math.round(runtimeSettings.chunkSizeBytes / (1024 * 1024))))} disabled />
      </SettingsRow>
    </div>
  )
}

function StorageTab({ text, form, update }: RuntimeTabProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <SettingsRow label={text.storageThumbMaxMb}>
        <Input value={form.thumbnailCacheMaxMb} onChange={(event) => update("thumbnailCacheMaxMb", event.target.value)} />
      </SettingsRow>
      <SettingsRow label={text.storageThumbTtlHours}>
        <Input value={form.thumbnailCacheTtlHours} onChange={(event) => update("thumbnailCacheTtlHours", event.target.value)} />
      </SettingsRow>
      <SettingsRow label={text.storageThumbConcurrency}>
        <Input value={form.thumbnailGenerateConcurrency} onChange={(event) => update("thumbnailGenerateConcurrency", event.target.value)} />
      </SettingsRow>
      <SettingsRow label={text.sessionsCleanupMinutes}>
        <Input value={form.uploadSessionCleanupMinutes} onChange={(event) => update("uploadSessionCleanupMinutes", event.target.value)} />
      </SettingsRow>
    </div>
  )
}

function SessionsTab({ text, form, update }: RuntimeTabProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <SettingsRow label={text.sessionsTtlHours}>
        <Input value={form.uploadSessionTtlHours} onChange={(event) => update("uploadSessionTtlHours", event.target.value)} />
      </SettingsRow>
      <SettingsRow label={text.sessionsCleanupMinutes}>
        <Input value={form.uploadSessionCleanupMinutes} onChange={(event) => update("uploadSessionCleanupMinutes", event.target.value)} />
      </SettingsRow>
    </div>
  )
}

function TorrentTab({ text, form, update }: RuntimeTabProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <SettingsRow label={text.torrentPassword}>
        <Input
          type="password"
          value={form.torrentQbtPassword}
          onChange={(event) => update("torrentQbtPassword", event.target.value)}
          placeholder={text.torrentPasswordPlaceholder}
        />
      </SettingsRow>
      <SettingsRow label={text.torrentDeleteMode}>
        <Select value={form.torrentDeleteMode} onValueChange={(value) => update("torrentDeleteMode", value as RuntimeFormState["torrentDeleteMode"])}>
          <SelectTrigger className="w-full bg-background/70">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="glass border-border/60">
            <SelectItem value="never">{text.torrentModeNever}</SelectItem>
            <SelectItem value="immediate">{text.torrentModeImmediate}</SelectItem>
            <SelectItem value="fixed">{text.torrentModeFixed}</SelectItem>
            <SelectItem value="random">{text.torrentModeRandom}</SelectItem>
          </SelectContent>
        </Select>
      </SettingsRow>
      {form.torrentDeleteMode === "fixed" ? (
        <SettingsRow label={text.torrentFixedMinutes}>
          <Input value={form.torrentFixedMinutes} onChange={(event) => update("torrentFixedMinutes", event.target.value)} />
        </SettingsRow>
      ) : null}
      {form.torrentDeleteMode === "random" ? (
        <>
          <SettingsRow label={text.torrentRandomMin}>
            <Input value={form.torrentRandomMin} onChange={(event) => update("torrentRandomMin", event.target.value)} />
          </SettingsRow>
          <SettingsRow label={text.torrentRandomMax}>
            <Input value={form.torrentRandomMax} onChange={(event) => update("torrentRandomMax", event.target.value)} />
          </SettingsRow>
        </>
      ) : null}
    </div>
  )
}

function VaultTab({ text, form, runtimeSettings, update }: RuntimeTabProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <SettingsRow label={text.vaultEnabled}>
        <div className="rounded-lg border border-border/60 bg-background/60 px-3 py-2.5 text-sm">
          {runtimeSettings.vaultPasswordEnabled ? text.vaultEnabledYes : text.vaultEnabledNo}
        </div>
      </SettingsRow>
      <SettingsRow label={text.vaultSessionMinutes}>
        <Input value={form.vaultSessionTtlMinutes} onChange={(event) => update("vaultSessionTtlMinutes", event.target.value)} />
      </SettingsRow>
      <SettingsRow label={text.vaultPassword}>
        <Input type="password" value={form.vaultPassword} onChange={(event) => update("vaultPassword", event.target.value)} />
      </SettingsRow>
      <SettingsRow label={text.adminPassword}>
        <Input type="password" value={form.adminPassword} onChange={(event) => update("adminPassword", event.target.value)} />
      </SettingsRow>
    </div>
  )
}

function ServiceTab({
  text,
  form,
  update,
}: {
  text: SettingsText
  form: ServiceFormState
  update: <K extends keyof ServiceFormState>(field: K, value: ServiceFormState[K]) => void
}) {
  const selfHosted = form.accessMethod === "self_hosted_bot_api"

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <SettingsRow label={text.serviceMethod}>
        <Select value={form.accessMethod} onValueChange={(value) => update("accessMethod", value as ServiceFormState["accessMethod"])}>
          <SelectTrigger className="w-full bg-background/70">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="glass border-border/60">
            <SelectItem value="official_bot_api">{text.serviceOfficial}</SelectItem>
            <SelectItem value="self_hosted_bot_api">{text.serviceSelfHosted}</SelectItem>
          </SelectContent>
        </Select>
      </SettingsRow>
      <SettingsRow label={text.serviceBotToken}>
        <SecretInput
          value={form.tgBotToken}
          onChange={(value) => update("tgBotToken", value)}
          showLabel={text.showBotToken}
          hideLabel={text.hideBotToken}
        />
      </SettingsRow>
      <SettingsRow label={text.serviceChatId}>
        <Input value={form.tgStorageChatId} onChange={(event) => update("tgStorageChatId", event.target.value)} />
      </SettingsRow>

      {selfHosted ? (
        <>
          <SettingsRow label={text.serviceApiId}>
            <Input value={form.tgApiId} onChange={(event) => update("tgApiId", event.target.value)} />
          </SettingsRow>
          <SettingsRow label={text.serviceApiHash}>
            <SecretInput
              value={form.tgApiHash}
              onChange={(value) => update("tgApiHash", value)}
              showLabel={text.showApiHash}
              hideLabel={text.hideApiHash}
            />
          </SettingsRow>
          <SettingsRow label={text.serviceApiBaseUrl}>
            <Input value={form.tgApiBaseUrl} onChange={(event) => update("tgApiBaseUrl", event.target.value)} />
          </SettingsRow>
        </>
      ) : null}
    </div>
  )
}

function ServiceResultCard({ text, result }: { text: SettingsText; result: ServiceSwitchResult | null }) {
  if (!result) return null
  const bot = result.details?.bot
  const chat = result.details?.chat
  const admin = result.details?.admin

  return (
    <div className="rounded-xl border border-border/60 bg-secondary/30 p-3.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">{text.serviceLastResult}</p>
        <span className="text-[11px] text-muted-foreground">{result.testedAt}</span>
      </div>
      <div className="mt-2 flex items-center gap-2 text-sm">
        {result.rolledBack ? <AlertTriangle className="h-4 w-4 text-orange-500" /> : <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
        <span className={cn("font-medium", result.rolledBack ? "text-orange-600 dark:text-orange-300" : "text-emerald-600 dark:text-emerald-300")}>
          {result.rolledBack ? text.serviceRolledBack : result.message}
        </span>
      </div>
      {result.rolledBack ? <p className="mt-1 text-xs text-muted-foreground">{result.message}</p> : null}
      {result.details ? (
        <div className="mt-3 grid gap-2 text-xs md:grid-cols-3">
          <div className="rounded-lg border border-border/55 bg-background/65 px-2.5 py-2">{bot?.ok ? "Bot ✓" : `Bot ✕ ${bot?.error || ""}`}</div>
          <div className="rounded-lg border border-border/55 bg-background/65 px-2.5 py-2">{chat?.ok ? "Chat ✓" : `Chat ✕ ${chat?.error || ""}`}</div>
          <div className="rounded-lg border border-border/55 bg-background/65 px-2.5 py-2">{admin?.ok ? "Admin ✓" : `Admin ✕ ${admin?.error || ""}`}</div>
        </div>
      ) : null}
    </div>
  )
}

interface SettingsTabPanelsProps {
  activeTab: SettingsTab
  text: SettingsText
  runtimeSettings: RuntimeSettings
  runtimeForm: RuntimeFormState
  serviceForm: ServiceFormState
  serviceResult: ServiceSwitchResult | null
  updateRuntimeForm: <K extends keyof RuntimeFormState>(field: K, value: RuntimeFormState[K]) => void
  updateServiceForm: <K extends keyof ServiceFormState>(field: K, value: ServiceFormState[K]) => void
}

export function SettingsTabPanels(props: SettingsTabPanelsProps) {
  if (props.activeTab === "transfer") {
    return <TransferTab text={props.text} form={props.runtimeForm} runtimeSettings={props.runtimeSettings} update={props.updateRuntimeForm} />
  }
  if (props.activeTab === "storage") {
    return <StorageTab text={props.text} form={props.runtimeForm} runtimeSettings={props.runtimeSettings} update={props.updateRuntimeForm} />
  }
  if (props.activeTab === "sessions") {
    return <SessionsTab text={props.text} form={props.runtimeForm} runtimeSettings={props.runtimeSettings} update={props.updateRuntimeForm} />
  }
  if (props.activeTab === "torrent") {
    return <TorrentTab text={props.text} form={props.runtimeForm} runtimeSettings={props.runtimeSettings} update={props.updateRuntimeForm} />
  }
  if (props.activeTab === "vault") {
    return <VaultTab text={props.text} form={props.runtimeForm} runtimeSettings={props.runtimeSettings} update={props.updateRuntimeForm} />
  }

  return (
    <div className="space-y-3">
      <ServiceTab text={props.text} form={props.serviceForm} update={props.updateServiceForm} />
      <ServiceResultCard text={props.text} result={props.serviceResult} />
    </div>
  )
}

export function tabLabel(tab: SettingsTab, text: SettingsText) {
  if (tab === "transfer") return text.tabTransfer
  if (tab === "storage") return text.tabStorage
  if (tab === "sessions") return text.tabSessions
  if (tab === "torrent") return text.tabTorrent
  if (tab === "vault") return text.tabVault
  return text.tabService
}
