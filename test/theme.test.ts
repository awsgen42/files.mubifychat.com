import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { THEME_BACKGROUND } from '../lib/theme';
import { themeBootstrapScript } from '../lib/useTheme';

/**
 * The background colour is declared in four places that cannot import from
 * each other: the CSS token, the inline bootstrap script, the theme-color
 * meta, and the web manifest. Three of them come from lib/theme.ts; the
 * manifest is static JSON and cannot, so this is the guard.
 *
 * A mismatch is exactly the bug being fixed — the manifest painted the splash
 * one colour and the app painted itself another, which on launch reads as a
 * flash.
 */
function manifest(): Record<string, string> {
  return JSON.parse(readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));
}

describe('theme colours', () => {
  it('paints the splash the colour the app actually is', () => {
    const m = manifest();
    expect(m.background_color).toBe(THEME_BACKGROUND.dark);
    expect(m.theme_color).toBe(THEME_BACKGROUND.dark);
  });

  it('states both colours as plain sRGB, which is all a manifest can take', () => {
    for (const value of Object.values(THEME_BACKGROUND)) {
      expect(value).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe('theme bootstrap script', () => {
  it('paints the document rather than only setting a class', () => {
    // Setting the class alone leaves the browser painting its default white
    // canvas until the stylesheet arrives, which is the flash this fixes.
    expect(themeBootstrapScript).toContain('backgroundColor');
    expect(themeBootstrapScript).toContain('colorScheme');
    expect(themeBootstrapScript).toContain(THEME_BACKGROUND.dark);
    expect(themeBootstrapScript).toContain(THEME_BACKGROUND.light);
  });

  it('follows the stored preference, then the system one', () => {
    expect(themeBootstrapScript).toContain('mubifiles.theme');
    expect(themeBootstrapScript).toContain('prefers-color-scheme: dark');
    // Neither side is hardcoded: a light-theme user has the same problem in
    // reverse, so both branches must exist.
    expect(themeBootstrapScript).toContain("'light'");
    expect(themeBootstrapScript).toContain("'dark'");
  });

  it('never throws, whatever storage does', () => {
    // Private browsing can make localStorage itself throw on read.
    expect(themeBootstrapScript).toContain('try');
    expect(themeBootstrapScript).toContain('catch');
  });
});
