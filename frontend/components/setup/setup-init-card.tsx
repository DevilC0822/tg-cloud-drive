import { motion } from "framer-motion"
import { KeyRound, ShieldCheck, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  ModeOption,
  SecretInput,
  SectionTitle,
  SetupField,
} from "@/components/setup/setup-form-primitives"
import { SetupResultCard } from "@/components/setup/setup-result-card"
import type { SetupInitFlowState } from "@/hooks/use-setup-init-flow"
import type { SetupText } from "@/lib/setup-i18n"
import { cn } from "@/lib/utils"

function FormHeader({
  text,
  flow,
}: {
  text: SetupText
  flow: SetupInitFlowState
}) {
  const selfHosted = flow.form.accessMethod === "self_hosted_bot_api"
  const statusLabel = !flow.result
    ? text.stagePending
    : flow.resultStale
      ? text.stageRetest
      : flow.result.overallOk
        ? text.stageReady
        : text.stageFailed
  const tone = !flow.result
    ? "border-border/60 bg-background/65 text-muted-foreground"
    : flow.resultStale
      ? "border-[var(--semantic-warning-border)] bg-[var(--semantic-warning-bg)]/45 text-[var(--semantic-warning-text)]"
      : flow.result.overallOk
        ? "border-[var(--semantic-success-border)] bg-[var(--semantic-success-bg)]/45 text-[var(--semantic-success-text)]"
        : "border-[var(--semantic-error-border)] bg-[var(--semantic-error-bg)]/45 text-[var(--semantic-error-text)]"

  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <SectionTitle
        title={text.formTitle}
        detail={text.formDescription}
        icon={
          <div className="rounded-[1rem] border border-primary/20 bg-primary/10 p-3">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
        }
      />
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="rounded-full border-border/60 bg-background/65 px-3 py-1 text-xs">
          {selfHosted ? text.overviewSelfHosted : text.overviewOfficial}
        </Badge>
        <Badge variant="outline" className={cn("rounded-full px-3 py-1 text-xs", tone)}>
          {statusLabel}
        </Badge>
      </div>
    </div>
  )
}

function BasicsSection({
  flow,
  text,
}: {
  flow: SetupInitFlowState
  text: SetupText
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <SetupField label={text.botTokenLabel}>
        <SecretInput
          value={flow.form.tgBotToken}
          placeholder={text.botTokenPlaceholder}
          onChange={(value) => flow.updateField("tgBotToken", value)}
          revealLabel={text.revealSecret}
          hideLabel={text.hideSecret}
        />
      </SetupField>
      <SetupField label={text.chatIdLabel}>
        <Input
          value={flow.form.tgStorageChatId}
          placeholder={text.chatIdPlaceholder}
          onChange={(event) => flow.updateField("tgStorageChatId", event.target.value)}
          className="h-12 rounded-[1rem] border-border/55 bg-background/75"
        />
      </SetupField>
    </div>
  )
}

function SelfHostedSection({
  flow,
  text,
}: {
  flow: SetupInitFlowState
  text: SetupText
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[1.7rem] border border-[var(--tone-document-border)] bg-[linear-gradient(135deg,var(--tone-document-bg)_0%,transparent_100%)] p-5"
    >
      <SectionTitle title={text.sectionSelfHosted} detail={text.selfHostedRequirement} />
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <SetupField label={text.apiIdLabel}>
          <Input
            value={flow.form.tgApiId}
            placeholder={text.apiIdPlaceholder}
            onChange={(event) => flow.updateField("tgApiId", event.target.value)}
            className="h-12 rounded-[1rem] border-border/55 bg-background/75"
          />
        </SetupField>
        <SetupField label={text.apiHashLabel}>
          <SecretInput
            value={flow.form.tgApiHash}
            placeholder={text.apiHashPlaceholder}
            onChange={(value) => flow.updateField("tgApiHash", value)}
            revealLabel={text.revealSecret}
            hideLabel={text.hideSecret}
          />
        </SetupField>
      </div>
      <div className="mt-4">
        <SetupField label={text.apiBaseUrlLabel}>
          <Input
            value={flow.form.tgApiBaseUrl}
            placeholder={text.apiBaseUrlPlaceholder}
            onChange={(event) => flow.updateField("tgApiBaseUrl", event.target.value)}
            className="h-12 rounded-[1rem] border-border/55 bg-background/75"
          />
        </SetupField>
      </div>
    </motion.div>
  )
}

