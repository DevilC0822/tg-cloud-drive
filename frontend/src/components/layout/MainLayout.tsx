import { type ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export interface MainLayoutProps {
  children: ReactNode;
  onNewFolder?: () => void;
  onUpload?: () => void;
}

export function MainLayout({ children, onNewFolder, onUpload }: MainLayoutProps) {
  return (
    <div className="flex h-screen gap-0 overflow-hidden bg-transparent p-0 md:gap-4 md:p-4">
      {/* 侧边栏 */}
      <Sidebar />

      {/* 主内容区 */}
      <div className="flex min-w-0 flex-1 flex-col gap-0 overflow-hidden md:gap-4">
        {/* 顶部栏 */}
        <div className="shrink-0">
          <Header onNewFolder={onNewFolder} onUpload={onUpload} />
        </div>

        {/* 内容区域 */}
        <main className="glass-card relative flex-1 overflow-auto rounded-none md:rounded-3xl">{children}</main>
      </div>
    </div>
  );
}
