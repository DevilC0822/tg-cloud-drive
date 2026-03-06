import { motion } from "framer-motion"
import { Cloud, Github, Twitter, Linkedin, Mail } from "lucide-react"
import { useI18n } from "@/components/i18n-provider"
import { dashboardMessages } from "@/lib/dashboard-i18n"

const socialLinks = [
  { icon: Twitter, href: "#", label: "Twitter" },
  { icon: Github, href: "#", label: "GitHub" },
  { icon: Linkedin, href: "#", label: "LinkedIn" },
  { icon: Mail, href: "#", label: "Email" },
]

export function Footer() {
  const { locale } = useI18n()
  const text = dashboardMessages[locale].footer
  const footerLinks = [
    text.sections.product,
    text.sections.company,
    text.sections.resources,
    text.sections.legal,
  ]

  return (
    <footer className="relative py-16 px-4 border-t border-border/50">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 mb-12">
          {/* Logo & Description */}
          <div className="col-span-2">
            <motion.a
              href="#"
              className="flex items-center gap-3 group mb-4"
              whileHover={{ scale: 1.05 }}
            >
              <div className="relative">
                <div className="absolute inset-0 bg-primary/50 rounded-xl blur-lg group-hover:bg-primary/70 transition-colors" />
                <div className="relative bg-gradient-to-br from-primary to-accent p-2 rounded-xl">
                  <Cloud className="w-6 h-6 text-primary-foreground" />
                </div>
              </div>
              <span className="text-xl font-bold tracking-tight">
                <span className="text-foreground">NEXUS</span>
                <span className="text-primary">.</span>
              </span>
            </motion.a>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs">
              {text.description}
            </p>
            <div className="flex items-center gap-4">
              {socialLinks.map((social) => (
                <motion.a
                  key={social.label}
                  href={social.href}
                  whileHover={{ scale: 1.1, y: -2 }}
                  className="p-2 rounded-lg bg-secondary/50 text-muted-foreground hover:text-primary hover:bg-secondary transition-colors"
                  aria-label={social.label}
                >
                  <social.icon className="w-4 h-4" />
                </motion.a>
              ))}
            </div>
          </div>

          {/* Links */}
          {footerLinks.map((section) => (
            <div key={section.title}>
              <h3 className="font-semibold text-foreground mb-4">{section.title}</h3>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link}>
                    <motion.a
                      href="#"
                      whileHover={{ x: 4 }}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link}
                    </motion.a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-border/50 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground text-center md:text-left">
            &copy; {new Date().getFullYear()} {text.copyright}
          </p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {text.bottomLinks.privacyPolicy}
            </a>
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {text.bottomLinks.termsOfService}
            </a>
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {text.bottomLinks.cookies}
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
