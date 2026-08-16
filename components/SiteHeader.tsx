import Link from 'next/link';
import type { ReactNode } from 'react';
import { LogoMark } from './Icons';
import { ThemeToggle } from './ThemeToggle';
import { buttonClasses, cx } from '@/lib/styles';

/**
 * The header, on every page.
 *
 * Extracted because there were two copies of it — one in ContentPageShell and
 * one inline in the app page — which is one copy too many to add a link to.
 * The two differed in exactly two ways, both preserved here: on the home page
 * the wordmark is not a link, because it already points at where you are; and
 * the app page puts an extra control beside the theme toggle.
 */
export function SiteHeader({
  path,
  actions,
}: {
  /** The current route, without a trailing slash. */
  path: string;
  /** Page-specific controls, shown before the theme toggle. */
  actions?: ReactNode;
}) {
  const home = path === '/';
  const inTools = path === '/tools' || path.startsWith('/tools/');

  const brand = (
    <>
      <LogoMark />
      {/* Below 380px the wordmark and tagline give way to the logo alone.
          At 320px with a session open — logo, wordmark, tagline, Tools, End
          session and the theme toggle — the row overflowed by 15px, and the
          three candidates for removal were navigation, a 44px touch target,
          or two lines of text sitting next to the logo that already says the
          same thing. The name is kept for screen readers, so nothing is lost
          except pixels. */}
      <span className="sr-only">Mubifiles</span>
      <div aria-hidden="true" className="hidden min-[380px]:block">
        {/* Not an <h1>: the page below owns its own heading. */}
        <p className="text-lg font-semibold leading-tight">Mubifiles</p>
        <p className="text-xs text-muted-foreground">Phone to PC in seconds</p>
      </div>
    </>
  );

  return (
    <header className="flex items-center justify-between gap-2">
      {home ? (
        <div className="flex items-center gap-2.5">{brand}</div>
      ) : (
        <Link href="/" className="flex items-center gap-2.5">
          {brand}
        </Link>
      )}

      <div className="flex items-center gap-1">
        {/* A real anchor with a real href, rendered on the server: it is in
            the static HTML a crawler receives, not attached on hydration.
            Ghost weight on purpose — on `/` the primary action is starting a
            session, and the header should not compete with it. */}
        <Link
          href="/tools"
          aria-current={inTools ? (path === '/tools' ? 'page' : 'true') : undefined}
          className={cx(
            buttonClasses('ghost', 'min-h-11 px-3'),
            // The same accent-on-soft-accent pairing the Pill and the step
            // markers use; no new colour is introduced for this.
            inTools && 'bg-accent-soft text-accent hover:bg-accent-soft hover:text-accent',
          )}
        >
          Tools
        </Link>
        {actions}
        <ThemeToggle />
      </div>
    </header>
  );
}
