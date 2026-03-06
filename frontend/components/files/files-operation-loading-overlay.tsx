import { AnimatePresence, motion } from "framer-motion"
import { Loader2 } from "lucide-react"

interface FilesOperationLoadingOverlayProps {
  visible: boolean
  label: string
}

export function FilesOperationLoadingOverlay({ visible, label }: FilesOperationLoadingOverlayProps) {
  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22 }}
          className="pointer-events-none absolute left-1/2 top-4 z-50 -translate-x-1/2"
        >
          <div className="glass flex items-center gap-2 rounded-xl border border-border/55 px-3 py-2 shadow-lg">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-xs font-medium text-foreground">{label}</span>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
