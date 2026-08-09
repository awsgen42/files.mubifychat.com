/**
 * The page background, in plain sRGB.
 *
 * `--background` in globals.css is authored in oklch, which CSS resolves for
 * us — but three things need the colour before any CSS exists to resolve it:
 *
 *   the inline bootstrap script, which paints the document before the
 *   stylesheet has loaded (see themeBootstrapScript)
 *
 *   the theme-color meta, read by the browser chrome
 *
 *   the web manifest, which paints the splash screen when the installed app
 *   launches
 *
 * So these are the sRGB rendering of those tokens, measured rather than
 * guessed. If `--background` is ever retuned, re-derive them by painting
 * `var(--background)` into a 1x1 canvas and reading the pixel back;
 * test/theme.test.ts keeps the manifest honest against whatever is here.
 */
export const THEME_BACKGROUND = {
  light: '#eff1fa',
  dark: '#0b0d16',
} as const;
