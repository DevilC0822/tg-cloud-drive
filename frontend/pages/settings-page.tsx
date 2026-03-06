import { useState } from "react"
import { AnimatePresence, motion, type Variants } from "framer-motion"
import { Loader2, RefreshCcw, Save, SlidersHorizontal } from "lucide-react"
import { I18nFade } from "@/components/i18n-fade"
import { useI18n } from "@/components/i18n-provider"
import { SettingsTabPanels, SETTINGS_TAB_OPTIONS, tabLabel, type SettingsTab } from "@/components/settings/settings-tab-panels"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSettingsPage } from "@/hooks/use-settings-page"
import { settingsMessages, type SettingsText } from "@/lib/settings-i18n"

interface HeaderProps {
  text: SettingsText
  loading: boolean
  loadError: string
  onReload: () => void
}

function SettingsHeader({ text, loading, loadError, onReload }: HeaderProps) {
  return (
    <section className="glass-card rounded-2xl p-4 md:p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground md:text-2xl">
            <SlidersHorizontal className="h-5 w-5 text-primary" />
            {text.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{text.subtitle}</p>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto">
          <div className="rounded-full border border-border/50 bg-secondary/55 px-3 py-1 text-xs text-muted-foreground">
            {loading ? text.statusLoading : text.statusLoaded}
          </div>
          <Button size="sm" variant="outline" onClick={onReload} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
            {text.reload}
          </Button>
        </div>
      </div>
      {loadError ? <p className="mt-2 text-xs text-destructive">{text.loadFailed}: {loadError}</p> : null}
    </section>
  )
}

interface SaveBarProps {
  text: SettingsText
  activeTab: SettingsTab
  savingRuntime: boolean
  savingService: boolean
  onSaveRuntime: () => void
  onSaveService: () => void
}

const TAB_ORDER: SettingsTab[] = ["transfer", "storage", "sessions", "torrent", "vault", "service"]

const TAB_PANEL_VARIANTS: Variants = {
  initial: (direction: number) => ({ opacity: 0, x: direction >= 0 ? 28 : -28 }),
  animate: { opacity: 1, x: 0 },
  exit: (direction: number) => ({ opacity: 0, x: direction >= 0 ? -28 : 28 }),
}

function SaveBar({ text, activeTab, savingRuntime, savingService, onSaveRuntime, onSaveService }: SaveBarProps) {
  const serviceTab = activeTab === "service"
  const busy = serviceTab ? savingService : savingRuntime
  const saveText = serviceTab ? text.saveService : text.saveRuntime
  const onSave = serviceTab ? onSaveService : onSaveRuntime

  return (
    <div className="flex items-center justify-end gap-2 border-t border-border/60 pt-3">
      <Button onClick={onSave} disabled={busy} className="min-w-[180px]">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {saveText}
      </Button>
    </div>
  )
}

function SettingsView() {
  const { locale } = useI18n()
  const text = settingsMessages[locale]
  const [activeTab, setActiveTab] = useState<SettingsTab>("transfer")
  const [tabDirection, setTabDirection] = useState(1)
  const settings = useSettingsPage(text)
  const handleTabChange = (value: string) => {
    const nextTab = value as SettingsTab
    if (nextTab === activeTab) return
    const currentIndex = TAB_ORDER.indexOf(activeTab)
    const nextIndex = TAB_ORDER.indexOf(nextTab)
    setTabDirection(nextIndex >= currentIndex ? 1 : -1)
    setActiveTab(nextTab)
  }

  return (
    <main className="relative mt-24 px-3 pb-4 md:mt-28 md:px-4 md:pb-5 lg:px-5 lg:pb-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 md:gap-4">
        <I18nFade locale={locale}>
          <SettingsHeader text={text} loading={settings.loading} loadError={settings.loadError} onReload={() => void settings.reload()} />
        </I18nFade>

        <motion.section className="glass-card rounded-2xl p-4 md:p-5">
          <I18nFade locale={locale} className="flex flex-col gap-4">
            <Tabs value={activeTab} onValueChange={handleTabChange}>
              <TabsList className="h-auto w-full flex-wrap gap-1 rounded-xl bg-secondary/60 p-1">
                {SETTINGS_TAB_OPTIONS.map(({ id, icon: Icon }) => (
                  <TabsTrigger key={id} value={id} className="h-8 min-w-[112px] grow gap-1.5 text-xs md:text-sm">
                    <Icon className="h-3.5 w-3.5" />
                    {tabLabel(id, text)}
                  </TabsTrigger>
                ))}
              </TabsList>

              <div className="relative overflow-hidden rounded-xl">
                <AnimatePresence mode="wait" custom={tabDirection} initial={false}>
                  <motion.div
                    key={activeTab}
                    custom={tabDirection}
                    variants={TAB_PANEL_VARIANTS}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                    className="min-h-[280px]"
                  >
                    <SettingsTabPanels
                      activeTab={activeTab}
                      text={text}
                      runtimeSettings={settings.runtimeSettings}
                      runtimeForm={settings.runtimeForm}
                      serviceForm={settings.serviceForm}
                      serviceResult={settings.serviceResult}
                      updateRuntimeForm={settings.updateRuntimeForm}
                      updateServiceForm={settings.updateServiceForm}
                    />
                  </motion.div>
                </AnimatePresence>
              </div>
            </Tabs>

            <SaveBar
              text={text}
              activeTab={activeTab}
              savingRuntime={settings.savingRuntime}
              savingService={settings.savingService}
              onSaveRuntime={() => void settings.saveRuntime()}
              onSaveService={() => void settings.saveService()}
            />
          </I18nFade>
        </motion.section>
      </div>
    </main>
  )
}

export default function SettingsPage() {
  return <SettingsView />
}
