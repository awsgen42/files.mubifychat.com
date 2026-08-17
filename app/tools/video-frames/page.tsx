import type { Metadata } from 'next';
import { ToolPostLink } from '@/components/BlogPost';
import { ContentPageCta, ContentPageFaq, ContentPageShell } from '@/components/ContentPageShell';
import { VideoFramesTool } from '@/components/VideoFramesTool';
import { pageMetadata } from '@/lib/seo';
import { HOW_TO, SUPPORTED_NOTE, VIDEO_FRAMES_FAQ, WHY_LOCAL } from '@/lib/video-frames';

const PATH = '/tools/video-frames';
const TITLE = 'Extract Frames From a Large Video — no upload, no size limit';
const DESCRIPTION =
  'Pull JPEG frames out of a video in your browser. No upload, so no file-size cap and no copy left on anyone’s server. Choose a frame rate, trim the range, download one frame or the whole set as a ZIP.';

export const metadata: Metadata = pageMetadata({ path: PATH, title: TITLE, description: DESCRIPTION });

export default function VideoFramesPage() {
  return (
    <ContentPageShell
      breadcrumbName="Video frame extractor"
      path={PATH}
      faq={VIDEO_FRAMES_FAQ}
      title="Extract frames from a video"
      subhead="JPEG stills from any length of video, without uploading it."
      tool={<VideoFramesTool />}
    >
      {/* Headingless, so the outline stays h1 then the tool's own h2s. */}
      <section className="glass card p-5 sm:p-6">
        <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
          Take still images out of a video at whatever rate you choose — one a second to skim a long
          recording, or twenty-four to catch the exact moment something happens.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
          <strong className="font-medium text-foreground">Your video is never uploaded.</strong> It
          is read from your disk by this page and every frame is produced here, on your device. That
          is the whole point of it: the tools that do this on a server have to receive your file
          first, which is why they cap what they accept — ezgif, the best of them, stops at 200 MB
          and keeps what you send for an hour afterwards. There is no cap here because there is no
          transfer, and nothing to delete afterwards because no copy was ever made.
        </p>
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
        <h2 className="text-lg font-semibold">How to use it</h2>
        <ol className="mt-4 grid gap-3">
          {HOW_TO.map((step, index) => (
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
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{SUPPORTED_NOTE}</p>
      </section>

      <ToolPostLink toolPath="/tools/video-frames" />

      <ContentPageFaq faq={VIDEO_FRAMES_FAQ} />

      <ContentPageCta
        heading="Need those frames on another device?"
        body="Mubifiles sends files and text between two devices with a six-digit code. No account, nothing to install."
      />
    </ContentPageShell>
  );
}
