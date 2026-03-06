import { motion } from "framer-motion"
import { ReactNode } from "react"
import { useLocation } from "react-router-dom"

interface PageTransitionProps {
  children: ReactNode
}

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  enter: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
}

export function PageTransition({ children }: PageTransitionProps) {
  const pathname = useLocation().pathname

  return (
    <motion.div
      key={pathname}
      initial="initial"
      animate="enter"
      variants={pageVariants}
      className="flex-1 flex flex-col"
    >
      {children}
    </motion.div>
  )
}
