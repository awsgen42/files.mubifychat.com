'use client';

import { useEffect, useState } from 'react';
import { useTheme } from '@/lib/useTheme';
import { MoonIcon, SunIcon } from './Icons';
import { Button } from './ui';

export function ThemeToggle() {
  const { toggle } = useTheme();
  const [isDark, setIsDark] = useState(false);

  // Read from the DOM rather than state: the pre-paint bootstrap script has
  // already picked the theme by the time React hydrates.
  useEffect(() => {
    const update = () => setIsDark(document.documentElement.classList.contains('dark'));
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return (
    <Button
      variant="ghost"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      className="!px-2.5"
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </Button>
  );
}
