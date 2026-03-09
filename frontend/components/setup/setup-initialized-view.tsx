import { Link } from "react-router-dom"
import { Loader2, LockKeyhole, RefreshCcw, ShieldCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/components/i18n-provider"
import { SetupShell } from "@/components/setup/setup-shell"
import { useAuth } from "@/hooks/use-auth"
import { useSetupOverview } from "@/hooks/use-setup-overview"
import { maskSecret } from "@/lib/setup-form"
import { setupMessages, type SetupText } from "@/lib/setup-i18n"

function OverviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.35rem] border border-border/55 bg-background/60 px-4 py-3">
      <p className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">{label}</p>
      <p className="mt-2 break-all text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}

function LoadingCard({ text }: { text: SetupText }) {
  return (
    <div className="glass-card rounded-[2rem] p-6 text-sm text-muted-foreground">
      <Loader2 className="mr-3 inline h-4 w-4 animate-spin text-primary" />
      {text.loadingOverview}
    </div>
  )
}

function readText(locale: "zh" | "en") {
  return setupMessages[locale]
}

function ReadonlyOverview() {
  const { locale } = useI18n()
  const text = readText(locale)
  const { loading, error, serviceAccess, reload } = useSetupOverview(true)
  const accessMethod =
    !serviceAccess
      ? "-"
      : serviceAccess.accessMethod === "self_hosted_bot_api"
        ? text.overviewSelfHosted
        : text.overviewOfficial

  return (
    <div className="grid gap-6 xl:grid-cols-[0.86fr_1.14fr]">
      <section className="glass-card gradient-border rounded-[2rem] p-6 md:p-7">
        <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/10 px-3 py-1 text-[10px] tracking-[0.22em] text-primary uppercase">
          {text.panelBadge}
        </Badge>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-foreground">{text.overviewTitle}</h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">{text.overviewDescription}</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <div className="rounded-[1.4rem] border border-[var(--semantic-success-border)] bg-[var(--semantic-success-bg)]/40 p-4">
            <p className="font-mono text-[11px] tracking-[0.18em] text-[var(--semantic-success-text)] uppercase">{text.stageStatus}</p>
            <p className="mt-2 text-base font-semibold text-foreground">{text.initializedTitle}</p>
          </div>
          <div className="rounded-[1.4rem] border border-border/55 bg-background/60 p-4">
            <p className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">{text.overviewAccessMethod}</p>
            <p className="mt-2 text-base font-semibold text-foreground">{accessMethod}</p>
          </div>
        </div>
        <div className="mt-6 flex flex-col gap-3">
          <Button onClick={() => void reload()} disabled={loading} variant="outline" className="justify-center rounded-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            {text.overviewRefresh}
          </Button>
          <Button asChild className="justify-center rounded-full">
            <Link to="/files">{text.enterFiles}</Link>
          </Button>
          <Button asChild variant="outline" className="justify-center rounded-full">
            <Link to="/settings">{text.goSettings}</Link>
          </Button>
        </div>
      </section>

      <section className="glass-card rounded-[2rem] p-6 md:p-7">
        {error ? (
          <div className="rounded-[1.3rem] border border-[var(--semantic-error-border)] bg-[var(--semantic-error-bg)]/40 px-4 py-3 text-sm text-[var(--semantic-error-text)]">
            {error || text.overviewLoadFailed}
          </div>
        ) : null}

        {!serviceAccess && loading ? (
          <LoadingCard text={text} />
        ) : serviceAccess ? (
          <div className="grid gap-3 md:grid-cols-2">
            <OverviewRow label={text.overviewAccessMethod} value={accessMethod} />
            <OverviewRow label={text.overviewChatId} value={serviceAccess.tgStorageChatId || "-"} />
            <OverviewRow label={text.overviewBotToken} value={maskSecret(serviceAccess.tgBotToken)} />
            <OverviewRow label={text.overviewApiId} value={serviceAccess.tgApiId != null ? String(serviceAccess.tgApiId) : "-"} />
            <OverviewRow label={text.overviewApiHash} value={maskSecret(serviceAccess.tgApiHash)} />
            <OverviewRow label={text.overviewApiBaseUrl} value={serviceAccess.tgApiBaseUrl || "-"} />
          </div>
        ) : (
          <LoadingCard text={text} />
        )}
      </section>
    </div>
  )
}

function LockedOverview() {
  const { locale } = useI18n()
  const text = readText(locale)
  const { openLoginDialog } = useAuth()

  return (
    <section className="glass-card gradient-border mx-auto max-w-4xl rounded-[2rem] p-6 md:p-8">
      <div className="grid gap-6 md:grid-cols-[1.06fr_0.94fr]">
        <div>
          <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/10 px-3 py-1 text-[10px] tracking-[0.22em] text-primary uppercase">
            {text.panelBadge}
          </Badge>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-foreground">{text.initializedTitle}</h1>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">{text.initializedDescription}</p>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">{text.initializedLoginHint}</p>
          <div className="mt-6 flex flex-col gap-3 md:flex-row">
            <Button onClick={() => openLoginDialog("/setup")} className="rounded-full">
              {text.loginToView}
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/files">{text.enterFiles}</Link>
            </Button>
          </div>
        </div>

        <div className="rounded-[1.7rem] border border-border/55 bg-background/60 p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] border border-primary/20 bg-primary/10">
            <LockKeyhole className="h-5 w-5 text-primary" />
          </div>
          <div className="mt-5 grid gap-3">
            <div className="rounded-[1.25rem] border border-[var(--semantic-success-border)] bg-[var(--semantic-success-bg)]/40 px-4 py-3">
              <p className="font-mono text-[11px] tracking-[0.18em] text-[var(--semantic-success-text)] uppercase">{text.stageStatus}</p>
              <p className="mt-2 text-sm font-semibold text-foreground">{text.initializedTitle}</p>
            </div>
            <div className="rounded-[1.25rem] border border-border/55 bg-background/75 px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <ShieldCheck className="h-4 w-4 text-primary" />
                {text.loginToView}
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{text.initializedLoginHint}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export function SetupInitializedView() {
  const { locale } = useI18n()
  const text = readText(locale)
  const { authChecked, authChecking, authenticated } = useAuth()

  return (
    <SetupShell>
      <main className="mx-auto max-w-6xl px-4 pb-10 pt-28 md:px-6 md:pb-12 md:pt-32">
        {!authChecked || authChecking ? (
          <LoadingCard text={text} />
        ) : authenticated ? (
          <ReadonlyOverview />
        ) : (
          <LockedOverview />
        )}
      </main>
    </SetupShell>
  )
}
