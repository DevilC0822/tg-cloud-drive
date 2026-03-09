import { AlertTriangle, Bot, CheckCircle2, Clock3, ShieldCheck, Waypoints } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { SetupConnectionDetails } from "@/lib/setup-api"
import type { SetupText } from "@/lib/setup-i18n"
import { cn } from "@/lib/utils"

interface StepSummary {
  label: string
  ok?: boolean
  detail: string
  icon: typeof Bot
  okLabel: string
  failedLabel: string
}

function describeStep(
  result: SetupConnectionDetails | null,
  key: "bot" | "chat" | "admin",
  fallback: string,
  text: SetupText,
) {
  const step = result?.[key]
  if (!step) {
    return fallback
  }
  if (step.error) {
    return step.error
  }
  if (key === "bot" && step.username) {
    return `@${step.username}`
  }
  if (key === "chat" && step.title) {
    return step.title
  }
  if (key === "admin" && typeof step.adminCount === "number") {
    return text.resultAdminCount(step.adminCount)
  }
  return fallback
}

function readStatus(details: SetupConnectionDetails | null, stale: boolean, text: SetupText) {
  if (!details) {
    return {
      label: text.stagePending,
      title: text.resultEmpty,
      tone: "border-border/55 bg-background/55 text-muted-foreground",
      icon: Clock3,
    }
  }
  if (stale) {
    return {
      label: text.resultStale,
      title: text.changeInvalidatesTest,
      tone:
        "border-[var(--semantic-warning-border)] bg-[var(--semantic-warning-bg)]/45 text-[var(--semantic-warning-text)]",
      icon: AlertTriangle,
    }
  }
  if (details.overallOk) {
    return {
      label: text.resultFresh,
      title: text.resultSuccess,
      tone:
        "border-[var(--semantic-success-border)] bg-[var(--semantic-success-bg)]/45 text-[var(--semantic-success-text)]",
      icon: CheckCircle2,
    }
  }
  return {
    label: text.resultFresh,
    title: text.resultFailure,
    tone:
      "border-[var(--semantic-error-border)] bg-[var(--semantic-error-bg)]/45 text-[var(--semantic-error-text)]",
    icon: AlertTriangle,
  }
}

function ResultMeta({
  text,
  details,
}: {
  text: SetupText
  details: SetupConnectionDetails | null
}) {
  const methodLabel =
    !details
      ? "-"
      : details.accessMethod === "self_hosted_bot_api"
        ? text.overviewSelfHosted
        : text.overviewOfficial
  const testedAt = details ? new Date(details.testedAt).toLocaleString() : "-"

  return (
    <div className="rounded-[1.6rem] border border-border/55 bg-background/55 p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Waypoints className="h-4 w-4 text-primary" />
        {text.resultTitle}
      </div>
      <div className="mt-4 space-y-3">
        <div className="rounded-[1.2rem] border border-border/50 bg-background/75 px-4 py-3">
          <p className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">{text.overviewAccessMethod}</p>
          <p className="mt-2 text-sm font-medium text-foreground">{methodLabel}</p>
        </div>
        <div className="rounded-[1.2rem] border border-border/50 bg-background/75 px-4 py-3">
          <p className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">{text.resultTestedAt}</p>
          <p className="mt-2 text-sm font-medium text-foreground">{testedAt}</p>
        </div>
        {details?.apiBaseUrl ? (
          <div className="rounded-[1.2rem] border border-border/50 bg-background/75 px-4 py-3">
            <p className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">{text.overviewApiBaseUrl}</p>
            <p className="mt-2 break-all text-sm font-medium text-foreground">{details.apiBaseUrl}</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function SetupStepCard({ item }: { item: StepSummary }) {
  const positive = Boolean(item.ok)
  const Icon = item.icon

  return (
    <div className="rounded-[1.45rem] border border-border/55 bg-background/55 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-[1rem] border border-border/50 bg-background/75">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{item.label}</p>
          <div className="mt-1 flex items-center gap-2 text-xs">
            {positive ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-[var(--semantic-success-text)]" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5 text-[var(--semantic-error-text)]" />
            )}
            <span className={positive ? "text-[var(--semantic-success-text)]" : "text-[var(--semantic-error-text)]"}>
              {positive ? item.okLabel : item.ok === false ? item.failedLabel : "-"}
            </span>
          </div>
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.detail}</p>
    </div>
  )
}

export function SetupResultCard({
  text,
  details,
  stale,
}: {
  text: SetupText
  details: SetupConnectionDetails | null
  stale: boolean
}) {
  const status = readStatus(details, stale, text)
  const StatusIcon = status.icon
  const steps: StepSummary[] = [
    {
      label: text.resultBot,
      ok: details?.bot?.ok,
      detail: describeStep(details, "bot", text.resultPending, text),
      icon: Bot,
      okLabel: text.resultOk,
      failedLabel: text.resultFailed,
    },
    {
      label: text.resultChat,
      ok: details?.chat?.ok,
      detail: describeStep(details, "chat", text.resultPending, text),
      icon: Waypoints,
      okLabel: text.resultOk,
      failedLabel: text.resultFailed,
    },
    {
      label: text.resultAdmin,
      ok: details?.admin?.ok,
      detail: describeStep(details, "admin", text.resultPending, text),
      icon: ShieldCheck,
      okLabel: text.resultOk,
      failedLabel: text.resultFailed,
    },
  ]

  return (
    <div className="glass-card rounded-[2rem] p-6 shadow-[0_24px_80px_var(--shadow-floating-strong)] md:p-7">
      <div className="grid gap-4 xl:grid-cols-[1.18fr_0.82fr]">
        <div className={cn("rounded-[1.7rem] border p-5", status.tone)}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[1.1rem] border border-current/20 bg-background/70">
                <StatusIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-mono text-[11px] tracking-[0.18em] uppercase">{text.resultTitle}</p>
                <h3 className="mt-2 text-lg font-semibold">{status.title}</h3>
              </div>
            </div>
            <Badge variant="outline" className="rounded-full border-current/25 bg-background/65 px-3 py-1 text-[10px] tracking-[0.2em] uppercase">
              {status.label}
            </Badge>
          </div>
          <p className="mt-4 text-sm leading-7">{details?.summary || text.resultPending}</p>
        </div>

        <ResultMeta text={text} details={details} />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {steps.map((item) => (
          <SetupStepCard key={item.label} item={item} />
        ))}
      </div>
    </div>
  )
}
