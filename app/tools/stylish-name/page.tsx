import type { Metadata } from 'next';
import { ContentPageCta, ContentPageFaq, ContentPageShell } from '@/components/ContentPageShell';
import { StylishNameTool } from '@/components/StylishNameTool';
import { pageMetadata } from '@/lib/seo';
import { HOW_IT_WORKS, STYLISH_FAQ, WHY_COMPATIBILITY } from '@/lib/stylish-name';

const PATH = '/tools/stylish-name';
const TITLE = 'Stylish Name Generator — grouped by what actually survives';
const DESCRIPTION =
  'Turn your name into fancy Unicode text, grouped by how likely each style is to arrive intact rather than by how it looks. Shows the length in characters, UTF-16 units and bytes. Nothing is uploaded.';

export const metadata: Metadata = pageMetadata({ path: PATH, title: TITLE, description: DESCRIPTION });

export default function StylishNamePage() {
  return (
    <ContentPageShell
      breadcrumbName="Stylish name"
      path={PATH}
      faq={STYLISH_FAQ}
      title="Stylish name generator"
      subhead="Grouped by what survives being pasted, not by what looks nicest."
      tool={<StylishNameTool />}
    >
      {/* Headingless, so the outline stays h1 then the tool's own h2s. */}
      <section className="glass card p-5 sm:p-6">
        <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
          {WHY_COMPATIBILITY}
        </p>
      </section>

      <section className="glass card p-5 sm:p-6">
        <h2 className="text-lg font-semibold">How this actually works</h2>
        <ul className="mt-4 grid gap-3">
          {HOW_IT_WORKS.map((item) => (
            <li key={item.title} className="flex gap-3">
              <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <p className="text-sm leading-relaxed text-muted-foreground">
                <strong className="font-medium text-foreground">{item.title}</strong> {item.body}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <ContentPageFaq faq={STYLISH_FAQ} />

      <ContentPageCta
        heading="Send a file between two devices"
        body="Mubifiles moves files and text with a six-digit code. No account, nothing to install."
      />
    </ContentPageShell>
  );
}
