import type { Metadata } from 'next';
import { ContentPageCta, ContentPageFaq, ContentPageShell } from '@/components/ContentPageShell';
import { SplitFileTool } from '@/components/SplitFileTool';
import { pageMetadata } from '@/lib/seo';
import { NO_LOCK_IN, SPLIT_FAQ, WHY_LOCAL } from '@/lib/split-file';

const PATH = '/tools/split-file';
const TITLE = 'Split a File Too Big to Email or Upload — and join the parts back';
const DESCRIPTION =
  'Cut a large file into .001/.002 parts in your browser, and join parts someone sent you. No upload, so no size limit, and the parts work with cat, copy /b, HJSplit and 7-Zip.';

export const metadata: Metadata = pageMetadata({ path: PATH, title: TITLE, description: DESCRIPTION });

export default function SplitFilePage() {
  return (
    <ContentPageShell
      breadcrumbName="Split & join files"
      path={PATH}
      faq={SPLIT_FAQ}
      title="Split a file into parts, and join them back"
      subhead="For a file too big to email or upload — with no size limit, in your browser."
      tool={<SplitFileTool />}
    >
      {/* Headingless, so the outline stays h1 then the tool's own h2s. */}
      <section className="glass card p-5 sm:p-6">
        <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
          Cut a file into numbered parts small enough to send, and put them back together at the
          other end. Useful when something will not fit an email attachment, an upload form, or a
          USB stick formatted as FAT32.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
          <strong className="font-medium text-foreground">Nothing is uploaded.</strong> The file is
          read from your disk in pieces and the parts are written straight back to it, so there is
          no transfer and therefore no cap — which is the one thing every online splitter has,
          because every one of them has to receive your file before it can cut it up.
        </p>
      </section>

      <section className="glass card p-5 sm:p-6">
        <h2 className="text-lg font-semibold">The parts are not ours</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{NO_LOCK_IN}</p>
      </section>

      <section className="glass card p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Why do it in the browser</h2>
        <ul className="mt-4 grid gap-3">
          {WHY_LOCAL.map((item) => (
            <li key={item.title} className="flex gap-3">
              <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <p className="text-sm leading-relaxed text-muted-foreground">
                <strong className="font-medium text-foreground">{item.title}</strong> {item.body}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <ContentPageFaq faq={SPLIT_FAQ} />

      <ContentPageCta
        heading="Or send the whole thing to another device"
        body="Mubifiles moves files and text between two devices with a six-digit code. No account, nothing to install."
      />
    </ContentPageShell>
  );
}
