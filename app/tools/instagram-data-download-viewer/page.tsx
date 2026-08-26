import type { Metadata } from 'next';
import { ContentPageCta, ContentPageFaq, ContentPageShell } from '@/components/ContentPageShell';
import { InstagramExportTool } from '@/components/InstagramExportTool';
import { HOW_IT_WORKS, INSTAGRAM_FAQ, WHY_MEDIA_MODE, WHY_NO_UPLOAD } from '@/lib/instagram-viewer';
import { pageMetadata } from '@/lib/seo';

const PATH = '/tools/instagram-data-download-viewer';
const TITLE = 'Instagram Data Download Viewer — read your export in the browser';
const DESCRIPTION =
  'Open the zip Instagram sends you and read your messages, with split conversations merged and the mojibake repaired. Nothing is uploaded — the archive is read inside the page.';

export const metadata: Metadata = pageMetadata({ path: PATH, title: TITLE, description: DESCRIPTION });

export default function InstagramViewerPage() {
  return (
    <ContentPageShell
      breadcrumbName="Instagram data download viewer"
      path={PATH}
      faq={INSTAGRAM_FAQ}
      title="Instagram data download viewer"
      subhead="Read your export without uploading it. Split conversations are merged; the mojibake is repaired."
      tool={<InstagramExportTool />}
    >
      {/* Headingless, so the outline stays h1 then the tool's own h2s. */}
      <section className="glass card p-5 sm:p-6">
        <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">{WHY_NO_UPLOAD}</p>
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

      <section className="glass card p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Why photos start hidden on some archives</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
          {WHY_MEDIA_MODE}
        </p>
      </section>

      <ContentPageFaq faq={INSTAGRAM_FAQ} />

      <ContentPageCta
        heading="Send a file between two devices"
        body="Mubifiles moves files and text with a six-digit code. No account, nothing to install."
      />
    </ContentPageShell>
  );
}
