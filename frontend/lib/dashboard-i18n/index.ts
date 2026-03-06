import type { Locale } from "@/lib/i18n"
import type { DashboardMessages } from "@/lib/dashboard-i18n/types"
import { dashboardEnMessages } from "@/lib/dashboard-i18n/en"
import { dashboardZhMessages } from "@/lib/dashboard-i18n/zh"

export type { DashboardMessages } from "@/lib/dashboard-i18n/types"

export const dashboardMessages: Record<Locale, DashboardMessages> = {
  en: dashboardEnMessages,
  zh: dashboardZhMessages,
}
