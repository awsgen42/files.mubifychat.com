import type { Metadata } from 'next';
import { ToolPostLink } from '@/components/BlogPost';
import { ContentPageCta, ContentPageFaq, ContentPageShell } from '@/components/ContentPageShell';
import { SplitFileTool } from '@/components/SplitFileTool';
import { pageMetadata } from '@/lib/seo';
import { NO_LOCK_IN, SPLIT_FAQ, WHICH_BROWSERS, WHY_LOCAL } from '@/lib/split-file';

const PATH = '/tools/split-file';
const TITLE = 'Join .001 and .002 Files Back Together — nothing to install';
const DESCRIPTION =
  'Combine .001, .002 and .003 parts back into the original file, in your browser. No upload and no size limit, it tells you if the parts are really a RAR or ZIP archive, and it splits files too.';

export const metadata: Metadata = pageMetadata({ path: PATH, title: TITLE, description: DESCRIPTION });

export default function SplitFilePage() {
  return (
    <ContentPageShell
      breadcrumbName="Join & split files"
      path={PATH}
      faq={SPLIT_FAQ}
      title="Join .001 and .002 files back together"
      subhead="Rebuild the original from its numbered parts — in your browser, with nothing to install."
      tool={<SplitFileTool />}
    >
      {/* Headingless, so the outline stays h1 then the tool's own h2s. */}
      <section className="glass card p-5 sm:p-6">
        <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
          Someone sent you <code className="font-mono text-[13px]">movie.mkv.001</code>,{' '}
          <code className="font-mono text-[13px]">movie.mkv.002</code> and a dozen more, and none of them open.
          They are slices of one file, cut up so each piece would fit through an email or an upload form. Put
          them back in order and you have the original again.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
          <strong className="font-medium text-foreground">Nothing is uploaded.</strong> The parts are read from
          your disk and written back to it as the join runs, so there is no transfer, no queue and no cap on how
          large the result can be. And it works the other way too — the second tab cuts a file into parts.
        </p>
      </section>

      <section className="glass card p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Which browsers can do it</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{WHICH_BROWSERS}</p>
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

      <section className="glass card p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Or do it without a website at all</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{NO_LOCK_IN}</p>
      </section>

      <ToolPostLink toolPath="/tools/split-file" />

      <ContentPageFaq faq={SPLIT_FAQ} />

      <ContentPageCta
        heading="Or send the whole thing to another device"
        body="Mubifiles moves files and text between two devices with a six-digit code. No account, nothing to install."
      />
    </ContentPageShell>
  );
}
