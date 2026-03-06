"use client"

import type { ReactNode } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { cn } from "@/lib/utils"
import type { Locale } from "@/lib/i18n"

const FADE_DURATION_SECONDS = 0.24
const FADE_OFFSET_Y_PX = 4
const FADE_BLUR_PX = 3
const FADE_EASING: [number, number, number, number] = [0.22, 1, 0.36, 1]

interface I18nFadeProps {
  locale: Locale
  className?: string
  children: ReactNode
}

export function I18nFade({ locale, className, children }: I18nFadeProps) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={locale}
        initial={{ opacity: 0, y: FADE_OFFSET_Y_PX, filter: `blur(${FADE_BLUR_PX}px)` }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        exit={{ opacity: 0, y: -FADE_OFFSET_Y_PX, filter: `blur(${FADE_BLUR_PX}px)` }}
        transition={{ duration: FADE_DURATION_SECONDS, ease: FADE_EASING }}
        className={cn(className)}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
