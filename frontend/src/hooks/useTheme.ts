import { useEffect, useCallback } from 'react';
import { useAtom } from 'jotai';
import { themeAtom } from '@/stores/uiAtoms';
import type { Theme } from '@/types';

/**
 * 主题切换 Hook
 */
export function useTheme() {
  const [theme, setTheme] = useAtom(themeAtom);

  // 应用主题到 DOM
  const applyTheme = useCallback((newTheme: Theme) => {
    const root = document.documentElement;
    const isDark =
      newTheme === 'dark' ||
      (newTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // 同步浏览器原生控件配色（输入框/滚动条等）
    root.style.colorScheme = isDark ? 'dark' : 'light';
  }, []);

  // 初始化和监听系统主题变化
  useEffect(() => {
    applyTheme(theme);

    // 监听系统主题变化
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') {
        applyTheme('system');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme, applyTheme]);

  // 切换主题
  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next = current === 'light' ? 'dark' : current === 'dark' ? 'system' : 'light';
      applyTheme(next);
      return next;
    });
  }, [setTheme, applyTheme]);

  // 设置特定主题
  const changeTheme = useCallback(
    (newTheme: Theme) => {
      setTheme(newTheme);
      applyTheme(newTheme);
    },
    [setTheme, applyTheme]
  );

  // 获取当前实际主题（解析 system）
  const resolvedTheme = useCallback((): 'light' | 'dark' => {
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return theme;
  }, [theme]);

  return {
    theme,
    toggleTheme,
    changeTheme,
    resolvedTheme,
    isDark: resolvedTheme() === 'dark',
  };
}
