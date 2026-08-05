import Link from 'next/link';
import type { ReactNode } from 'react';
import { LogoMark } from '@/components/Icons';
import { ThemeToggle } from '@/components/ThemeToggle';
import { buildFaqSchema, type FaqEntry } from '@/lib/faq';
import { buildBreadcrumbSchema } from '@/lib/seo';

/**
 * Shared chrome for static content pages: header, breadcrumb, footer and the
 * per-page JSON-LD. The schema lives here rather than in the root layout so a
 * page only ever advertises the FAQ it actually renders.
 */
export function ContentPageShell({
  breadcrumbName,
  path,
  faq,
  children,
}: {
  breadcrumbName: string;
  path: string;
  faq: readonly FaqEntry[];
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 py-6 sm:px-6 sm:py-10">
      <header className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <LogoMark />
          <div>
            <p className="text-lg font-semibold leading-tight">Mubifiles</p>
            <p className="text-xs text-muted-foreground">Phone to PC in seconds</p>
          </div>
        </Link>
        <ThemeToggle />
      </header>

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

      <main className="mt-4 grid gap-4 sm:gap-5">{children}</main>

      <footer className="mt-8 text-center text-xs text-muted-foreground">
        Files are deleted automatically when the session closes.
      </footer>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildFaqSchema(faq)) }}
      />
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
