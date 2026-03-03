import { Variants } from 'framer-motion';

/**
 * 统一的弹簧动画配置，提供有质感的物理反馈
 */
export const springTransition = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 30,
};

export const gentleSpring = {
  type: 'spring' as const,
  stiffness: 260,
  damping: 20,
};

/**
 * 基础变体集
 */
export const transitions = {
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.2 },
  },
  
  slideUp: {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 10 },
    transition: springTransition,
  },

  slideInRight: {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 },
    transition: springTransition,
  },

  scaleIn: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
    transition: springTransition,
  },
};

/**
 * 列表容器变体：用于交错动画 (Stagger)
 */
export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.05,
    },
  },
};

/**
 * 按钮/交互反馈
 */
export const tapAnimation = {
  whileTap: { scale: 0.97 },
  whileHover: { scale: 1.01 },
};

