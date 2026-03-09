import { motion } from "framer-motion"
import { Loader2, RefreshCcw, ServerCrash } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SetupShell } from "@/components/setup/setup-shell"
import type { SetupText } from "@/lib/setup-i18n"

interface SetupBootScreenProps {
  text: SetupText
  loading: boolean
  error: string
  onRetry: () => void
}

export function SetupBootScreen(props: SetupBootScreenProps) {
  const icon = props.error ? ServerCrash : Loader2
  const Icon = icon

  return (
    <SetupShell>
      <main className="mx-auto flex min-h-screen max-w-5xl items-center px-4 pb-10 pt-28 md:px-6 md:pt-32">
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card gradient-border w-full rounded-[2rem] border border-border/60 p-8 shadow-[0_28px_90px_var(--shadow-floating-strong)] md:p-10"
        >
          <div className="grid gap-6 md:grid-cols-[0.9fr_1.1fr] md:items-center">
            <div className="rounded-[1.8rem] border border-border/55 bg-background/55 p-6">
              <div className="flex h-[4.75rem] w-[4.75rem] items-center justify-center rounded-[1.5rem] border border-border/60 bg-secondary/40 shadow-[0_0_40px_var(--tone-document-glow)]">
                <Icon className={props.loading ? "h-8 w-8 animate-spin text-primary" : "h-8 w-8 text-[var(--semantic-error-text)]"} />
              </div>
              <p className="mt-5 text-[11px] tracking-[0.28em] text-muted-foreground uppercase">
                {props.text.panelBadge}
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
                {props.error ? props.text.bootErrorTitle : props.text.bootTitle}
              </h1>
            </div>

            <div>
              <p className="text-[11px] tracking-[0.28em] text-muted-foreground uppercase">
                {props.text.checkingStatus}
              </p>
              <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground md:text-base">
                {props.error || props.text.bootDescription}
              </p>
              {!props.loading ? (
                <Button onClick={props.onRetry} className="mt-8 min-w-40 rounded-full">
                  <RefreshCcw className="h-4 w-4" />
                  {props.text.retryStatus}
                </Button>
              ) : null}
            </div>
          </div>
        </motion.section>
      </main>
    </SetupShell>
  )
}
