"use client"

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

const featureMetas = [
  {
    icon: Shield,
    color: "cyan" as const,
    gradient: "from-cyan-500/20 to-teal-500/20",
    iconColor: "text-cyan-400",
  },
  {
    icon: Zap,
    color: "orange" as const,
    gradient: "from-orange-500/20 to-amber-500/20",
    iconColor: "text-orange-400",
  },
  {
    icon: Globe,
    color: "pink" as const,
    gradient: "from-pink-500/20 to-rose-500/20",
    iconColor: "text-pink-400",
  },
  {
    icon: Lock,
    color: "cyan" as const,
    gradient: "from-violet-500/20 to-purple-500/20",
    iconColor: "text-violet-400",
  },
  {
    icon: Layers,
    color: "orange" as const,
    gradient: "from-emerald-500/20 to-green-500/20",
    iconColor: "text-emerald-400",
  },
  {
    icon: RefreshCw,
    color: "pink" as const,
    gradient: "from-blue-500/20 to-indigo-500/20",
    iconColor: "text-blue-400",
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
            <span className="bg-gradient-to-r from-primary via-accent to-neon-orange bg-clip-text text-transparent">
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
                glow={featureMeta.color}
                delay={0}
              >
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${featureMeta.gradient} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}>
                  <featureMeta.icon className={`w-7 h-7 ${featureMeta.iconColor}`} />
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
