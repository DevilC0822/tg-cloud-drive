import { useAtom, useAtomValue } from 'jotai';
import { useEffect, useRef, useState } from 'react';
import {
  FolderClosed,
  Settings,
  KeyRound,
  ArrowLeftRight,
  X,
  Cloud,
  ArrowUpRight,
  type LucideIcon,
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { activeNavAtom, mobileSidebarOpenAtom, sidebarOpenAtom } from '@/stores/uiAtoms';
import { ActionIconButton, ActionTextButton } from '@/components/ui/HeroActionPrimitives';

function cn(...inputs: (string | undefined | null | boolean)[]) {
  return twMerge(clsx(inputs));
}

type SidebarNavId = 'files' | 'transfers' | 'settings' | 'vault';

type SidebarNavItem = {
  id: SidebarNavId;
  label: string;
  subtitle: string;
  icon: LucideIcon;
};

type SidebarNavSection = {
  id: string;
  label: string;
  items: SidebarNavItem[];
};

const navSections: SidebarNavSection[] = [
  {
    id: 'explore',
    label: '文件',
    items: [
      { id: 'files', label: '全部文件', subtitle: '按目录浏览文件', icon: FolderClosed },
    ],
  },
  {
    id: 'manage',
    label: '任务',
    items: [
      { id: 'transfers', label: '传输中心', subtitle: '实时任务与历史记录', icon: ArrowLeftRight },
    ],
  },
  {
    id: 'system',
    label: '系统',
    items: [
      { id: 'vault', label: '密码箱', subtitle: '受保护文件区', icon: KeyRound },
      { id: 'settings', label: '设置', subtitle: '运行参数与策略', icon: Settings },
    ],
  },
];

interface NavButtonProps {
  item: SidebarNavItem;
  activeNav: string;
  pulseToken: number | null;
  onClick: (id: SidebarNavId) => void;
}

function NavButton({ item, activeNav, pulseToken, onClick }: NavButtonProps) {
  const Icon = item.icon;
  const isActive = activeNav === item.id;

  return (
    <ActionTextButton
      onPress={() => onClick(item.id)}
      aria-current={isActive ? 'page' : undefined}
      tone="neutral"
      className={cn(
        'group relative w-full overflow-hidden text-left',
        'h-auto min-h-0 justify-start rounded-2xl px-3 py-3',
        'transition-[background-color,color,border-color,box-shadow,transform] duration-[520ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
        'motion-reduce:transition-none',
        'active:scale-[0.99]',
        isActive
          ? 'border border-[var(--theme-primary-a35)] bg-[linear-gradient(132deg,var(--theme-primary-a24),var(--theme-primary-a08))] text-neutral-900 shadow-[0_14px_28px_-20px_rgba(30,41,59,0.45)] dark:border-neutral-700 dark:bg-neutral-800/86 dark:text-neutral-100'
          : 'border border-transparent text-neutral-600 hover:border-neutral-200/85 hover:bg-white/70 hover:text-neutral-900 dark:text-neutral-300 dark:hover:border-neutral-700/85 dark:hover:bg-neutral-800/74 dark:hover:text-neutral-100',
      )}
    >
      {pulseToken !== null ? (
        <span
          key={pulseToken}
          aria-hidden="true"
          className="animate-navActivePulse pointer-events-none absolute inset-0 z-0 rounded-2xl motion-reduce:animate-none"
        />
      ) : null}
      <span
        aria-hidden="true"
        className={cn(
          'absolute inset-x-3 top-0 h-px transition-colors duration-300',
          isActive
            ? 'bg-[var(--theme-primary-a55)]'
            : 'bg-transparent group-hover:bg-neutral-200 dark:group-hover:bg-neutral-700',
        )}
      />
      <span
        className={cn(
          'absolute top-1/2 left-1.5 h-7 w-1 origin-center -translate-y-1/2 rounded-full',
          'transition-[opacity,transform,background-color] duration-[560ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
          'motion-reduce:transition-none',
          'z-10',
          isActive
            ? 'scale-y-100 bg-[var(--theme-primary)] opacity-100'
            : 'scale-y-60 bg-neutral-300 opacity-0 group-hover:scale-y-80 group-hover:opacity-40 dark:bg-neutral-600',
        )}
      />
      <span
        className={cn(
          'flex items-center gap-3.5',
          'relative z-10',
          'transition-transform duration-[560ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
          'motion-reduce:transition-none',
          isActive ? 'translate-x-0.5' : 'translate-x-0 group-hover:translate-x-0.5',
        )}
      >
        <span
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-xl border',
            'transition-[background-color,transform] duration-[560ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
            'motion-reduce:transition-none',
            isActive
              ? 'scale-100 border-[var(--theme-primary-a35)] bg-[var(--theme-primary-a20)]'
              : 'scale-95 border-neutral-200/85 bg-neutral-100 group-hover:scale-100 dark:border-neutral-700/80 dark:bg-neutral-800',
          )}
        >
          <Icon
            className={cn(
              'h-4 w-4',
              'transition-colors duration-[560ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
              'motion-reduce:transition-none',
              isActive
                ? 'text-[var(--theme-primary-ink)]'
                : 'text-neutral-500 group-hover:text-neutral-700 dark:text-neutral-400 dark:group-hover:text-neutral-200',
            )}
          />
        </span>
        <span className="min-w-0">
          <span
            className={cn(
              'block truncate text-sm leading-tight font-semibold',
              'transition-colors duration-[560ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
              'motion-reduce:transition-none',
              isActive ? 'text-neutral-900 dark:text-neutral-100' : 'text-neutral-700 dark:text-neutral-200',
            )}
          >
            {item.label}
          </span>
          <span
            className={cn(
              'mt-0.5 block truncate text-xs leading-tight',
              'transition-colors duration-[560ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
              'motion-reduce:transition-none',
              isActive ? 'text-neutral-700/90 dark:text-neutral-300/90' : 'text-neutral-400 dark:text-neutral-500',
            )}
          >
            {item.subtitle}
          </span>
        </span>
        <ArrowUpRight
          className={cn(
            'ml-auto h-3.5 w-3.5 shrink-0 transition-all duration-300',
            isActive
              ? 'text-[var(--theme-primary-ink)] opacity-100'
              : '-translate-x-1 text-neutral-400 opacity-0 group-hover:translate-x-0 group-hover:opacity-90 dark:text-neutral-500',
          )}
        />
      </span>
    </ActionTextButton>
  );
}

