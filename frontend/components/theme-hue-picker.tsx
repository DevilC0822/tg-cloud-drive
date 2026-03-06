import * as SliderPrimitive from "@radix-ui/react-slider"
import { Palette, RotateCcw } from "lucide-react"
import { useI18n } from "@/components/i18n-provider"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useAppTheme } from "@/hooks/use-app-theme"
import { DEFAULT_PRIMARY_HUE } from "@/lib/theme"

type HueCopy = {
  title: string
  hint: string
  reset: string
}

const HUE_COPY: Record<"zh" | "en", HueCopy> = {
  zh: {
    title: "主题色",
    hint: "拖动滑块实时调整整站主色调。",
    reset: "重置默认色相",
  },
  en: {
    title: "Theme Color",
    hint: "Adjust the primary hue for the whole interface in real time.",
    reset: "Reset default hue",
  },
} as const

function HueSlider({
  primaryHue,
  setPrimaryHue,
  title,
}: {
  primaryHue: number
  setPrimaryHue: (value: number) => void
  title: string
}) {
  return (
    <div className="mt-4 rounded-xl bg-secondary/40 px-2 py-3">
      <SliderPrimitive.Root
        min={0}
        max={360}
        step={5}
        value={[primaryHue]}
        onValueChange={([nextHue]) => setPrimaryHue(nextHue)}
        className="relative flex w-full touch-none items-center select-none"
        aria-label={title}
      >
        <SliderPrimitive.Track
          className="relative h-5 grow overflow-hidden rounded-lg"
          style={{
            background:
              "linear-gradient(90deg, oklch(0.78 0.16 0), oklch(0.82 0.16 60), oklch(0.78 0.16 120), oklch(0.78 0.16 180), oklch(0.74 0.16 240), oklch(0.74 0.16 300), oklch(0.78 0.16 360))",
          }}
        />
        <SliderPrimitive.Thumb className="block h-6 w-2 rounded-sm border border-border/80 bg-background shadow-[0_10px_24px_var(--shadow-floating)] transition-transform hover:scale-110 focus:outline-none" />
      </SliderPrimitive.Root>
    </div>
  )
}

function HueContent({
  copy,
  primaryHue,
  setPrimaryHue,
}: {
  copy: HueCopy
  primaryHue: number
  setPrimaryHue: (value: number) => void
}) {
  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-4 w-1 rounded-full bg-primary" />
          <h4 className="text-base font-semibold text-foreground">{copy.title}</h4>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-primary/10 px-2 py-1 font-mono text-sm font-semibold text-primary">
            {primaryHue}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
            onClick={() => setPrimaryHue(DEFAULT_PRIMARY_HUE)}
            aria-label={copy.reset}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <HueSlider primaryHue={primaryHue} setPrimaryHue={setPrimaryHue} title={copy.title} />
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground/80">
        {copy.hint}
      </p>
    </>
  )
}

export function ThemeHuePicker() {
  const { locale } = useI18n()
  const { primaryHue, setPrimaryHue } = useAppTheme()
  const copy = HUE_COPY[locale]

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="group h-9 w-9 rounded-xl bg-secondary/35 transition-colors hover:bg-secondary/60"
          aria-label={copy.title}
        >
          <Palette className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={12}
        className="w-[320px] rounded-2xl border-border/60 bg-background/92 p-5 shadow-2xl backdrop-blur-xl"
      >
        <HueContent copy={copy} primaryHue={primaryHue} setPrimaryHue={setPrimaryHue} />
      </PopoverContent>
    </Popover>
  )
}
