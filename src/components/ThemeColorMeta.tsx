'use client';

import { useEffect } from 'react';
import { useTheme } from 'next-themes';

export function ThemeColorMeta() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    // resolvedTheme can be undefined on first render — fall back to system preference
    let theme = resolvedTheme;
    if (!theme) {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    const statusBarColor = theme === 'dark' ? '#111111' : '#f0f0f0';
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = statusBarColor;

    // Remove border from status bar by ensuring viewport-fit=cover
    let viewportMeta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    if (viewportMeta) {
      const currentContent = viewportMeta.getAttribute('content') || '';
      if (!currentContent.includes('viewport-fit')) {
        viewportMeta.setAttribute('content', currentContent + ', viewport-fit=cover');
      }
    }
  }, [resolvedTheme]);

  return null;
}
