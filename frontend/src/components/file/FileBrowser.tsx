import { useAtomValue } from 'jotai';
import { Clock3, FolderOpen, HardDrive, Text } from 'lucide-react';
import { viewModeAtom, contextMenuAtom } from '@/stores/uiAtoms';
import { breadcrumbsAtom, sortConfigAtom } from '@/stores/fileAtoms';
import { FileGrid } from './FileGrid';
import { FileList } from './FileList';
import { FileContextMenu } from './FileContextMenu';
import { Breadcrumb } from '@/components/navigation/Breadcrumb';
import { DropZone } from '@/components/upload/DropZone';
import { Pagination } from '@/components/ui/Pagination';
import type { FileItem, SortBy, BreadcrumbItem } from '@/types';
import { ActionIconButton, ActionStatusPill } from '@/components/ui/HeroActionPrimitives';

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
  const selectedCount = selectedIds.size;

  const handleSort = (by: SortBy) => {
    onSort(by);
  };

  return (
    <div className="flex h-full flex-col rounded-3xl border border-neutral-200/85 bg-[linear-gradient(165deg,rgba(255,255,255,0.6),rgba(246,240,232,0.82))] shadow-[0_28px_60px_-44px_rgba(62,47,34,0.65)] dark:border-neutral-700/80 dark:bg-[linear-gradient(165deg,rgba(39,31,27,0.74),rgba(22,18,16,0.8))]">
      {/* 面包屑导航 */}
      <div className="border-b border-neutral-200/75 px-4 py-3 lg:px-6 dark:border-neutral-700/70">
        <Breadcrumb items={breadcrumbs} onNavigate={onNavigate} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200/75 bg-white/40 px-4 py-2.5 lg:px-6 dark:border-neutral-700/70 dark:bg-neutral-900/42">
        <div className="flex flex-wrap items-center gap-1.5">
          <ActionStatusPill tone={selectedCount > 0 ? 'brand' : 'neutral'}>已选 {selectedCount}</ActionStatusPill>
          <ActionStatusPill>共 {files.length} 项</ActionStatusPill>
          <ActionStatusPill tone="warning">{sortConfig.order === 'asc' ? '升序' : '降序'}</ActionStatusPill>
        </div>
        <div className="flex items-center gap-1">
          <ActionIconButton
            icon={<Text className="h-4 w-4" />}
            label="按名称排序"
            tone={sortConfig.by === 'name' ? 'brand' : 'neutral'}
            onPress={() => handleSort('name')}
          />
          <ActionIconButton
            icon={<HardDrive className="h-4 w-4" />}
            label="按大小排序"
            tone={sortConfig.by === 'size' ? 'brand' : 'neutral'}
            onPress={() => handleSort('size')}
          />
          <ActionIconButton
            icon={<Clock3 className="h-4 w-4" />}
            label="按更新时间排序"
            tone={sortConfig.by === 'date' ? 'brand' : 'neutral'}
            onPress={() => handleSort('date')}
          />
        </div>
      </div>

      {/* 文件区域 */}
      <DropZone onDrop={onUpload} className="flex-1 overflow-auto">
        {files.length === 0 ? (
          /* 空状态 */
          <div className="flex h-full flex-col items-center justify-center px-6 py-20 text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-neutral-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.52)] dark:bg-neutral-800">
              <FolderOpen className="h-10 w-10 text-[var(--theme-primary-muted)]" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-neutral-900 dark:text-neutral-100">当前目录暂无文件</h3>
            <p className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
              你可以拖拽文件到此处，或点击左侧“上传文件”开始。
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
        <div className="border-t border-neutral-200/75 bg-white/42 px-4 py-3 lg:px-6 dark:border-neutral-700/70 dark:bg-neutral-900/34">
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
