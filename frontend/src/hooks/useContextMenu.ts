import { useCallback, useEffect, useRef } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { contextMenuAtom } from '@/stores/uiAtoms';
import type { FileItem, ContextMenuPosition } from '@/types';

/**
 * 右键菜单 Hook
 */
export function useContextMenu() {
  const [contextMenu, setContextMenu] = useAtom(contextMenuAtom);
  const menuRef = useRef<HTMLDivElement>(null);

  // 显示右键菜单
  const showContextMenu = useCallback(
    (e: React.MouseEvent, file: FileItem | null = null) => {
      e.preventDefault();
      e.stopPropagation();

      // 计算菜单位置，确保不超出视口
      const x = e.clientX;
      const y = e.clientY;

      setContextMenu({
        visible: true,
        position: { x, y },
        targetFile: file,
      });
    },
    [setContextMenu]
  );

  // 隐藏右键菜单
  const hideContextMenu = useCallback(() => {
    setContextMenu({
      visible: false,
      position: { x: 0, y: 0 },
      targetFile: null,
    });
  }, [setContextMenu]);

  // 调整菜单位置以确保在视口内
  const adjustPosition = useCallback((position: ContextMenuPosition, menuElement: HTMLElement) => {
    const { x, y } = position;
    const { innerWidth, innerHeight } = window;
    const { offsetWidth, offsetHeight } = menuElement;

    let adjustedX = x;
    let adjustedY = y;

    // 右边界检查
    if (x + offsetWidth > innerWidth) {
      adjustedX = innerWidth - offsetWidth - 10;
    }

    // 下边界检查
    if (y + offsetHeight > innerHeight) {
      adjustedY = innerHeight - offsetHeight - 10;
    }

    return { x: adjustedX, y: adjustedY };
  }, []);

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        hideContextMenu();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        hideContextMenu();
      }
    };

    if (contextMenu.visible) {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [contextMenu.visible, hideContextMenu]);

  return {
    contextMenu,
    menuRef,
    showContextMenu,
    hideContextMenu,
    adjustPosition,
  };
}

/**
 * 简化版：仅用于触发右键菜单
 */
export function useContextMenuTrigger() {
  const setContextMenu = useSetAtom(contextMenuAtom);

  const trigger = useCallback(
    (e: React.MouseEvent, file: FileItem | null = null) => {
      e.preventDefault();
      e.stopPropagation();

      setContextMenu({
        visible: true,
        position: { x: e.clientX, y: e.clientY },
        targetFile: file,
      });
    },
    [setContextMenu]
  );

  return trigger;
}
