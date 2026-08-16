import Link from 'next/link';
import type { ReactNode } from 'react';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { buildFaqSchema, type FaqEntry } from '@/lib/faq';
import { buildBreadcrumbSchema } from '@/lib/seo';

/**
 * Shared chrome for static content pages: header, breadcrumb, footer and the
 * per-page JSON-LD. The schema lives here rather than in the root layout so a
 * page only ever advertises the FAQ it actually renders — and a page without
 * one, like /report, emits no FAQPage at all.
 */
export function ContentPageShell({
  breadcrumbName,
  path,
  faq,
  title,
  subhead,
  tool,
  children,
}: {
  breadcrumbName: string;
  path: string;
  /** Omit on pages that have no FAQ; no FAQPage schema is emitted then. */
  faq?: readonly FaqEntry[];
  /**
   * The page heading. Supplying it opts into the tool-page ordering below;
   * omitting it leaves the page to render its own <h1> among the children,
   * which is what the prose pages do.
   */
  title?: string;
  /** One line under the heading. Anything longer belongs below the tool. */
  subhead?: string;
  /**
   * The tool itself, rendered directly after the heading and before any
   * explanatory copy.
   *
   * This is the ordering rule for the whole /tools/ section, held here so that
   * every tool gets it by passing a component in rather than by each page
   * remembering to put its own sections in the right order. Someone arriving
   * from a search for "sha256 file" wants the thing, not an introduction to
   * it; the prose still exists, and is still in the document, just below the
   * thing they came for.
   */
  tool?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 py-6 sm:px-6 sm:py-10">
      <SiteHeader path={path} />

      <nav aria-label="Breadcrumb" className="mt-6 text-xs text-muted-foreground">
        <ol className="flex items-center gap-1.5">
          <li>
            <Link href="/" className="hover:text-foreground">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-foreground">
            {breadcrumbName}
          </li>
        </ol>
      </nav>

      <main className="mt-4 grid gap-4 sm:gap-5">
        {/* Kept deliberately short: on a 390px screen every line here is a
            line between the visitor and the tool. The full explanation lives
            below it, where it is still indexed and still read by anyone who
            wants it. */}
        {title && (
          <section className="glass card p-5 sm:p-6">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
            {subhead && (
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">{subhead}</p>
            )}
          </section>
        )}
        {tool}
        {children}
      </main>

      <SiteFooter />

      {faq && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(buildFaqSchema(faq)) }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildBreadcrumbSchema(breadcrumbName, path)),
        }}
      />
    </div>
  );
}

/** The end-of-page call to action, identical across content pages. */
export function ContentPageCta({ heading, body }: { heading: string; body: string }) {
  return (
    <section className="glass card p-5 text-center sm:p-6">
      <h2 className="text-lg font-semibold">{heading}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
      <Link
        href="/"
        className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground shadow-lg shadow-accent/25 transition-all duration-200 hover:shadow-accent/40 hover:brightness-110 active:scale-[0.98]"
      >
        Start a session →
      </Link>
    </section>
  );
}

/** FAQ block, rendered from the same entries that feed the JSON-LD. */
export function ContentPageFaq({ faq }: { faq: readonly FaqEntry[] }) {
  return (
    <section className="glass card p-5 sm:p-6">
      <h2 className="text-lg font-semibold">Frequently asked questions</h2>
      <dl className="mt-4 grid gap-5">
        {faq.map((item) => (
          <div key={item.q}>
            <dt className="text-sm font-medium">{item.q}</dt>
            <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.a}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
