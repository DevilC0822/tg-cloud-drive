import { useAtomValue } from 'jotai';
import { FolderOpen } from 'lucide-react';
import { viewModeAtom, contextMenuAtom } from '@/stores/uiAtoms';
import { breadcrumbsAtom, sortConfigAtom } from '@/stores/fileAtoms';
import { FileGrid } from './FileGrid';
import { FileList } from './FileList';
import { FileContextMenu } from './FileContextMenu';
import { Breadcrumb } from '@/components/navigation/Breadcrumb';
import { DropZone } from '@/components/upload/DropZone';
import { Pagination } from '@/components/ui/Pagination';
import type { FileItem, SortBy, BreadcrumbItem } from '@/types';

export interface FileBrowserProps {
  files: FileItem[];
  selectedIds: Set<string>;
  onSelect: (fileId: string, multiSelect: boolean) => void;
  onOpen: (file: FileItem) => void;
  onNavigate: (item: BreadcrumbItem) => void;
  onToggleFavorite: (fileId: string) => void | Promise<void>;
  onSort: (by: SortBy) => void;
  onContextMenu: (e: React.MouseEvent, file: FileItem) => void;
  onCloseContextMenu: () => void;
  onPreview: (file: FileItem) => void | Promise<void>;
  onRename: (file: FileItem) => void | Promise<void>;
  onDelete: (file: FileItem) => void | Promise<void>;
  onUpload: (files: FileList | File[]) => void;
  onDownload?: (file: FileItem) => void | Promise<void>;
  onMove?: (file: FileItem) => void | Promise<void>;
  onCopy?: (file: FileItem) => void | Promise<void>;
  onShare?: (file: FileItem) => void | Promise<void>;
  onUnshare?: (file: FileItem) => void | Promise<void>;
  onInfo?: (file: FileItem) => void | Promise<void>;
  onRestore?: (file: FileItem) => void | Promise<void>;
  onDeletePermanently?: (file: FileItem) => void | Promise<void>;
  onVaultIn?: (file: FileItem) => void | Promise<void>;
  onVaultOut?: (file: FileItem) => void | Promise<void>;
  pagination?: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
}

export function FileBrowser({
  files,
  selectedIds,
  onSelect,
  onOpen,
  onNavigate,
  onToggleFavorite,
  onSort,
  onContextMenu,
  onCloseContextMenu,
  onPreview,
  onRename,
  onDelete,
  onUpload,
  onDownload,
  onMove,
  onCopy,
  onShare,
  onUnshare,
  onInfo,
  onRestore,
  onDeletePermanently,
  onVaultIn,
  onVaultOut,
  pagination,
  onPageChange,
  onPageSizeChange,
}: FileBrowserProps) {
  const viewMode = useAtomValue(viewModeAtom);
  const breadcrumbs = useAtomValue(breadcrumbsAtom);
  const sortConfig = useAtomValue(sortConfigAtom);
  const contextMenu = useAtomValue(contextMenuAtom);

  const handleSort = (by: SortBy) => {
    onSort(by);
  };

  return (
    <div className="flex flex-col h-full">
      {/* 面包屑导航 */}
      <div className="px-4 lg:px-6 py-3 border-b border-neutral-200/50 dark:border-neutral-700/50">
        <Breadcrumb items={breadcrumbs} onNavigate={onNavigate} />
      </div>

      {/* 文件区域 */}
      <DropZone onDrop={onUpload} className="flex-1 overflow-auto">
        {files.length === 0 ? (
          /* 空状态 */
          <div className="flex flex-col items-center justify-center h-full py-20">
            <div className="w-20 h-20 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-4">
              <FolderOpen className="w-10 h-10 text-neutral-400 dark:text-neutral-500" />
            </div>
            <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-2">
              文件夹为空
            </h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
              拖拽文件到此处上传，或点击上传按钮
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <FileGrid
            files={files}
            selectedIds={selectedIds}
            onSelect={onSelect}
            onOpen={onOpen}
            onContextMenu={onContextMenu}
          />
        ) : (
          <FileList
            files={files}
            selectedIds={selectedIds}
            sortBy={sortConfig.by}
            sortOrder={sortConfig.order}
            onSelect={onSelect}
            onOpen={onOpen}
            onContextMenu={onContextMenu}
            onSort={handleSort}
          />
        )}
      </DropZone>

      {/* 分页 */}
      {pagination && pagination.totalCount > 0 && pagination.totalPages > 1 && (
        <div className="px-4 lg:px-6 py-3 border-t border-neutral-200/50 dark:border-neutral-700/50 bg-neutral-50/70 dark:bg-neutral-900/30">
          <Pagination
            page={pagination.page}
            pageSize={pagination.pageSize}
            totalCount={pagination.totalCount}
            totalPages={pagination.totalPages}
            onPageChange={(page) => onPageChange?.(page)}
            onPageSizeChange={(size) => onPageSizeChange?.(size)}
          />
        </div>
      )}

      {/* 右键菜单 */}
      <FileContextMenu
        visible={contextMenu.visible}
        position={contextMenu.position}
        file={contextMenu.targetFile}
        onClose={onCloseContextMenu}
        onPreview={onPreview}
        onDownload={onDownload}
        onRename={onRename}
        onMove={onMove}
        onCopy={onCopy}
        onDelete={onDelete}
        onShare={onShare}
        onUnshare={onUnshare}
        onInfo={onInfo}
        onRestore={onRestore}
        onDeletePermanently={onDeletePermanently}
        onVaultIn={onVaultIn}
        onVaultOut={onVaultOut}
        onToggleFavorite={(file) => onToggleFavorite(file.id)}
      />
    </div>
  );
}
