import { Activity, AlertTriangle, CheckCircle2, Wifi, WifiOff } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { TransferJobSummary, TransferStreamStatus } from "@/lib/transfers-api"
import type { transferMessages } from "@/lib/i18n"
import { countTransfersCompletedLastDay, countTransfersFailed } from "@/components/transfers/transfer-presenters"
import { cn } from "@/lib/utils"

interface TransferHeroProps {
  activeTransfers: TransferJobSummary[]
  historyTransfers: TransferJobSummary[]
  streamStatus: TransferStreamStatus
  text: (typeof transferMessages)["en"]
}

function streamTone(status: TransferStreamStatus) {
  if (status === "connected") {
    return {
      title: "border-cyan-400/40 bg-cyan-500/10 text-cyan-100",
      icon: Wifi,
    }
  }
  if (status === "error") {
    return {
      title: "border-rose-400/40 bg-rose-500/10 text-rose-100",
      icon: WifiOff,
    }
  }
  return {
    title: "border-amber-400/40 bg-amber-500/10 text-amber-100",
    icon: Activity,
  }
}

function streamLabel(status: TransferStreamStatus, text: (typeof transferMessages)["en"]) {
  if (status === "connected") return text.streamConnected
  if (status === "error") return text.streamError
  return text.streamReconnecting
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Activity
  label: string
  value: string
  tone: string
}) {
  return (
    <div className="glass-card rounded-[28px] border border-border/60 p-4">
      <div className="flex items-center gap-3">
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl border", tone)}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">{label}</p>
          <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
        </div>
      </div>
    </div>
  )
}

export function TransferHero({ activeTransfers, historyTransfers, streamStatus, text }: TransferHeroProps) {
  const stream = streamTone(streamStatus)
  const StreamIcon = stream.icon

  return (
    <section className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
      <div className="glass-card relative overflow-hidden rounded-[32px] border border-border/60 p-5 md:p-6">
        <div className="absolute inset-y-0 right-0 w-40 bg-[radial-gradient(circle_at_top,rgba(0,255,255,0.2),transparent_65%)]" />
        <div className="relative">
          <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-xs", stream.title)}>
            <StreamIcon className="h-3.5 w-3.5" />
            {streamLabel(streamStatus, text)}
          </Badge>
          <h1 className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight text-foreground md:text-4xl">{text.title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">{text.subtitle}</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-1">
        <SummaryCard
          icon={Activity}
          label={text.summaryActive}
          value={text.summaryActiveValue(activeTransfers.length)}
          tone="border-cyan-400/40 bg-cyan-500/10 text-cyan-300"
        />
        <SummaryCard
          icon={AlertTriangle}
          label={text.summaryFailed}
          value={text.summaryFailedValue(countTransfersFailed(historyTransfers))}
          tone="border-rose-400/40 bg-rose-500/10 text-rose-300"
        />
        <SummaryCard
          icon={CheckCircle2}
          label={text.summaryCompleted}
          value={text.summaryCompletedValue(countTransfersCompletedLastDay(historyTransfers))}
          tone="border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
        />
      </div>
    </section>
  )
}
