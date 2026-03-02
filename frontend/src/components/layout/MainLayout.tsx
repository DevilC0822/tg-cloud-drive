import { type ReactNode, useState, useRef, useEffect } from 'react';
import { Upload, FolderPlus, Plus, X } from 'lucide-react';
import { useAtomValue } from 'jotai';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { activeNavAtom } from '@/stores/uiAtoms';

function cn(...inputs: (string | undefined | null | boolean)[]) {
  return twMerge(clsx(inputs));
}

export interface MainLayoutProps {
  children: ReactNode;
  onNewFolder?: () => void;
  onUpload?: () => void;
}

export function MainLayout({ children, onNewFolder, onUpload }: MainLayoutProps) {
  const activeNav = useAtomValue(activeNavAtom);
  const showFab = activeNav === 'files';
  const [fabOpen, setFabOpen] = useState(false);
  const fabRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭 FAB
  useEffect(() => {
    if (!fabOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (fabRef.current && !fabRef.current.contains(e.target as Node)) {
        setFabOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [fabOpen]);

  return (
    <div className="flex h-screen gap-0 overflow-hidden bg-transparent p-0 md:gap-4 md:p-4">
      {/* 侧边栏 */}
      <Sidebar />

      {/* 主内容区 */}
      <div className="flex min-w-0 flex-1 flex-col gap-0 overflow-hidden md:gap-4">
        {/* 顶部栏 */}
        <div className="shrink-0">
          <Header />
        </div>

        {/* 内容区域 */}
        <main className="glass-card relative flex-1 overflow-auto rounded-none md:rounded-3xl">{children}</main>
      </div>

      {/* FAB 悬浮操作按钮（仅文件页显示） */}
      {showFab && (
        <div ref={fabRef} className="fixed right-4 bottom-6 z-30 flex flex-col items-end gap-2">
          {/* 展开的子操作按钮 */}
          <div
            className={cn(
              'flex flex-col items-end gap-2 transition-all duration-200',
              fabOpen ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0',
            )}
          >
            <button
              type="button"
              onClick={() => {
                setFabOpen(false);
                onNewFolder?.();
              }}
              className="flex items-center gap-2 rounded-full border border-neutral-200/80 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 shadow-lg transition-transform active:scale-95 dark:border-neutral-700/80 dark:bg-neutral-800 dark:text-neutral-200"
            >
              <FolderPlus className="h-4 w-4" />
              新建文件夹
            </button>
            <button
              type="button"
              onClick={() => {
                setFabOpen(false);
                onUpload?.();
              }}
              className="flex items-center gap-2 rounded-full border border-[var(--theme-primary-a35)] bg-[var(--theme-primary-a12)] px-4 py-2.5 text-sm font-medium text-[var(--theme-primary-ink)] shadow-lg transition-transform active:scale-95"
            >
              <Upload className="h-4 w-4" />
              上传文件
            </button>
          </div>

          {/* 主 FAB 按钮 */}
          <button
            type="button"
            onClick={() => setFabOpen((v) => !v)}
            className={cn(
              'flex h-14 w-14 items-center justify-center rounded-full border border-[var(--theme-primary-a35)] bg-gradient-to-br from-[var(--theme-primary)] to-[var(--theme-primary-strong)] text-neutral-900 shadow-[0_12px_32px_-8px_rgba(30,41,59,0.55)] transition-transform active:scale-95',
              fabOpen && 'rotate-45',
            )}
            aria-label={fabOpen ? '关闭操作菜单' : '新建'}
          >
            {fabOpen ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
          </button>
        </div>
      )}
    </div>
  );
}
