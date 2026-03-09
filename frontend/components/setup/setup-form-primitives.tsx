import { useState, type ReactNode } from "react"
import { Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export function SectionTitle({
  title,
  detail,
  icon,
}: {
  title: string
  detail?: string
  icon?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="font-mono text-[11px] tracking-[0.22em] text-muted-foreground uppercase">{title}</p>
        {detail ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p> : null}
      </div>
      {icon ? <div className="mt-0.5">{icon}</div> : null}
    </div>
  )
}

export function SetupField({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block rounded-[1.45rem] border border-border/55 bg-background/55 p-4">
      <span className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">{label}</span>
      {hint ? <span className="mt-2 block text-sm leading-6 text-muted-foreground">{hint}</span> : null}
      <div className="mt-3">{children}</div>
    </label>
  )
}

export function SecretInput({
  value,
  placeholder,
  onChange,
  revealLabel,
  hideLabel,
}: {
  value: string
  placeholder: string
  onChange: (value: string) => void
  revealLabel: string
  hideLabel: string
}) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <Input
        type={visible ? "text" : "password"}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 rounded-[1rem] border-border/55 bg-background/75 pr-12"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="absolute right-2 top-2 h-8 w-8 rounded-xl"
        onClick={() => setVisible((prev) => !prev)}
        aria-label={visible ? hideLabel : revealLabel}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </Button>
    </div>
  )
}

export function ModeOption({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-[1.5rem] border p-4 text-left transition-all",
        active
          ? "border-primary/30 bg-primary/12 shadow-[0_0_40px_var(--tone-info-glow)]"
          : "border-border/55 bg-background/55 hover:border-primary/20 hover:bg-background/72",
      )}
    >
      <p className="text-base font-semibold text-foreground">{title}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </button>
  )
}
