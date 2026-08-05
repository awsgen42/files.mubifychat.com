import Link from 'next/link';

/**
 * Shared across every page, including the app itself. The abuse link only
 * works if it is reachable from wherever someone happens to be, so it lives
 * here rather than on the content pages alone.
 */
export function SiteFooter() {
  return (
    <footer className="mt-8 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-xs text-muted-foreground">
      <span>Files are deleted automatically when the session closes.</span>
      <span aria-hidden="true">·</span>
      <Link href="/report" className="underline underline-offset-2 hover:text-foreground">
        Report abuse
      </Link>
    </footer>
  );
}
