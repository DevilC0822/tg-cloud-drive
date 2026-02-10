import { useEffect, useRef } from 'react';
import {
  Eye,
  Download,
  Pencil,
  FolderInput,
  Copy,
  Star,
  Trash2,
  Share2,
  Info,
  RotateCcw,
  Lock,
  LockOpen,
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { FileItem, ContextMenuItem } from '@/types';

function cn(...inputs: (string | undefined | null | boolean)[]) {
  return twMerge(clsx(inputs));
}

export interface FileContextMenuProps {
  visible: boolean;
  position: { x: number; y: number };
  file: FileItem | null;
  onClose: () => void;
  onPreview?: (file: FileItem) => void | Promise<void>;
  onDownload?: (file: FileItem) => void | Promise<void>;
  onRename?: (file: FileItem) => void | Promise<void>;
  onMove?: (file: FileItem) => void | Promise<void>;
  onCopy?: (file: FileItem) => void | Promise<void>;
  onToggleFavorite?: (file: FileItem) => void | Promise<void>;
  onShare?: (file: FileItem) => void | Promise<void>;
  onUnshare?: (file: FileItem) => void | Promise<void>;
  onDelete?: (file: FileItem) => void | Promise<void>;
  onInfo?: (file: FileItem) => void | Promise<void>;
  onRestore?: (file: FileItem) => void | Promise<void>;
  onDeletePermanently?: (file: FileItem) => void | Promise<void>;
  onVaultIn?: (file: FileItem) => void | Promise<void>;
  onVaultOut?: (file: FileItem) => void | Promise<void>;
}

export function FileContextMenu({
  visible,
  position,
  file,
  onClose,
  onPreview,
  onDownload,
  onRename,
  onMove,
  onCopy,
  onToggleFavorite,
  onShare,
  onUnshare,
  onDelete,
  onInfo,
  onRestore,
  onDeletePermanently,
  onVaultIn,
  onVaultOut,
}: FileContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // 调整位置确保在视口内
  useEffect(() => {
    if (visible && menuRef.current) {
      const menu = menuRef.current;
      const rect = menu.getBoundingClientRect();
      const { innerWidth, innerHeight } = window;

      let x = position.x;
      let y = position.y;

      if (x + rect.width > innerWidth) {
        x = innerWidth - rect.width - 10;
      }
      if (y + rect.height > innerHeight) {
        y = innerHeight - rect.height - 10;
      }

      menu.style.left = `${x}px`;
      menu.style.top = `${y}px`;
    }
  }, [visible, position]);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (visible) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [visible, onClose]);

  if (!visible || !file) return null;

  const menuItems: (ContextMenuItem | { divider: true })[] = file.trashedAt
    ? [
        {
          id: 'restore',
          label: '还原',
          icon: RotateCcw,
          onClick: () => {
            onRestore?.(file);
            onClose();
          },
        },
        { divider: true },
        {
          id: 'preview',
          label: file.type === 'folder' ? '打开' : '预览',
          icon: Eye,
          onClick: () => {
            onPreview?.(file);
            onClose();
          },
        },
        {
          id: 'download',
          label: '下载',
          icon: Download,
          disabled: file.type === 'folder',
          onClick: () => {
            onDownload?.(file);
            onClose();
          },
        },
        { divider: true },
        {
          id: 'info',
          label: '详细信息',
          icon: Info,
          onClick: () => {
            onInfo?.(file);
            onClose();
          },
        },
        { divider: true },
        {
          id: 'delete-permanent',
          label: '永久删除',
          icon: Trash2,
          danger: true,
          shortcut: 'Del',
          onClick: () => {
            onDeletePermanently?.(file);
            onClose();
          },
        },
      ]
    : [
        {
          id: 'preview',
          label: file.type === 'folder' ? '打开' : '预览',
          icon: Eye,
          onClick: () => {
            onPreview?.(file);
            onClose();
          },
        },
        {
          id: 'download',
          label: '下载',
          icon: Download,
          disabled: file.type === 'folder',
          onClick: () => {
            onDownload?.(file);
            onClose();
          },
        },
        {
          id: 'share',
          label: file.isShared ? '复制分享链接' : '创建分享链接',
          icon: Share2,
          disabled: file.type === 'folder',
          onClick: () => {
            onShare?.(file);
            onClose();
          },
        },
        ...(file.isShared
          ? ([
              {
                id: 'unshare',
                label: '取消分享',
                icon: Share2,
                danger: true,
                disabled: file.type === 'folder',
                onClick: () => {
                  onUnshare?.(file);
                  onClose();
                },
              },
            ] as const)
          : []),
        { divider: true },
        {
          id: 'rename',
          label: '重命名',
          icon: Pencil,
          shortcut: 'F2',
          onClick: () => {
            onRename?.(file);
            onClose();
          },
        },
        {
          id: 'move',
          label: '移动到',
          icon: FolderInput,
          onClick: () => {
            onMove?.(file);
            onClose();
          },
        },
        {
          id: 'copy',
          label: '复制',
          icon: Copy,
          shortcut: '⌘C',
          onClick: () => {
            onCopy?.(file);
            onClose();
          },
        },
        { divider: true },
        {
          id: 'favorite',
          label: file.isFavorite ? '取消收藏' : '添加收藏',
          icon: Star,
          onClick: () => {
            onToggleFavorite?.(file);
            onClose();
          },
        },
        {
          id: file.isVaulted ? 'vault-out' : 'vault-in',
          label: file.isVaulted ? '移出密码箱' : '移入密码箱',
          icon: file.isVaulted ? LockOpen : Lock,
          disabled: file.type === 'folder',
          onClick: () => {
            if (file.isVaulted) {
              onVaultOut?.(file);
            } else {
              onVaultIn?.(file);
            }
            onClose();
          },
        },
        { divider: true },
        {
          id: 'info',
          label: '详细信息',
          icon: Info,
          onClick: () => {
            onInfo?.(file);
            onClose();
          },
        },
        { divider: true },
        {
          id: 'delete',
          label: '删除',
          icon: Trash2,
          danger: true,
          shortcut: 'Del',
          onClick: () => {
            onDelete?.(file);
            onClose();
          },
        },
        {
          id: 'delete-permanent-direct',
          label: '彻底删除',
          icon: Trash2,
          danger: true,
          shortcut: 'Shift+Del',
          onClick: () => {
            onDeletePermanently?.(file);
            onClose();
          },
        },
      ];

  return (
    <div
      ref={menuRef}
      className={cn(
        'fixed z-50 min-w-[200px] py-1',
        'bg-white dark:bg-neutral-800',
        'rounded-xl shadow-xl',
        'border border-neutral-200 dark:border-neutral-700',
        'animate-scaleIn origin-top-left'
      )}
      style={{ left: position.x, top: position.y }}
    >
      {menuItems.map((item, index) => {
        if ('divider' in item && item.divider) {
          return (
            <div
              key={`divider-${index}`}
              className="my-1 border-t border-neutral-200 dark:border-neutral-700"
            />
          );
        }

        const menuItem = item as ContextMenuItem;
        const Icon = menuItem.icon;

        return (
          <button
            key={menuItem.id}
            onClick={menuItem.onClick}
            disabled={menuItem.disabled}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 text-sm',
              'transition-colors duration-150',
              menuItem.disabled
                ? 'opacity-50 cursor-not-allowed'
                : menuItem.danger
                ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700'
            )}
          >
            {Icon && <Icon className="w-4 h-4" />}
            <span className="flex-1 text-left">{menuItem.label}</span>
            {menuItem.shortcut && (
              <span className="text-xs text-neutral-400 dark:text-neutral-500">{menuItem.shortcut}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
