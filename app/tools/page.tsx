import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentPageCta, ContentPageShell } from '@/components/ContentPageShell';
import { pageMetadata } from '@/lib/seo';
import { TOOLS, TOOLS_INDEX_DESCRIPTION, TOOLS_INDEX_TITLE } from '@/lib/tools';

const PATH = '/tools';

export const metadata: Metadata = pageMetadata({ path: PATH, title: TOOLS_INDEX_TITLE, description: TOOLS_INDEX_DESCRIPTION, type: 'website' });

/* No FAQ on this page, so no FAQPage schema is emitted — the shell only
   attaches one when it is given entries, which is what keeps the schema
   describing what a page actually shows. */
export default function ToolsPage() {
  return (
    <ContentPageShell breadcrumbName="Tools" path={PATH}>
      <section className="glass card p-5 sm:p-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">File tools</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
          Small utilities for working with files, free and without an account. They all run in your
          own browser: whatever you open stays on your device, and nothing is uploaded.
        </p>
      </section>

      <section className="glass card p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Available now</h2>
        <ul className="mt-4 grid gap-3">
          {TOOLS.map((tool) => (
            <li key={tool.path}>
              <Link
                href={tool.path}
                className="glass-input block p-4 transition-colors hover:border-accent/40 hover:bg-accent-soft"
              >
                <span className="text-sm font-medium text-foreground">{tool.name}</span>
                <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
                  {tool.blurb}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <ContentPageCta
        heading="Or send a file to another device"
        body="Mubifiles moves files and text between two devices with a six-digit code. No account, nothing to install."
      />
    </ContentPageShell>
  );
}
