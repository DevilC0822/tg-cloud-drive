import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { gentleSpring } from '@/utils/animations';

function cn(...inputs: (string | undefined | null | boolean)[]) {
  return twMerge(clsx(inputs));
}

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  icon?: ReactNode;
  badge?: string | number;
}

export interface TabsProps<T extends string = string> {
  tabs: TabItem<T>[];
  activeTab: T;
  onChange: (id: T) => void;
  className?: string;
  /** 用于 framer-motion layoutId，确保同一页面多个 Tabs 不冲突 */
  layoutId?: string;
  size?: 'sm' | 'md';
}

/**
 * 全局统一的高性能动画 Tabs 组件
 * 具有物理感应的滑动背景和顺滑的状态过渡
 */
export function Tabs<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  className,
  layoutId = 'activeTab',
  size = 'md',
}: TabsProps<T>) {
  return (
    <div
      className={cn(
        'relative flex items-center gap-1 overflow-x-auto overflow-y-hidden rounded-xl border border-neutral-200/60 bg-neutral-50/50 p-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:thin] [scrollbar-color:var(--theme-primary-a35)_transparent] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[var(--theme-primary-a24)] hover:[&::-webkit-scrollbar-thumb]:bg-[var(--theme-primary-a35)] dark:border-white/5 dark:bg-white/5',
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative z-10 flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-4 font-bold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary-a55)]',
              size === 'sm' ? 'h-8 text-[10px] uppercase tracking-wider' : 'h-9 text-xs',
              isActive
                ? 'text-neutral-950 dark:text-white'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-300'
            )}
          >
            {isActive && (
              <motion.div
                layoutId={layoutId}
                className="absolute inset-0 bg-white shadow-sm ring-1 ring-neutral-200/50 dark:bg-neutral-800 dark:ring-white/10 rounded-lg -z-10"
                transition={gentleSpring}
              />
            )}
            
            {tab.icon && <span className="shrink-0">{tab.icon}</span>}
            <span>{tab.label}</span>
            
            {tab.badge !== undefined && (
              <span className={cn(
                'font-mono opacity-50',
                isActive ? 'opacity-60' : 'opacity-40'
              )}>
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
