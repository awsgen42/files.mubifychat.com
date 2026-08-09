'use client';

import { useCallback, useEffect, useState } from 'react';
import { THEME_BACKGROUND } from './theme';

export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'mubifiles.theme';

function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyTheme(theme: Theme): void {
  const dark = theme === 'dark' || (theme === 'system' && systemPrefersDark());
  const root = document.documentElement;
  root.classList.toggle('dark', dark);
  // The bootstrap script paints these before the stylesheet lands, and an
  // inline style outranks any rule the stylesheet then brings. So a toggle has
  // to move them too, or the canvas keeps the colour the page started in while
  // everything drawn on top of it changes.
  root.style.colorScheme = dark ? 'dark' : 'light';
  root.style.backgroundColor = dark ? THEME_BACKGROUND.dark : THEME_BACKGROUND.light;
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('system');

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
    const initial: Theme = stored === 'light' || stored === 'dark' ? stored : 'system';
    setThemeState(initial);
    applyTheme(initial);
  }, []);

  // Only relevant while following the OS, but the listener is cheap to keep.
  useEffect(() => {
    if (theme !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    applyTheme(next);
    if (next === 'system') window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const toggle = useCallback(() => {
    const isDark = document.documentElement.classList.contains('dark');
    setTheme(isDark ? 'light' : 'dark');
  }, [setTheme]);

  return { theme, setTheme, toggle };
}

/**
 * Runs before paint to apply the stored theme. Injected inline in the layout,
 * so it executes before the stylesheet has even been fetched.
 *
 * Setting the class is not enough on its own. The background lives on `body`
 * in CSS, and until that CSS arrives the document has no background at all —
 * the browser paints its default white canvas. On the web that is a brief
 * flicker; launching the installed app it is a dark splash, a white frame,
 * then the dark app.
 *
 * So this paints the document itself. `color-scheme` gets the browser's own
 * surfaces — scrollbars, form controls, the canvas — onto the right side
 * immediately, and the explicit background covers the gap before `body` has a
 * colour of its own. Both follow the stored or system preference; neither
 * hardcodes dark, because the light theme has exactly the same problem in
 * reverse for anyone whose splash is light.
 */
export const themeBootstrapScript = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}');var d=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light';r.style.backgroundColor=d?'${THEME_BACKGROUND.dark}':'${THEME_BACKGROUND.light}';}catch(e){}})();`;
