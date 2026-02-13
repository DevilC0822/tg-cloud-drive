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
    <div className="flex h-screen overflow-hidden bg-[linear-gradient(142deg,rgba(255,255,255,0.48),rgba(242,235,226,0.7))] dark:bg-[linear-gradient(142deg,rgba(21,17,15,0.96),rgba(32,25,22,0.95))]">
      {/* 侧边栏 */}
      <Sidebar />

      {/* 主内容区 */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* 顶部栏 */}
        <div className="px-2 pt-2 pb-2 md:px-3 md:pt-3 md:pb-3">
          <Header onNewFolder={onNewFolder} onUpload={onUpload} />
        </div>

        {/* 内容区域 */}
        <main className="flex-1 overflow-auto px-2 pb-2 md:px-3 md:pb-3">{children}</main>
      </div>
    </div>
  );
}
