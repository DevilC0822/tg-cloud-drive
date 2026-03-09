import { motion } from "framer-motion"
import { ArrowRight, Bot, CheckCircle2, ServerCog, ShieldCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { SetupInitFlowState } from "@/hooks/use-setup-init-flow"
import type { SetupText } from "@/lib/setup-i18n"
import { cn } from "@/lib/utils"

interface SetupStepBoardProps {
  text: SetupText
  flow: SetupInitFlowState
}

interface StepItem {
  id: string
  title: string
  description: string
  complete: boolean
  current: boolean
  icon: typeof Bot
}

function hasConfig(flow: SetupInitFlowState) {
  const baseReady =
    flow.form.tgBotToken.trim() &&
    flow.form.tgStorageChatId.trim() &&
    flow.form.adminPassword.trim()
  if (flow.form.accessMethod !== "self_hosted_bot_api") {
    return Boolean(baseReady)
  }
  return Boolean(
    baseReady &&
      flow.form.tgApiId.trim() &&
      flow.form.tgApiHash.trim() &&
      flow.form.tgApiBaseUrl.trim(),
  )
}

function readStageStatus(flow: SetupInitFlowState, text: SetupText) {
  if (!flow.result) {
    return {
      label: text.stagePending,
      tone:
        "border-border/55 bg-background/55 text-muted-foreground",
    }
  }
  if (flow.resultStale) {
    return {
      label: text.stageRetest,
      tone:
        "border-[var(--semantic-warning-border)] bg-[var(--semantic-warning-bg)]/45 text-[var(--semantic-warning-text)]",
    }
  }
  if (flow.result.overallOk) {
    return {
      label: text.stageReady,
      tone:
        "border-[var(--semantic-success-border)] bg-[var(--semantic-success-bg)]/45 text-[var(--semantic-success-text)]",
    }
  }
  return {
    label: text.stageFailed,
    tone:
      "border-[var(--semantic-error-border)] bg-[var(--semantic-error-bg)]/45 text-[var(--semantic-error-text)]",
  }
}

function buildSteps(flow: SetupInitFlowState, text: SetupText): StepItem[] {
  const configReady = hasConfig(flow)
  return [
    {
      id: "01",
      title: text.stepChooseTitle,
      description: text.stepChooseDescription,
      complete: true,
      current: false,
      icon: flow.form.accessMethod === "self_hosted_bot_api" ? ServerCog : Bot,
    },
    {
      id: "02",
      title: text.stepConfigTitle,
      description: text.stepConfigDescription,
      complete: configReady,
      current: !configReady,
      icon: ServerCog,
    },
    {
      id: "03",
      title: text.stepTestTitle,
      description: text.stepTestDescription,
      complete: Boolean(flow.result?.overallOk) && !flow.resultStale,
      current: configReady,
      icon: ShieldCheck,
    },
  ]
}

function StepCard({ item }: { item: StepItem }) {
  const Icon = item.icon

  return (
    <div
      className={cn(
        "rounded-[1.45rem] border p-4 transition-colors",
        item.complete
          ? "border-[var(--semantic-success-border)] bg-[var(--semantic-success-bg)]/35"
          : "border-border/55 bg-background/55",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[1rem] border border-border/50 bg-background/70">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">{item.id}</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{item.title}</p>
          </div>
        </div>
        {item.complete ? (
          <CheckCircle2 className="h-4 w-4 text-[var(--semantic-success-text)]" />
        ) : item.current ? (
          <div className="h-3 w-3 rounded-full bg-primary shadow-[0_0_14px_var(--tone-info-glow)]" />
        ) : null}
      </div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.description}</p>
    </div>
  )
}

export function SetupStepBoard({ text, flow }: SetupStepBoardProps) {
  const selfHosted = flow.form.accessMethod === "self_hosted_bot_api"
  const status = readStageStatus(flow, text)
  const steps = buildSteps(flow, text)
  const requirement = selfHosted ? text.selfHostedRequirement : text.officialRequirement
  const methodLabel = selfHosted ? text.overviewSelfHosted : text.overviewOfficial

  return (
    <motion.aside
      initial={{ opacity: 0, x: -24 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-5 xl:sticky xl:top-28"
    >
      <section className="glass-card gradient-border relative overflow-hidden rounded-[2rem] p-6 md:p-7">
        <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
        <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/10 px-3 py-1 text-[10px] tracking-[0.22em] text-primary uppercase">
          {text.panelBadge}
        </Badge>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-foreground">{text.panelTitle}</h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">{text.panelDescription}</p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <div className="rounded-[1.45rem] border border-border/55 bg-background/60 p-4">
            <p className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">{text.stageMethod}</p>
            <p className="mt-2 text-base font-semibold text-foreground">{methodLabel}</p>
          </div>
          <div className={cn("rounded-[1.45rem] border p-4", status.tone)}>
            <p className="font-mono text-[11px] tracking-[0.18em] uppercase">{text.stageStatus}</p>
            <p className="mt-2 text-base font-semibold">{status.label}</p>
          </div>
        </div>

        <div className="mt-5 rounded-[1.45rem] border border-primary/15 bg-primary/10 p-4 text-sm leading-6 text-muted-foreground">
          {requirement}
        </div>
      </section>

      <section className="glass-card rounded-[2rem] p-5 md:p-6">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <ArrowRight className="h-4 w-4 text-primary" />
          {text.stageTitle}
        </div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{text.stageDescription}</p>
        <p className="mt-4 font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">{text.stageCheckpoints}</p>
        <div className="mt-4 space-y-3">
          {steps.map((item) => (
            <StepCard key={item.id} item={item} />
          ))}
        </div>
      </section>
    </motion.aside>
  )
}