export function Sidebar() {
  const [activeNav, setActiveNav] = useAtom(activeNavAtom);
  const sidebarOpen = useAtomValue(sidebarOpenAtom);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useAtom(mobileSidebarOpenAtom);
  const [pulseState, setPulseState] = useState<{ id: SidebarNavId; token: number } | null>(null);
  const pulseTokenRef = useRef(0);
  const pulseTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pulseTimerRef.current !== null) {
        window.clearTimeout(pulseTimerRef.current);
        pulseTimerRef.current = null;
      }
    };
  }, []);

  const handleNavClick = (id: SidebarNavId) => {
    setActiveNav(id);

    pulseTokenRef.current += 1;
    setPulseState({ id, token: pulseTokenRef.current });

    if (pulseTimerRef.current !== null) {
      window.clearTimeout(pulseTimerRef.current);
    }
    pulseTimerRef.current = window.setTimeout(() => {
      setPulseState(null);
      pulseTimerRef.current = null;
    }, 320);
    setMobileSidebarOpen(false);
  };

  const sidebarContent = (
    <>
      <div className="px-4 pt-5 pb-3">
        <div className="relative overflow-hidden rounded-2xl border border-[var(--theme-primary-a24)] bg-[linear-gradient(138deg,var(--theme-primary-a24),var(--theme-primary-a08))] px-3 py-3 shadow-[0_12px_28px_-20px_rgba(30,41,59,0.42)]">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -top-8 -right-8 h-20 w-20 rounded-full bg-[var(--theme-primary-a24)] blur-xl"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-10 -left-10 h-24 w-24 rounded-full bg-white/30 blur-2xl dark:bg-neutral-800/30"
          />

          <div className="relative flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--theme-primary-a35)] bg-gradient-to-br from-[var(--theme-primary-soft)] to-[var(--theme-primary-strong)] shadow-[0_10px_20px_-16px_rgba(30,41,59,0.55)]">
              <Cloud className="h-5 w-5 text-neutral-900" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold tracking-[0.02em] text-neutral-900 dark:text-neutral-100">
                Telegram 云盘
              </h1>
              <p className="truncate text-[11px] text-neutral-600 dark:text-neutral-300">TG Cloud Drive</p>
            </div>
          </div>
        </div>
        <div className="px-1 pt-3">
          <div className="h-px bg-gradient-to-r from-[var(--theme-primary-a35)] via-[var(--theme-primary-a08)] to-transparent" />
        </div>
      </div>

      <nav className="mt-2 flex-1 overflow-y-auto px-3 pb-[max(1rem,env(safe-area-inset-bottom))]" aria-label="侧边导航">
        <div className="space-y-4">
          {navSections.map((section) => (
            <section key={section.id} aria-label={section.label}>
              <h2 className="mb-2 px-3 text-[11px] font-semibold tracking-[0.14em] text-neutral-500/90 uppercase dark:text-neutral-400/90">
                {section.label}
              </h2>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <NavButton
                    key={item.id}
                    item={item}
                    activeNav={activeNav}
                    pulseToken={pulseState?.id === item.id ? pulseState.token : null}
                    onClick={handleNavClick}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </nav>
    </>
  );

  return (
    <>
      {/* 桌面端侧边栏 */}
      <aside
        className={cn(
          'hidden h-full flex-col overflow-hidden rounded-3xl lg:flex',
          'w-64 flex-shrink-0',
          'glass-sidebar',
          'transition-all duration-300',
          !sidebarOpen && 'lg:w-0 lg:overflow-hidden lg:opacity-0',
        )}
      >
        {sidebarContent}
      </aside>

      {/* 移动端侧边栏遮罩 */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-neutral-950/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* 移动端侧边栏 */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 lg:hidden',
          'flex w-72 flex-col',
          'glass-sidebar',
          'shadow-2xl',
          'transition-transform duration-300 ease-out',
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* 关闭按钮 */}
        <ActionIconButton
          icon={<X className="h-5 w-5" />}
          label="关闭侧栏"
          onPress={() => setMobileSidebarOpen(false)}
          className="absolute top-4 right-4 border border-neutral-200/75 bg-white/62 dark:border-neutral-700/80 dark:bg-neutral-900/72"
        />
        {sidebarContent}
      </aside>
    </>
  );
}
