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
    <div className="flex h-screen overflow-hidden bg-neutral-50 dark:bg-neutral-950">
      {/* 侧边栏 */}
      <Sidebar onNewFolder={onNewFolder} onUpload={onUpload} />

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* 顶部栏 */}
        <Header />

        {/* 内容区域 */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
