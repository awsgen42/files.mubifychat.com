/**
 * The button treatment, as strings.
 *
 * Separate from components/ui.tsx because that file is `'use client'`, which
 * makes everything it exports — including a function that only concatenates
 * class names — unreachable from a server component. The header is a server
 * component and needs exactly these classes for its Tools link, so the strings
 * live here where both sides can read them and ui.tsx re-exports what it
 * already exported.
 */

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export const VARIANTS: Record<Variant, string> = {
  // Kept solid rather than translucent: this is the one element that must stay
  // legible against whatever colour drifts behind it.
  primary:
    'bg-accent text-accent-foreground shadow-lg shadow-accent/25 hover:shadow-accent/40 hover:brightness-110',
  secondary: 'glass text-foreground hover:bg-surface-strong',
  ghost: 'text-muted-foreground hover:text-foreground hover:bg-surface-muted',
  danger: 'glass text-danger border-danger/30 hover:bg-danger/10',
};

export const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium ' +
  'transition-all duration-200 active:scale-[0.98] ' +
  // Keyboard focus has to be visible, and focus-visible rather than focus so a
  // pointer press does not leave a ring behind. The offset colour is the page
  // background, so the ring reads on both themes.
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/**
 * One disabled treatment for every variant, applied after them so it wins.
 *
 * Dimming each variant in place did not work: the same opacity over a solid
 * accent and over a translucent glass fill lands in completely different
 * places, so a disabled primary still read as a live purple button next to a
 * disabled secondary that had all but vanished.
 */
export const BUTTON_DISABLED =
  'disabled:cursor-not-allowed disabled:active:scale-100 disabled:bg-surface-muted ' +
  'disabled:text-muted-foreground disabled:shadow-none disabled:opacity-60';

/**
 * The button treatment, for things that are not buttons.
 *
 * A link that navigates must be an <a> — it belongs in the tab order as a
 * link, it opens in a new tab on middle-click, and a crawler follows it. That
 * rules out the Button component, which renders a <button>. Sharing the
 * classes means such a link looks identical without a second set of styles
 * existing to drift from this one.
 *
 * The disabled rules are left out: they are inert on an anchor, and shipping
 * them would put a dozen dead class names in the markup of every page.
 */
export function buttonClasses(variant: Variant = 'primary', className?: string): string {
  return cx(BUTTON_BASE, VARIANTS[variant], className);
}
