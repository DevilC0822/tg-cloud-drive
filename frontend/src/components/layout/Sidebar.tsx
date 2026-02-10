import { useAtom, useAtomValue } from 'jotai';
import { useEffect, useRef, useState } from 'react';
import {
  FolderClosed,
  Clock,
  Star,
  Trash2,
  Settings,
  KeyRound,
  ArrowLeftRight,
  Plus,
  Upload,
  X,
  Cloud,
  type LucideIcon,
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { activeNavAtom, mobileSidebarOpenAtom, sidebarOpenAtom } from '@/stores/uiAtoms';
import { Button } from '@/components/ui/Button';

function cn(...inputs: (string | undefined | null | boolean)[]) {
  return twMerge(clsx(inputs));
}

type SidebarNavId = 'files' | 'recent' | 'favorites' | 'trash' | 'transfers' | 'settings' | 'vault';

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
    label: '浏览',
    items: [
      { id: 'files', label: '我的文件', subtitle: '目录与文件总览', icon: FolderClosed },
      { id: 'recent', label: '最近访问', subtitle: '最近打开的项目', icon: Clock },
      { id: 'favorites', label: '收藏夹', subtitle: '重点文件快捷访问', icon: Star },
    ],
  },
  {
    id: 'manage',
    label: '管理',
    items: [
      { id: 'transfers', label: '传输中心', subtitle: '上传下载任务与历史', icon: ArrowLeftRight },
      { id: 'trash', label: '回收站', subtitle: '待恢复或彻底删除', icon: Trash2 },
    ],
  },
  {
    id: 'system',
    label: '系统',
    items: [
      { id: 'vault', label: '密码箱', subtitle: '受保护文件空间', icon: KeyRound },
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
    <button
      onClick={() => onClick(item.id)}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'group relative w-full overflow-hidden text-left',
        'rounded-2xl px-3 py-2.5',
        'transition-[background-color,color,box-shadow,transform,filter] duration-[560ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
        'motion-reduce:transition-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]/60',
        'active:scale-[0.99]',
        isActive
          ? 'bg-gradient-to-r from-[#D4AF37]/18 to-[#D4AF37]/8 dark:from-[#D4AF37]/22 dark:to-[#D4AF37]/10 text-neutral-900 dark:text-neutral-100 ring-1 ring-[#D4AF37]/30 dark:ring-[#D4AF37]/40 shadow-sm'
          : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100'
      )}
    >
      {pulseToken !== null ? (
        <span
          key={pulseToken}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-2xl animate-navActivePulse motion-reduce:animate-none z-0"
        />
      ) : null}
      <span
        className={cn(
          'absolute left-1.5 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full origin-center',
          'transition-[opacity,transform,background-color] duration-[560ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
          'motion-reduce:transition-none',
          'z-10',
          isActive
            ? 'bg-[#D4AF37] opacity-100 scale-y-100'
            : 'bg-neutral-300 dark:bg-neutral-600 opacity-0 scale-y-60 group-hover:opacity-40 group-hover:scale-y-80'
        )}
      />
      <span
        className={cn(
          'flex items-center gap-3',
          'relative z-10',
          'transition-transform duration-[560ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
          'motion-reduce:transition-none',
          isActive ? 'translate-x-0.5' : 'translate-x-0 group-hover:translate-x-0.5'
        )}
      >
        <span
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-xl',
            'transition-[background-color,transform] duration-[560ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
            'motion-reduce:transition-none',
            isActive
              ? 'bg-[#D4AF37]/15 scale-100'
              : 'bg-neutral-100 dark:bg-neutral-800 scale-95 group-hover:scale-100'
          )}
        >
          <Icon
            className={cn(
              'h-4 w-4',
              'transition-colors duration-[560ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
              'motion-reduce:transition-none',
              isActive
                ? 'text-[#D4AF37]'
                : 'text-neutral-500 dark:text-neutral-400 group-hover:text-neutral-700 dark:group-hover:text-neutral-200'
            )}
          />
        </span>
        <span className="min-w-0">
          <span
            className={cn(
              'block truncate text-sm font-semibold leading-tight',
              'transition-colors duration-[560ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
              'motion-reduce:transition-none'
            )}
          >
            {item.label}
          </span>
          <span
            className={cn(
              'mt-0.5 block truncate text-xs leading-tight',
              'transition-colors duration-[560ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
              'motion-reduce:transition-none',
              isActive ? 'text-neutral-700/90 dark:text-neutral-300/90' : 'text-neutral-400 dark:text-neutral-500'
            )}
          >
            {item.subtitle}
          </span>
        </span>
      </span>
    </button>
  );
}

export interface SidebarProps {
  onNewFolder?: () => void;
  onUpload?: () => void;
}

export function Sidebar({ onNewFolder, onUpload }: SidebarProps) {
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
      <div className="px-4 pt-5 pb-4">
        <div className="flex items-center gap-3 rounded-2xl border border-neutral-200/70 dark:border-neutral-700/70 bg-white/70 dark:bg-neutral-900/40 px-3 py-3">
          <div className="h-10 w-10 rounded-xl bg-[#D4AF37] flex items-center justify-center">
            <Cloud className="h-5 w-5 text-neutral-900" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate font-semibold text-neutral-900 dark:text-neutral-100">
              TG Cloud
            </h1>
            <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">个人网盘</p>
          </div>
        </div>
        <div className="mt-3 rounded-xl border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-3 py-2 text-xs text-neutral-700 dark:text-neutral-200">
          频道存储已连接，菜单支持多视图快速切换。
        </div>
      </div>

      <div className="px-4">
        <div className="space-y-2 rounded-2xl border border-neutral-200/70 dark:border-neutral-700/70 bg-white/60 dark:bg-neutral-900/35 p-2">
          <Button
            variant="gold"
            fullWidth
            icon={<Upload className="w-4 h-4" />}
            onClick={onUpload}
          >
            上传文件
          </Button>
          <Button
            variant="secondary"
            fullWidth
            icon={<Plus className="w-4 h-4" />}
            onClick={onNewFolder}
            className="dark:bg-neutral-800/90"
          >
            新建文件夹
          </Button>
        </div>
      </div>

      <nav className="mt-4 flex-1 overflow-y-auto px-3 pb-4" aria-label="侧边导航">
        <div className="space-y-5">
          {navSections.map((section) => (
            <section key={section.id} aria-label={section.label}>
              <h2 className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400 dark:text-neutral-500">
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
          'hidden lg:flex flex-col h-screen',
          'w-64 flex-shrink-0',
          'glass-sidebar',
          'transition-all duration-300',
          !sidebarOpen && 'lg:w-0 lg:opacity-0 lg:overflow-hidden'
        )}
      >
        {sidebarContent}
      </aside>

      {/* 移动端侧边栏遮罩 */}
      {mobileSidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* 移动端侧边栏 */}
      <aside
        className={cn(
          'lg:hidden fixed inset-y-0 left-0 z-50',
          'w-72 flex flex-col',
          'glass-sidebar',
          'shadow-2xl',
          'transition-transform duration-300 ease-out',
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* 关闭按钮 */}
        <button
          onClick={() => setMobileSidebarOpen(false)}
          aria-label="关闭侧栏"
          className="absolute top-4 right-4 p-2 rounded-lg bg-white/70 dark:bg-neutral-900/70 hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-200/60 dark:border-neutral-700/70"
        >
          <X className="w-5 h-5 text-neutral-500 dark:text-neutral-400" />
        </button>
        {sidebarContent}
      </aside>
    </>
  );
}
