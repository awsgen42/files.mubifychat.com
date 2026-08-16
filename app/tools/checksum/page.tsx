import type { Metadata } from 'next';
import { ChecksumTool } from '@/components/ChecksumTool';
import { ContentPageCta, ContentPageFaq, ContentPageShell } from '@/components/ContentPageShell';
import { CHECKSUM_FAQ, LIMITS_NOTE, VERIFY_STEPS } from '@/lib/checksum';
import { pageMetadata } from '@/lib/seo';

const PATH = '/tools/checksum';
const TITLE = 'File Hash & Checksum Generator — SHA-256, SHA-1, MD5 in your browser';
const DESCRIPTION =
  'Generate the SHA-256, SHA-1 or MD5 checksum of any file and compare it against a published hash. Runs entirely in your browser — the file is never uploaded.';

export const metadata: Metadata = pageMetadata({ path: PATH, title: TITLE, description: DESCRIPTION });

export default function ChecksumPage() {
  return (
    <ContentPageShell
      breadcrumbName="File hash & checksum"
      path={PATH}
      faq={CHECKSUM_FAQ}
      title="File hash & checksum generator"
      subhead="SHA-256, SHA-1 and MD5, computed in your browser."
      tool={<ChecksumTool />}
    >
      {/* No heading of its own: the outline is h1 then the tool's own h2s,
          and introducing one here would insert a heading between them. */}
      <section className="glass card p-5 sm:p-6">
        <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
          Work out the SHA-256, SHA-1 and MD5 of a file, and check it against the hash a publisher
          gave you. Useful for confirming a download arrived intact, or that two copies of a file
          really are the same.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
          <strong className="font-medium text-foreground">
            Your file is never uploaded.
          </strong>{' '}
          It is read by this page, on your device, and hashed there. Nothing is sent to us or to
          anyone else — no request leaves the browser while it works, which you can confirm in your
          own network tools. Most checksum sites upload your file to a server to do this; there is
          no reason to, so this one does not.
        </p>
      </section>

      <section className="glass card p-5 sm:p-6">
        <h2 className="text-lg font-semibold">How to verify a download</h2>
        <ol className="mt-4 grid gap-3">
          {VERIFY_STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-3">
              <span
                aria-hidden="true"
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-medium text-accent"
              >
                {index + 1}
              </span>
              <p className="text-sm leading-relaxed text-muted-foreground">
                <strong className="font-medium text-foreground">{step.title}</strong> {step.body}
              </p>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{LIMITS_NOTE}</p>
      </section>

      <ContentPageFaq faq={CHECKSUM_FAQ} />

      <ContentPageCta
        heading="Need to move that file to another device?"
        body="Mubifiles sends files and text between two devices with a six-digit code. No account, nothing to install."
      />
    </ContentPageShell>
  );
}
