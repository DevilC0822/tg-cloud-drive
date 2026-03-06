"use client"

import { useEffect, useRef, useState } from "react"
import { useAtom } from "jotai"
import { AnimatePresence, motion } from "framer-motion"
import { Cloud, HardDrive, Languages, Loader2, Menu, RefreshCcw, ServerCog, ShieldCheck, X } from "lucide-react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { ThemeToggle } from "@/components/theme-toggle"
import { useI18n } from "@/components/i18n-provider"
import { useAuth } from "@/hooks/use-auth"
import { useHeaderProfile } from "@/hooks/use-header-profile"
import { formatFileSize } from "@/lib/files"
import { headerMessages, parseLocale } from "@/lib/i18n"
import { mobileMenuOpenAtom } from "@/stores/ui-atoms"

const FADE_DURATION_SECONDS = 0.24
const FADE_OFFSET_Y_PX = 4
const FADE_BLUR_PX = 3
const FADE_EASING: [number, number, number, number] = [0.22, 1, 0.36, 1]
const UNDERLINE_SPRING = { type: "spring", stiffness: 420, damping: 36, mass: 0.42 }

function FadeText({ text }: { text: string }) {
  return (
    <span className="relative inline-grid overflow-hidden">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={text}
          initial={{ opacity: 0, y: FADE_OFFSET_Y_PX, filter: `blur(${FADE_BLUR_PX}px)` }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -FADE_OFFSET_Y_PX, filter: `blur(${FADE_BLUR_PX}px)` }}
          transition={{ duration: FADE_DURATION_SECONDS, ease: FADE_EASING }}
          className="col-start-1 row-start-1 block whitespace-nowrap"
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

interface DesktopNavItemProps {
  href: string
  label: string
  isCurrent: boolean
}

function DesktopNavItem({ href, label, isCurrent }: DesktopNavItemProps) {
  const [isHovered, setIsHovered] = useState(false)
  const labelWrapperRef = useRef<HTMLSpanElement | null>(null)
  const [labelWidth, setLabelWidth] = useState(0)

  useEffect(() => {
    const node = labelWrapperRef.current
    if (!node) return

    const updateWidth = () => {
      setLabelWidth(node.getBoundingClientRect().width)
    }

    updateWidth()
    const observer = new ResizeObserver(updateWidth)
    observer.observe(node)
    return () => observer.disconnect()
  }, [label])

  const targetUnderlineWidth = isCurrent || isHovered ? labelWidth : 0
  const underlineVisible = targetUnderlineWidth > 0

  return (
    <Link
      to={href}
      className="group relative inline-flex min-w-[72px] justify-center"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <motion.span
        className={isCurrent ? "font-medium text-foreground" : "text-muted-foreground transition-colors hover:text-foreground"}
        whileHover={{ y: -2 }}
      >
        <span className="relative inline-flex pb-1">
          <span ref={labelWrapperRef} className="inline-flex">
            <FadeText text={label} />
          </span>
          <motion.span
            className="pointer-events-none absolute bottom-0 left-1/2 h-0.5 -translate-x-1/2 bg-primary"
            animate={{ width: targetUnderlineWidth, opacity: underlineVisible ? 1 : 0 }}
            transition={UNDERLINE_SPRING}
          />
        </span>
      </motion.span>
    </Link>
  )
}

function getServiceLabel(accessMethod: string, text: (typeof headerMessages)["en"]) {
  if (accessMethod === "self_hosted_bot_api") {
    return {
      label: text.serviceSelfHosted,
      Icon: ServerCog,
      className: "border-emerald-300/70 text-emerald-600 dark:text-emerald-300",
    }
  }

  return {
    label: text.serviceOfficial,
    Icon: ShieldCheck,
    className: "border-sky-300/70 text-sky-600 dark:text-sky-300",
  }
}

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useAtom(mobileMenuOpenAtom)
  const [profileOpen, setProfileOpen] = useState(false)
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { locale, setLocale } = useI18n()
  const { authenticated, openLoginDialog, logout } = useAuth()
  const text = headerMessages[locale]

  const { loading, error, storageStats, serviceAccess, fetchProfileData } = useHeaderProfile()

  const navItems = [
    { label: text.dashboard, href: "/" },
    { label: text.files, href: "/files" },
    { label: text.transfers, href: "/transfers" },
    { label: text.settings, href: "/settings" },
  ]

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/"
    return pathname.startsWith(href)
  }

  useEffect(() => {
    if (!profileOpen || !authenticated) return
    void fetchProfileData().catch(() => {})
  }, [authenticated, fetchProfileData, profileOpen])

  const handleAuthAction = () => {
    if (authenticated) {
      void logout()
      return
    }
    openLoginDialog(pathname)
  }

  const openSettings = () => {
    setProfileOpen(false)
    setIsMenuOpen(false)
    navigate("/settings")
  }

  const service = getServiceLabel(serviceAccess.accessMethod, text)
  const storageRows = ["image", "video", "audio", "document", "archive", "code", "other"]
    .map((key) => ({ key, value: storageStats.byType[key as keyof typeof storageStats.byType] }))
    .sort((a, b) => b.value.bytes - a.value.bytes)
    .slice(0, 4)

  return (
    <motion.header initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="fixed left-0 right-0 top-0 z-50">
      <div className="mx-4 mt-4">
        <div className="glass rounded-2xl px-6 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="group flex items-center gap-3">
              <motion.div className="flex items-center gap-3" whileHover={{ scale: 1.05 }}>
                <div className="relative">
                  <div className="absolute inset-0 rounded-xl bg-primary/50 blur-lg transition-colors group-hover:bg-primary/70" />
                  <div className="relative rounded-xl bg-gradient-to-br from-primary to-accent p-2">
                    <Cloud className="h-6 w-6 text-primary-foreground" />
                  </div>
                </div>
                <span className="text-xl font-bold tracking-tight">
                  <span className="text-foreground">NEXUS</span>
                  <span className="text-primary">.</span>
                </span>
              </motion.div>
            </Link>

            <nav className="hidden items-center gap-5 md:flex lg:gap-6">
              {navItems.map((item) => (
                <DesktopNavItem key={item.href} href={item.href} label={item.label} isCurrent={isActive(item.href)} />
              ))}
            </nav>

            <div className="flex items-center gap-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex h-8 w-[92px] items-center justify-center gap-1.5 rounded-full border border-border/60 bg-secondary/60 px-3 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
                    aria-label={text.language}
                  >
                    <Languages className="h-3.5 w-3.5" />
                    <span className="inline-flex w-8 justify-center text-center">
                      <FadeText text={locale === "en" ? "EN" : "中文"} />
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="glass w-40 border-border/50">
                  <DropdownMenuLabel>{text.language}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioGroup value={locale} onValueChange={(value) => setLocale(parseLocale(value))}>
                    <DropdownMenuRadioItem value="en">{text.english}</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="zh">{text.chinese}</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              <ThemeToggle />

              <div className="hidden items-center gap-3 md:flex">
                {authenticated ? (
                  <HoverCard openDelay={120} closeDelay={100} onOpenChange={setProfileOpen}>
                    <HoverCardTrigger asChild>
                      <button className="rounded-full">
                        <Avatar className="h-9 w-9 border border-border/60 bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg shadow-primary/20">
                          <AvatarFallback className="bg-transparent text-sm font-semibold text-primary-foreground">
                            A
                          </AvatarFallback>
                        </Avatar>
                      </button>
                    </HoverCardTrigger>
                    <HoverCardContent align="end" className="glass-card w-[340px] border-border/60 p-0">
                      <div className="border-b border-border/50 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-11 w-11 border border-border/50 bg-gradient-to-br from-primary to-accent text-primary-foreground">
                            <AvatarFallback className="bg-transparent font-semibold text-primary-foreground">A</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">{text.profileRole}</p>
                            <p className="text-xs text-muted-foreground">TG Cloud Drive · {text.profileStatus}</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3 px-4 py-3">
                        <div className="rounded-xl border border-border/60 bg-secondary/30 p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                              <HardDrive className="h-3.5 w-3.5" />
                              {text.profileStats}
                            </p>
                            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : null}
                          </div>
                          <p className="text-lg font-semibold text-foreground">{formatFileSize(storageStats.totalBytes)}</p>
                          <p className="text-xs text-muted-foreground">{storageStats.totalFiles} files</p>

                          <div className="mt-3 space-y-1.5">
                            {storageRows.map((row) => (
                              <div key={row.key} className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">{row.key}</span>
                                <span className="font-medium text-foreground">{formatFileSize(row.value.bytes)}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center justify-between rounded-xl border border-border/60 bg-secondary/30 px-3 py-2.5">
                          <p className="text-xs text-muted-foreground">{text.profileService}</p>
                          <Badge variant="outline" className={service.className}>
                            <service.Icon className="h-3 w-3" />
                            {service.label}
                          </Badge>
                        </div>

                        {error ? <p className="text-xs text-destructive">{error}</p> : null}
                      </div>

                      <div className="flex items-center justify-between border-t border-border/50 px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 gap-1.5 text-xs"
                            onClick={() => void fetchProfileData()}
                          >
                            <RefreshCcw className="h-3.5 w-3.5" />
                            {text.refreshStats}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={openSettings}>
                            {text.settings}
                          </Button>
                        </div>
                        <Button size="sm" className="h-8 text-xs" onClick={() => void logout()}>
                          {text.signOut}
                        </Button>
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                ) : (
                  <Button variant="ghost" className="text-muted-foreground hover:text-foreground" onClick={handleAuthAction}>
                    <span className="inline-flex min-w-[52px] justify-center">
                      <FadeText text={text.signIn} />
                    </span>
                  </Button>
                )}
              </div>

              <button className="p-2 text-foreground md:hidden" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isMenuOpen ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mx-4 mt-2 md:hidden"
          >
            <div className="glass space-y-2.5 rounded-2xl p-6">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className={isActive(item.href) ? "block py-1.5 font-medium text-foreground" : "block py-1.5 text-muted-foreground"}
                  onClick={() => setIsMenuOpen(false)}
                >
                  <FadeText text={item.label} />
                </Link>
              ))}
              <div className="space-y-3 border-t border-border pt-4">
                {authenticated ? (
                  <Button
                    variant="ghost"
                    className="w-full justify-center"
                    onClick={() => {
                      openSettings()
                    }}
                  >
                    {text.settings}
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  className="w-full justify-center"
                  onClick={() => {
                    setIsMenuOpen(false)
                    handleAuthAction()
                  }}
                >
                  {authenticated ? text.signOut : text.signIn}
                </Button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.header>
  )
}