function SetupActionArea({
  flow,
  text,
}: {
  flow: SetupInitFlowState
  text: SetupText
}) {
  const detail = flow.canInitialize
    ? text.testSuccess
    : flow.resultStale
      ? text.changeInvalidatesTest
      : text.retestRequired

  return (
    <div className="rounded-[1.7rem] border border-border/55 bg-background/55 p-5">
      <SectionTitle
        title={text.sectionActions}
        detail={detail}
        icon={
          <div className="rounded-full border border-primary/20 bg-primary/10 p-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
          </div>
        }
      />

      {flow.actionError ? (
        <div className="mt-4 rounded-[1.2rem] border border-[var(--semantic-error-border)] bg-[var(--semantic-error-bg)]/40 px-4 py-3 text-sm text-[var(--semantic-error-text)]">
          {flow.actionError}
        </div>
      ) : null}

      <div className="mt-5 flex flex-col gap-3 md:flex-row">
        <Button
          type="button"
          variant="outline"
          onClick={() => void flow.testConnection()}
          disabled={flow.testing || flow.submitting}
          className="h-12 flex-1 rounded-full"
        >
          {flow.testing ? text.testingAction : text.testAction}
        </Button>
        <Button
          type="button"
          onClick={() => void flow.initialize()}
          disabled={!flow.canInitialize}
          className="h-12 flex-1 rounded-full"
        >
          {flow.submitting ? text.initializingAction : text.initAction}
        </Button>
      </div>
    </div>
  )
}

export function SetupInitCard({
  text,
  flow,
}: {
  text: SetupText
  flow: SetupInitFlowState
}) {
  const selfHosted = flow.form.accessMethod === "self_hosted_bot_api"

  return (
    <motion.section initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
      <div className="glass-card relative overflow-hidden rounded-[2rem] p-6 shadow-[0_30px_100px_var(--shadow-floating-strong)] md:p-7">
        <div className="absolute inset-x-7 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
        <FormHeader text={text} flow={flow} />

        <div className="mt-6 space-y-5">
          <div className="rounded-[1.7rem] border border-border/55 bg-background/55 p-5">
            <SectionTitle title={text.sectionMethod} detail={selfHosted ? text.selfHostedRequirement : text.officialRequirement} />
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <ModeOption
                active={!selfHosted}
                title={text.officialOption}
                description={text.officialHint}
                onClick={() => flow.updateField("accessMethod", "official_bot_api")}
              />
              <ModeOption
                active={selfHosted}
                title={text.selfHostedOption}
                description={text.selfHostedHint}
                onClick={() => flow.updateField("accessMethod", "self_hosted_bot_api")}
              />
            </div>
          </div>

          <div className="rounded-[1.7rem] border border-border/55 bg-background/55 p-5">
            <SectionTitle title={text.sectionBasics} detail={text.stepConfigDescription} />
            <div className="mt-4">
              <BasicsSection flow={flow} text={text} />
            </div>
          </div>

          {selfHosted ? <SelfHostedSection flow={flow} text={text} /> : null}

          <div className="rounded-[1.7rem] border border-border/55 bg-background/55 p-5">
            <SectionTitle
              title={text.sectionSecurity}
              detail={text.adminPasswordHint}
              icon={
                <div className="rounded-full border border-primary/20 bg-primary/10 p-2">
                  <KeyRound className="h-4 w-4 text-primary" />
                </div>
              }
            />
            <div className="mt-4">
              <SetupField label={text.adminPasswordLabel}>
                <SecretInput
                  value={flow.form.adminPassword}
                  placeholder={text.adminPasswordPlaceholder}
                  onChange={(value) => flow.updateField("adminPassword", value)}
                  revealLabel={text.revealSecret}
                  hideLabel={text.hideSecret}
                />
              </SetupField>
            </div>
          </div>

          <SetupActionArea flow={flow} text={text} />
        </div>
      </div>

      <SetupResultCard text={text} details={flow.result} stale={flow.resultStale} />
    </motion.section>
  )
}
