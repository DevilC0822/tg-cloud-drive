import { motion } from "framer-motion"
import { Activity, AlertTriangle, CheckCircle2, Wifi, WifiOff } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { TransferJobSummary, TransferStreamStatus } from "@/lib/transfers-api"
import type { transferMessages } from "@/lib/i18n"
import { getTransferStreamToneClasses, semanticToneClasses, themeToneClasses } from "@/lib/palette"
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
      title: getTransferStreamToneClasses(status),
      icon: Wifi,
    }
  }
  if (status === "error") {
    return {
      title: getTransferStreamToneClasses(status),
      icon: WifiOff,
    }
  }
  return {
    title: getTransferStreamToneClasses(status),
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
    <motion.div 
      whileHover={{ 
        scale: 1.05,
        y: -4,
      }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className="group relative bg-secondary/35 rounded-3xl p-5 border border-border/50 hover:border-primary/30 hover:bg-secondary/60 transition-all duration-300 cursor-default overflow-hidden shadow-sm hover:shadow-xl hover:shadow-primary/5"
    >
      <div className="flex items-center gap-4 relative z-10">
        <motion.div 
          whileHover={{ rotate: [0, -10, 10, 0], transition: { duration: 0.4 } }}
          className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 transition-colors duration-300", tone)}
        >
          <Icon className="h-6 w-6" />
        </motion.div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground/80">{label}</p>
          <p className="mt-1 text-xl font-bold tracking-tight text-foreground">{value}</p>
        </div>
      </div>
      
      {/* Subtle background glow on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    </motion.div>
  )
}

export function TransferHero({ activeTransfers, historyTransfers, streamStatus, text }: TransferHeroProps) {
  const stream = streamTone(streamStatus)
  const StreamIcon = stream.icon

  return (
    <section className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
      <motion.div 
        whileHover={{ 
          y: -4,
          boxShadow: "0 25px 50px -12px var(--tone-info-glow)"
        }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="glass-card relative overflow-hidden rounded-[32px] border border-border/60 p-6 md:p-8"
      >
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/10 blur-[80px]" />
        <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-accent/5 blur-[80px]" />
        
        <div className="relative">
          <Badge variant="outline" className={cn("rounded-full border px-3.5 py-1 text-xs font-bold uppercase tracking-wider", stream.title)}>
            <StreamIcon className="mr-1.5 h-3.5 w-3.5" />
            {streamLabel(streamStatus, text)}
          </Badge>
          <h1 className="mt-6 text-3xl font-bold tracking-tight text-foreground md:text-5xl">{text.title}</h1>
          <p className="mt-4 max-w-2xl text-[15px] font-medium leading-relaxed text-muted-foreground md:text-lg">{text.subtitle}</p>
        </div>
      </motion.div>

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-1">
        <SummaryCard
          icon={Activity}
          label={text.summaryActive}
          value={text.summaryActiveValue(activeTransfers.length)}
          tone={themeToneClasses.info.badge}
        />
        <SummaryCard
          icon={AlertTriangle}
          label={text.summaryFailed}
          value={text.summaryFailedValue(countTransfersFailed(historyTransfers))}
          tone={semanticToneClasses.error.badge}
        />
        <SummaryCard
          icon={CheckCircle2}
          label={text.summaryCompleted}
          value={text.summaryCompletedValue(countTransfersCompletedLastDay(historyTransfers))}
          tone={semanticToneClasses.success.badge}
        />
      </div>
    </section>
  )
}
