import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'system';

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'system';
    return (localStorage.getItem('synapse_theme') as Theme) || 'system';
  });

  const [resolvedDark, setResolvedDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const saved = localStorage.getItem('synapse_theme') as Theme | null;
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    const apply = (isDark: boolean) => {
      setResolvedDark(isDark);
      if (isDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    if (theme === 'system') {
      apply(media.matches);
      localStorage.removeItem('synapse_theme');
    } else {
      apply(theme === 'dark');
      localStorage.setItem('synapse_theme', theme);
    }

    const handler = (e: MediaQueryListEvent) => {
      if (theme === 'system') {
        apply(e.matches);
      }
    };

    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, [theme]);

  const toggleTheme = () => {
    setThemeState((current) => (resolvedDark ? 'light' : 'dark'));
  };

  return { theme, setTheme: setThemeState, isDark: resolvedDark, toggleTheme };
}

