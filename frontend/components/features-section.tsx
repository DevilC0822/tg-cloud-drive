import { motion } from "framer-motion"
import { 
  Shield, 
  Zap, 
  Globe, 
  Lock, 
  Layers, 
  RefreshCw,
  ChevronRight
} from "lucide-react"
import { GlassCard } from "./glass-card"
import { useI18n } from "@/components/i18n-provider"
import { dashboardMessages } from "@/lib/dashboard-i18n"
import { type GlassGlowTone, themeToneClasses, type ThemeToneName } from "@/lib/palette"
import { cn } from "@/lib/utils"

const featureMetas = [
  {
    icon: Shield,
    glow: "cyan" as GlassGlowTone,
    tone: "info" as ThemeToneName,
  },
  {
    icon: Zap,
    glow: "orange" as GlassGlowTone,
    tone: "archive" as ThemeToneName,
  },
  {
    icon: Globe,
    glow: "pink" as GlassGlowTone,
    tone: "video" as ThemeToneName,
  },
  {
    icon: Lock,
    glow: "cyan" as GlassGlowTone,
    tone: "document" as ThemeToneName,
  },
  {
    icon: Layers,
    glow: "orange" as GlassGlowTone,
    tone: "image" as ThemeToneName,
  },
  {
    icon: RefreshCw,
    glow: "pink" as GlassGlowTone,
    tone: "document" as ThemeToneName,
  },
]

export function FeaturesSection() {
  const { locale } = useI18n()
  const text = dashboardMessages[locale].features

  return (
    <section id="features" className="relative py-20 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-block text-primary text-sm font-semibold tracking-wider uppercase mb-4"
          >
            {text.badge}
          </motion.span>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="text-foreground">{text.titleLead} </span>
            <span className="bg-gradient-to-r from-primary via-[var(--tone-document-text)] to-[var(--tone-archive-text)] bg-clip-text text-transparent">
              {text.titleHighlight}
            </span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {text.subtitle}
          </p>
        </motion.div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {featureMetas.map((featureMeta, index) => {
            const featureText = text.items[index]
            const tone = themeToneClasses[featureMeta.tone]
            if (!featureText) return null
            return (
            <motion.div
              key={featureText.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <GlassCard 
                className="h-full group cursor-pointer" 
                glow={featureMeta.glow}
                delay={0}
              >
                <div
                  className={cn(
                    "mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border bg-gradient-to-br transition-transform duration-300 group-hover:scale-110",
                    tone.border,
                    tone.gradient,
                  )}
                >
                  <featureMeta.icon className={cn("h-7 w-7", tone.text)} />
                </div>
                
                <h3 className="text-xl font-semibold text-foreground mb-3">
                  {featureText.title}
                </h3>
                
                <p className="text-muted-foreground leading-relaxed mb-4">
                  {featureText.description}
                </p>

                <motion.div 
                  className="flex items-center gap-2 text-primary text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                  whileHover={{ x: 5 }}
                >
                  {text.learnMore} <ChevronRight className="w-4 h-4" />
                </motion.div>
              </GlassCard>
            </motion.div>
          )})}
        </div>
      </div>
    </section>
  )
}
