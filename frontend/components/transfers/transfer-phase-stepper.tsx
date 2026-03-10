import { Check } from "lucide-react"
import type { TransferJobStatus } from "@/lib/transfers-api"
import type { transferMessages } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { getTransferPhaseDetailLabel } from "@/components/transfers/transfer-presenters"

interface TransferPhaseStepperProps {
  steps?: string[] | null
  currentStep?: string | null
  status: TransferJobStatus
  text: (typeof transferMessages)["en"]
  compact?: boolean
}

function resolveStepState(
  steps: string[],
  currentStep: string | null | undefined,
  status: TransferJobStatus,
  step: string,
) {
  const currentIndex = currentStep ? steps.indexOf(currentStep) : -1
  const stepIndex = steps.indexOf(step)
  if (status === "completed") {
    return "completed"
  }
  if ((status === "error" || status === "canceled") && currentIndex >= 0) {
    if (stepIndex < currentIndex) return "completed"
    if (stepIndex === currentIndex) return "error"
    return "pending"
  }
  if (currentIndex >= 0) {
    if (stepIndex < currentIndex) return "completed"
    if (stepIndex === currentIndex) return "current"
  }
  return "pending"
}

function getStepTone(state: string) {
  if (state === "completed") {
    return {
      dot: "border-emerald-500 bg-emerald-500 text-white",
      label: "text-foreground",
      line: "bg-emerald-500/70",
    }
  }
  if (state === "current") {
    return {
      dot: "border-primary bg-primary text-primary-foreground shadow-[0_0_0_4px_rgba(59,130,246,0.12)]",
      label: "text-foreground",
      line: "bg-primary/35",
    }
  }
  if (state === "error") {
    return {
      dot: "border-destructive bg-destructive text-destructive-foreground",
      label: "text-destructive",
      line: "bg-border/60",
    }
  }
  return {
    dot: "border-border/70 bg-background/80 text-muted-foreground",
    label: "text-muted-foreground",
    line: "bg-border/60",
  }
}

export function TransferPhaseStepper({
  steps,
  currentStep,
  status,
  text,
  compact = false,
}: TransferPhaseStepperProps) {
  if (!steps || steps.length < 2) {
    return null
  }

  return (
    <div className={cn("grid gap-2", compact ? "grid-cols-2" : "grid-cols-2 md:grid-cols-4")}>
      {steps.map((step, index) => {
        const state = resolveStepState(steps, currentStep, status, step)
        const tone = getStepTone(state)
        const label = getTransferPhaseDetailLabel(step, text) || step
        const showConnector = index < steps.length - 1

        return (
          <div key={step} className="relative flex items-start gap-3 rounded-2xl border border-border/50 bg-background/35 px-3 py-2.5">
            <div className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold", tone.dot)}>
              {state === "completed" ? <Check className="h-3.5 w-3.5" /> : index + 1}
            </div>
            <div className="min-w-0">
              <p className={cn("text-xs font-semibold leading-5", tone.label)}>{label}</p>
            </div>
            {showConnector ? (
              <span
                className={cn(
                  "pointer-events-none absolute right-[-10px] top-1/2 hidden h-0.5 w-5 -translate-y-1/2 rounded-full md:block",
                  tone.line,
                )}
              />
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
