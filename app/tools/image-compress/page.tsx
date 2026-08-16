import type { Metadata } from 'next';
import { ContentPageCta, ContentPageFaq, ContentPageShell } from '@/components/ContentPageShell';
import { ImageCompressTool } from '@/components/ImageCompressTool';
import { HOW_IT_WORKS, IMAGE_FAQ, LIMITS_NOTE } from '@/lib/image-compress';
import { pageMetadata } from '@/lib/seo';

const PATH = '/tools/image-compress';
const TITLE = 'Image Compressor & Resizer — JPEG, PNG and WebP in your browser';
const DESCRIPTION =
  'Compress and resize images without uploading them. Set quality, cap the longest edge, convert to JPEG or WebP, and download one at a time or as a ZIP. Runs entirely in your browser.';

export const metadata: Metadata = pageMetadata({ path: PATH, title: TITLE, description: DESCRIPTION });

export default function ImageCompressPage() {
  return (
    <ContentPageShell
      breadcrumbName="Image compressor"
      path={PATH}
      faq={IMAGE_FAQ}
      title="Image compressor & resizer"
      subhead="Shrink and resize photos in your browser, without uploading them."
    tool={<ImageCompressTool />}
    >
      {/* Headingless, so the outline stays h1 then the tool's own h2s. */}
      <section className="glass card p-5 sm:p-6">
        <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
          Make images smaller for email, a website or a form that will not accept the photo your
          phone took. Set a quality, cap the longest edge, and optionally convert to JPEG or WebP.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
          <strong className="font-medium text-foreground">Nothing is uploaded.</strong> Every image
          is decoded, resized and re-encoded by this page on your own device — no request leaves the
          browser while it works, which you can confirm in your own network tools. Most image
          compressors send your photos to a server; there is no need to, so this one does not.
        </p>
      </section>

      <section className="glass card p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Getting a smaller file without a worse one</h2>
        <ol className="mt-4 grid gap-3">
          {HOW_IT_WORKS.map((step, index) => (
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

      <ContentPageFaq faq={IMAGE_FAQ} />

      <ContentPageCta
        heading="Need to get that photo onto another device?"
        body="Mubifiles sends files and text between two devices with a six-digit code. No account, nothing to install."
      />
    </ContentPageShell>
  );
}
