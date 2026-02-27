import { useMemo } from 'react';
import {
  Eye,
  Download,
  Pencil,
  FolderInput,
  Copy,
  Trash2,
  Share2,
  Info,
  Lock,
  LockOpen,
} from 'lucide-react';
import { Dropdown as HeroDropdown, Label as HeroLabel, Separator as HeroSeparator } from '@heroui/react';
import type { FileItem, ContextMenuItem } from '@/types';

const VIEWPORT_PADDING = 12;

type MenuDivider = { divider: true };
type FileMenuItem = ContextMenuItem | MenuDivider;

function isMenuDivider(item: FileMenuItem): item is MenuDivider {
  return 'divider' in item && Boolean(item.divider);
}

function clampMenuPosition(position: { x: number; y: number }) {
  if (typeof window === 'undefined') return position;

  const maxX = Math.max(VIEWPORT_PADDING, window.innerWidth - VIEWPORT_PADDING);
  const maxY = Math.max(VIEWPORT_PADDING, window.innerHeight - VIEWPORT_PADDING);

  return {
    x: Math.min(Math.max(position.x, VIEWPORT_PADDING), maxX),
    y: Math.min(Math.max(position.y, VIEWPORT_PADDING), maxY),
  };
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
  onShare?: (file: FileItem) => void | Promise<void>;
  onUnshare?: (file: FileItem) => void | Promise<void>;
  onDelete?: (file: FileItem) => void | Promise<void>;
  onInfo?: (file: FileItem) => void | Promise<void>;
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
  onShare,
  onUnshare,
  onDelete,
  onInfo,
  onVaultIn,
  onVaultOut,
}: FileContextMenuProps) {
  const safePosition = useMemo(() => clampMenuPosition(position), [position]);

  const menuItems: FileMenuItem[] = useMemo(() => {
    if (!file) return [];

    return [
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
        ? [
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
            } as ContextMenuItem,
          ]
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
    ];
  }, [
    file,
    onClose,
    onCopy,
    onDelete,
    onDownload,
    onInfo,
    onMove,
    onPreview,
    onRename,
    onShare,
    onUnshare,
    onVaultIn,
    onVaultOut,
  ]);

  if (!visible || !file) return null;

  return (
    <HeroDropdown
      key={`${file.id}-${safePosition.x}-${safePosition.y}`}
      isOpen={visible}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <HeroDropdown.Trigger
        aria-label="右键菜单锚点"
        className="pointer-events-none fixed h-px min-h-px w-px min-w-px opacity-0"
        style={{ left: safePosition.x, top: safePosition.y }}
      >
        <span className="sr-only">右键菜单锚点</span>
      </HeroDropdown.Trigger>
      <HeroDropdown.Popover
        placement="bottom start"
        className="min-w-[220px] rounded-2xl border border-white/50 bg-white/40 p-1 shadow-[0_16px_40px_-16px_rgba(15,23,42,0.2)] backdrop-blur-xl dark:border-white/10 dark:bg-black/40 dark:shadow-[0_16px_40px_-16px_rgba(0,0,0,0.5)]"
      >
        <HeroDropdown.Menu
          aria-label="文件右键菜单"
          className="max-h-[70vh] overflow-y-auto"
          onAction={(key) => {
            const id = String(key);
            const target = menuItems.find((item): item is ContextMenuItem => !isMenuDivider(item) && item.id === id);
            target?.onClick?.();
          }}
        >
          {menuItems.map((item, index) => {
            if (isMenuDivider(item)) {
              return <HeroSeparator key={`divider-${index}`} className="my-1 bg-white/30 dark:bg-white/10" />;
            }

            const Icon = item.icon;

            return (
              <HeroDropdown.Item
                key={item.id}
                id={item.id}
                textValue={item.label}
                isDisabled={item.disabled}
                variant={item.danger ? 'danger' : undefined}
              >
                {Icon ? <Icon className="h-4 w-4 text-current" /> : null}
                <HeroLabel>{item.label}</HeroLabel>
                {item.shortcut ? (
                  <span slot="keyboard" className="ms-auto text-[11px] text-neutral-400 dark:text-neutral-500">
                    {item.shortcut}
                  </span>
                ) : null}
              </HeroDropdown.Item>
            );
          })}
        </HeroDropdown.Menu>
      </HeroDropdown.Popover>
    </HeroDropdown>
  );
}
