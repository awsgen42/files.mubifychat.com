import Link from 'next/link';

/**
 * Shared across every page, including the app itself and the 404. The abuse
 * link only works if it is reachable from wherever someone happens to be, so
 * it lives here rather than on the content pages alone.
 */
export function SiteFooter() {
  return (
    <footer className="mt-8 lg:mt-6">
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-xs text-muted-foreground">
        <span>Files are deleted automatically when the session closes.</span>
        {[
          { href: '/privacy', label: 'Privacy' },
          { href: '/terms', label: 'Terms' },
          { href: '/report', label: 'Report abuse' },
        ].map((link) => (
          <span key={link.href} className="flex items-center gap-x-3">
            <span aria-hidden="true">·</span>
            <Link href={link.href} className="underline underline-offset-2 hover:text-foreground">
              {link.label}
            </Link>
          </span>
        ))}
      </div>

      {/* A signature, not a claim: a step down in size and weight from the line
          above so it reads as who made this rather than as something the page
          is telling you. The two halves are each unbreakable, so on a narrow
          screen the only place it can wrap is between them — never inside
          "MubifyChat" or "AuMu". */}
      <p className="mt-2 text-center text-[11px] leading-relaxed text-muted-foreground/70">
        <span className="whitespace-nowrap">
          A{' '}
          <a
            href="https://mubifychat.com"
            className="underline underline-offset-2 hover:text-muted-foreground"
          >
            MubifyChat
          </a>{' '}
          project,
        </span>{' '}
        <span className="whitespace-nowrap">from AuMu</span>
      </p>
    </footer>
  );
}
