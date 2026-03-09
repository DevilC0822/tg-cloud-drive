import { useI18n } from "@/components/i18n-provider"
import { SetupInitCard } from "@/components/setup/setup-init-card"
import { SetupShell } from "@/components/setup/setup-shell"
import { SetupStepBoard } from "@/components/setup/setup-step-board"
import { useSetupInitFlow } from "@/hooks/use-setup-init-flow"
import { setupMessages } from "@/lib/setup-i18n"

interface SetupInitViewProps {
  markInitialized: () => void
  refreshStatus: () => Promise<unknown>
}

export function SetupInitView(props: SetupInitViewProps) {
  const { locale } = useI18n()
  const text = setupMessages[locale]
  const flow = useSetupInitFlow({
    text,
    markInitialized: props.markInitialized,
    refreshStatus: props.refreshStatus,
  })

  return (
    <SetupShell>
      <main className="mx-auto max-w-6xl px-4 pb-10 pt-28 md:px-6 md:pb-12 md:pt-32">
        <div className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr] xl:items-start">
          <SetupStepBoard text={text} flow={flow} />
          <SetupInitCard text={text} flow={flow} />
        </div>
      </main>
    </SetupShell>
  )
}
