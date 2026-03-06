import type { LucideIcon } from "lucide-react"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"

interface TransferEmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
}

export function TransferEmptyState({ icon: Icon, title, description }: TransferEmptyStateProps) {
  return (
    <Empty className="glass-card min-h-[220px] rounded-3xl border-border/50">
      <EmptyHeader>
        <EmptyMedia variant="icon" className="rounded-2xl bg-primary/12 text-primary">
          <Icon className="h-5 w-5" />
        </EmptyMedia>
        <EmptyTitle className="text-foreground">{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
