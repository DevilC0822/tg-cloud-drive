import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/globals.css';
import type { Theme } from './types';

function parseStoredTheme(value: string | null): Theme {
  if (!value) return 'system';

  if (value === 'light' || value === 'dark' || value === 'system') {
    return value;
  }

  try {
    const parsed = JSON.parse(value);
    if (parsed === 'light' || parsed === 'dark' || parsed === 'system') {
      return parsed;
    }
  } catch {
    // 忽略非法存储值，回退到 system
  }

  return 'system';
}

function applyInitialTheme() {
  const root = document.documentElement;
  const storedTheme = parseStoredTheme(window.localStorage.getItem('tg-theme'));
  const isDark =
    storedTheme === 'dark' ||
    (storedTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  root.classList.toggle('dark', isDark);
  root.style.colorScheme = isDark ? 'dark' : 'light';
}

applyInitialTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
