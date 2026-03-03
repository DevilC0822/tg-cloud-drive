import { useAtom, useAtomValue } from 'jotai';
import {
  FolderClosed,
  Settings,
  HardDrive,
  KeyRound,
  ArrowLeftRight,
  X,
  Cloud,
  type LucideIcon,
  Compass,
  Zap,
  Shield,
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { activeNavAtom, mobileSidebarOpenAtom, sidebarOpenAtom } from '@/stores/uiAtoms';
import { ActionIconButton } from '@/components/ui/HeroActionPrimitives';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';
import { gentleSpring, springTransition } from '@/utils/animations';

function cn(...inputs: (string | undefined | null | boolean)[]) {
  return twMerge(clsx(inputs));
}

type SidebarNavId = 'files' | 'transfers' | 'local-storage' | 'settings' | 'vault';

type SidebarNavItem = {
  id: SidebarNavId;
  label: string;
  icon: LucideIcon;
};

type SidebarNavSection = {
  id: string;
  label: string;
  items: SidebarNavItem[];
  sectionIcon: LucideIcon;
};

const navSections: SidebarNavSection[] = [
  {
    id: 'explore',
    label: '浏览',
    sectionIcon: Compass,
    items: [
      { id: 'files', label: '全部文件', icon: FolderClosed },
    ],
  },
  {
    id: 'manage',
    label: '工作流',
    sectionIcon: Zap,
    items: [
      { id: 'transfers', label: '传输中心', icon: ArrowLeftRight },
    ],
  },
  {
    id: 'system',
    label: '安全',
    sectionIcon: Shield,
    items: [
      { id: 'vault', label: '密码箱', icon: KeyRound },
      { id: 'local-storage', label: '本地存储', icon: HardDrive },
      { id: 'settings', label: '系统设置', icon: Settings },
    ],
  },
];

interface NavButtonProps {
  item: SidebarNavItem;
  activeNav: string;
  onClick: (id: SidebarNavId) => void;
}

function NavButton({ item, activeNav, onClick }: NavButtonProps) {
  const Icon = item.icon;
  const isActive = activeNav === item.id;
  
  // 磁吸效果实现
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springConfig = { damping: 20, stiffness: 300 };
  const dx = useSpring(mouseX, springConfig);
  const dy = useSpring(mouseY, springConfig);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - (rect.left + rect.width / 2);
    const y = e.clientY - (rect.top + rect.height / 2);
    mouseX.set(x * 0.15);
    mouseY.set(y * 0.25);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  return (
    <motion.div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ x: dx, y: dy }}
      className="relative"
    >
      <button
        onClick={() => onClick(item.id)}
        className={cn(
          'group relative flex w-full flex-col items-start gap-0.5 overflow-hidden rounded-[1.25rem] px-4 py-3.5 text-left transition-all duration-500',
          isActive
            ? 'text-neutral-900 dark:text-white'
            : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200'
        )}
      >
        {/* 活动状态背景 - 极光感渐变 */}
        <AnimatePresence>
          {isActive && (
            <motion.div
              layoutId="navGlow"
              className="absolute inset-0 z-0 bg-gradient-to-br from-[var(--theme-primary-a12)] via-[var(--theme-primary-a08)] to-transparent dark:from-[var(--theme-primary-a20)] dark:via-[var(--theme-primary-a08)]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            />
          )}
        </AnimatePresence>

        {/* 悬浮微光 */}
        <div className="absolute inset-0 z-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 bg-[radial-gradient(circle_at_var(--mouse-x)_var(--mouse-y),var(--theme-primary-a08),transparent_70%)]" />

        <div className="relative z-10 flex w-full items-center gap-3">
          <div className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-500 shadow-sm",
            isActive 
              ? "bg-white text-[var(--theme-primary-ink)] ring-1 ring-[var(--theme-primary-a24)] dark:bg-neutral-800 dark:ring-white/10" 
              : "bg-neutral-100/50 text-neutral-400 group-hover:bg-white group-hover:text-neutral-600 dark:bg-white/5 dark:group-hover:bg-white/10"
          )}>
            <Icon className={cn("h-4 w-4", isActive && "animate-pulse")} />
          </div>

          <div className="min-w-0 flex-1">
            <span className="block text-[13px] font-bold tracking-tight leading-none uppercase">
              {item.label}
            </span>
          </div>

          {isActive && (
            <motion.div
              layoutId="navIndicator"
              className="h-5 w-1 rounded-full bg-[var(--theme-primary)] shadow-[0_0_12px_var(--theme-primary)]"
              transition={gentleSpring}
            />
          )}
        </div>
      </button>
    </motion.div>
  );
}

export function Sidebar() {
  const [activeNav, setActiveNav] = useAtom(activeNavAtom);
  const sidebarOpen = useAtomValue(sidebarOpenAtom);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useAtom(mobileSidebarOpenAtom);

  const handleNavClick = (id: SidebarNavId) => {
    setActiveNav(id);
    setMobileSidebarOpen(false);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white/60 dark:bg-neutral-900/60">
      {/* 品牌区 - 艺术感处理 */}
      <div className="px-6 pt-8 pb-8">
        <div className="relative group cursor-default">
          <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-tr from-[var(--theme-primary-a12)] to-transparent opacity-0 transition-opacity duration-700 group-hover:opacity-100 blur-xl" />
          <div className="relative flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-[1.25rem] bg-neutral-900 dark:bg-white shadow-2xl transition-transform duration-700 group-hover:rotate-[10deg] group-hover:scale-110">
              <Cloud className="h-6 w-6 text-white dark:text-neutral-900" />
            </div>
            <div className="space-y-0.5">
              <h1 className="text-sm font-black tracking-[0.1em] text-neutral-900 dark:text-white uppercase">
                TG Cloud Drive
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* 导航主列表 */}
      <nav className="flex-1 overflow-y-auto px-4 pb-6 custom-scrollbar" aria-label="主导航">
        <div className="space-y-8">
          {navSections.map((section) => (
            <div key={section.id} className="space-y-3">
              <div className="flex items-center gap-2 px-4">
                <section.sectionIcon className="h-3 w-3 text-neutral-300 dark:text-neutral-600" />
                <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-400/80">
                  {section.label}
                </h2>
              </div>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <NavButton
                    key={item.id}
                    item={item}
                    activeNav={activeNav}
                    onClick={handleNavClick}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </nav>

    </div>
  );

  return (
    <>
      {/* 桌面端：具有艺术气息的悬浮面板 */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -20, opacity: 0 }}
            transition={springTransition}
            className="glass-sidebar hidden h-full w-72 flex-shrink-0 lg:flex flex-col overflow-hidden rounded-3xl"
          >
            {sidebarContent}
          </motion.aside>
        )}
      </AnimatePresence>

      {/* 移动端：全屏沉浸抽屉 */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-neutral-950/40 backdrop-blur-md lg:hidden"
              onClick={() => setMobileSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 z-50 flex w-80 flex-col bg-white dark:bg-neutral-950 shadow-[40px_0_80px_rgba(0,0,0,0.15)] lg:hidden"
            >
              <div className="absolute top-6 right-6 z-10">
                <ActionIconButton
                  icon={<X className="h-5 w-5" />}
                  label="关闭侧边栏"
                  onPress={() => setMobileSidebarOpen(false)}
                  className="rounded-2xl bg-neutral-100 dark:bg-white/5"
                />
              </div>
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
