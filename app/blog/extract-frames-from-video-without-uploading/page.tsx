import type { Metadata } from 'next';
import Link from 'next/link';
import { BlogPostPage, Measured, Prose } from '@/components/BlogPost';
import { postBySlug } from '@/lib/blog';
import { pageMetadata } from '@/lib/seo';

const post = postBySlug('extract-frames-from-video-without-uploading')!;

export const metadata: Metadata = pageMetadata({
  path: `/blog/${post.slug}`,
  title: 'How to Extract Frames from a Video Without Uploading It',
  description: post.description,
});

export default function Page() {
  return (
    <BlogPostPage post={post}>
      <Prose>
        <p>
          A browser can already decode video — that is what a <code>&lt;video&gt;</code> element
          does — and it can already draw an image onto a canvas. Put those together and you can pull
          stills out of a video without the file leaving your device. No upload, so no size limit
          and no copy on anyone&rsquo;s server.
        </p>
        <p>
          It works well. It also has one real boundary and three ways of going quietly wrong, and
          the honest version of this article says what they are.
        </p>
      </Prose>

      <Prose heading="The boundary: the browser has to be able to decode it">
        <p>
          A browser decodes the formats it ships a decoder for, and that is not the same set
          everywhere. Container and codec are separate questions: an <code>.mp4</code> is a box, and
          what matters is what is inside it — usually H.264, increasingly HEVC from phone cameras,
          sometimes AV1.
        </p>
        <p>
          H.264 is patent-encumbered, and browsers differ in whether they ship a decoder for it.
          Chrome on a normal desktop install does. Chromium builds without proprietary codecs
          compiled in do not, and you can ask directly:
        </p>
        <Measured>{`video.canPlayType('video/mp4; codecs="avc1.42E01E')   ->  ""   (this build cannot)
video.canPlayType('video/webm; codecs="vp8"')        ->  "probably"`}</Measured>
        <p>
          That is not hypothetical — it is the result from the Chromium build we tested against,
          which is why our own verification ran on VP8/WebM and says so rather than claiming
          coverage it did not have. HEVC straight off an iPhone is the other common miss.
        </p>
        <p>
          This is a stated limit, not a bug to be worked around. The alternative is shipping a
          WebAssembly decoder — a multi-megabyte download to decode a file the browser may already
          handle natively — and the honest trade is to tell you up front that if your video will not
          play in the page, it cannot be read in the page either.
        </p>
      </Prose>

      <Prose heading="Trap 1: seeking is asynchronous, and it lies">
        <p>
          The obvious implementation sets <code>video.currentTime</code>, waits for the{' '}
          <code>seeked</code> event, and draws. It produces duplicate frames.
        </p>
        <p>
          <code>seeked</code> fires when the seek completes, which is not the same instant as the
          new frame being composited and available to <code>drawImage</code>. Draw immediately and
          you sometimes capture the previous frame. The fix is{' '}
          <code>requestVideoFrameCallback</code>, which fires when a frame has actually been
          presented.
        </p>
        <p>
          It has its own trap: for a paused, off-screen video it may never fire at all. Awaiting it
          unconditionally hangs the whole extraction — which is exactly what our first version did.
          It now races the callback against a 250 ms timeout and attaches the element off-screen
          rather than leaving it detached, so a frame that never presents costs a quarter of a
          second instead of the session.
        </p>
      </Prose>

      <Prose heading="Trap 2: the first frame is often black">
        <p>
          Seek to 0, draw, and you frequently get a black or half-decoded image. The decoder has not
          necessarily produced a complete picture at the very first timestamp, and many videos
          genuinely open on black.
        </p>
        <p>
          Sampling a few pixels and skipping frames that are uniformly dark would be wrong: plenty
          of footage legitimately opens on black, and silently dropping the user&rsquo;s first frame
          is worse than handing them one they can delete. Nudging the first sample slightly past
          zero is the fix that does not lie about what it did.
        </p>
      </Prose>

      <Prose heading="Trap 3: rotation is metadata, not pixels">
        <p>
          A video shot in portrait on a phone is very often stored landscape with a rotation flag in
          the container. The browser applies that flag when it renders the video, so what you see is
          upright.
        </p>
        <p>
          <code>drawImage</code> from the video element gives you what the browser renders, which is
          the corrected orientation — so in practice frames come out the right way up. But{' '}
          <code>videoWidth</code> and <code>videoHeight</code> are the dimensions after correction
          too, and a canvas sized from the container&rsquo;s stated dimensions instead will produce
          stretched output. Size the canvas from the element, not from the file.
        </p>
      </Prose>

      <Prose heading="Trap 4: memory, which is the one that kills the tab">
        <p>
          Extracting one frame per second from a ten-minute clip is 600 JPEGs. Holding them all as
          blobs and zipping at the end works right up until it does not, and the failure is the tab
          dying rather than an error you can show.
        </p>
        <p>
          The measurable version of this: JavaScript heap counters cannot see canvas backing stores,
          <code>ImageBitmap</code>s or blob data, so a naive measurement will report everything is
          fine while the process grows by hundreds of megabytes. We measure process memory from
          outside instead — and calibrate the instrument against a known allocation before trusting
          any number it gives:
        </p>
        <Measured>{`idle                 356 MB
holding a known 300 MB   663 MB   (+307)
after release            365 MB   (+9)`}</Measured>
        <p>
          With an instrument that demonstrably sees the thing, streaming each frame into the ZIP as
          it is produced holds one frame at a time instead of all of them.
        </p>
      </Prose>

      <Prose heading="Doing it">
        <p>
          <Link href="/tools/video-frames">The frame extractor</Link> takes a video, a frame rate,
          and gives you a ZIP of JPEGs. The video is read from your disk and never sent anywhere; if
          your browser cannot decode the format, it says so before you wait for anything.
        </p>
        <p>
          If you need a format the browser will not decode, the honest answer is ffmpeg locally —{' '}
          <code>ffmpeg -i input.mp4 -vf fps=1 frame_%04d.jpg</code> — which is a command rather than
          a page, and will handle anything.
        </p>
      </Prose>
    </BlogPostPage>
  );
}
