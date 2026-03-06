import { motion } from "framer-motion"
import { Check, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GlassCard } from "./glass-card"
import { useI18n } from "@/components/i18n-provider"
import { dashboardMessages } from "@/lib/dashboard-i18n"

export function PricingSection() {
  const { locale } = useI18n()
  const text = dashboardMessages[locale].pricing

  return (
    <section id="pricing" className="relative py-20 px-4">
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

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {text.plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="relative"
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                  <div className="flex items-center gap-1.5 bg-gradient-to-r from-primary to-accent text-primary-foreground text-xs font-semibold px-4 py-1.5 rounded-full shadow-lg shadow-primary/30">
                    <Sparkles className="w-3.5 h-3.5" />
                    {text.popularBadge}
                  </div>
                </div>
              )}
              
              <GlassCard 
                className={`h-full flex flex-col ${plan.popular ? 'border-primary/30 shadow-lg shadow-primary/10' : ''}`}
                glow={plan.popular ? "cyan" : "none"}
                delay={0}
              >
                <div className="mb-6">
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    {plan.name}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {plan.description}
                  </p>
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    {!plan.isCustom && (
                      <span className="text-muted-foreground text-lg">$</span>
                    )}
                    <span className="text-4xl font-bold text-foreground">
                      {plan.price}
                    </span>
                    {!plan.isCustom && (
                      <span className="text-muted-foreground">{text.month}</span>
                    )}
                  </div>
                </div>

                <ul className="space-y-3 mb-8 flex-grow">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <div className="mt-0.5 p-0.5 rounded-full bg-gradient-to-r from-primary to-accent">
                        <Check className="w-3.5 h-3.5 text-primary-foreground" />
                      </div>
                      <span className="text-sm text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button 
                    className={`w-full py-6 ${
                      plan.popular 
                        ? 'bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-lg shadow-primary/30' 
                        : 'bg-secondary/50 text-foreground hover:bg-secondary'
                    }`}
                  >
                    {plan.cta}
                  </Button>
                </motion.div>
              </GlassCard>
            </motion.div>
          ))}
        </div>

        {/* Trust Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="text-center mt-12"
        >
          <p className="text-sm text-muted-foreground">
            {text.trustPrefix} <span className="text-foreground font-semibold">{text.trustCount}</span> {text.trustSuffix}
          </p>
        </motion.div>
      </div>
    </section>
  )
}
