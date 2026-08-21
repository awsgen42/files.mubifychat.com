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
          A browser can already decode video and draw it to a canvas, which is all that pulling
          stills out of a file requires. So it can be done on your own machine, with no upload, no
          size limit and no copy left on anyone&rsquo;s server —{' '}
          <Link href="/tools/video-frames">the extractor here</Link> does exactly that.
        </p>
        <p>
          It only works on video your browser can play. That sounds like a technicality and it is
          the single most important thing on this page, so it goes first.
        </p>
      </Prose>

      <Prose heading="If it does not play, it cannot be read">
        <p>
          The browser decodes the formats it ships decoders for, and that set is smaller than the
          set of files people have. We made one three-second clip in each format with{' '}
          <code>ffmpeg</code>, loaded each into a real <code>&lt;video&gt;</code> element, seeked to
          one second and drew the frame to a canvas. Not <code>canPlayType</code>&rsquo;s opinion —
          whether a picture actually came out:
        </p>
        <Measured>{`file             canPlayType    loads    frame drawn
clip.webm        probably       true     yes (320x240)
clip.vp9.webm    probably       true     yes (320x240)
clip.avi         (empty)        false    no
clip.wmv         (empty)        false    no
clip.flv         (empty)        false    no
clip.hevc.mov    (empty)        false    no
clip.mp4         (empty)        false    no      <- see below`}</Measured>
        <p>
          AVI, WMV and FLV are container formats from a different era of the web, and no mainstream
          browser carries the code to demux them. That is not a gap anyone is planning to close.
        </p>
        <p>
          HEVC — which is what an iPhone writes by default in High Efficiency mode — is the awkward
          one. Safari plays it, Chrome&rsquo;s support depends on the operating system and the
          hardware underneath it, and the answer on your machine may differ from the answer on the
          next one.
        </p>
        <p>
          That last row deserves the caveat rather than being quietly dropped. This test ran in
          Playwright&rsquo;s Chromium, which is built without the proprietary codecs, so H.264 fails
          here and would almost certainly succeed in the Chrome you have installed. It is a useful
          accident: codec support is a property of the build in front of you, not of the format, and
          the only test that means anything is the one you run in your own browser.
        </p>
        <p>
          Which makes the check trivial. Open the file in a browser tab. If it plays, the extractor
          can read it. If it does not, no amount of work on our side changes that.
        </p>
      </Prose>

      <Prose heading="Why the online converters do handle your AVI">
        <p>
          They run ffmpeg on a server. That is the whole trick — ffmpeg decodes essentially
          everything, and a machine you do not control is running it on a copy of your file.
        </p>
        <p>
          We are not going to do that, and it is worth being plain about the trade rather than
          pretending there is no cost. Compiling ffmpeg to WebAssembly and shipping it to the
          browser is the other option, and it means a multi-megabyte download before anything
          happens, to decode a file the browser may well handle natively. Between a large download
          for every visitor, an upload of every file, and a stated boundary, the boundary is the
          honest one.
        </p>
        <p>
          If your file is one of the formats above, the answer is ffmpeg locally. One line, handles
          anything:
        </p>
        <Measured>{`ffmpeg -i input.avi -vf fps=1 frame_%04d.jpg`}</Measured>
      </Prose>

      <Prose heading="Three things that go wrong even when the format is fine">
        <p>
          <strong>Seeking is asynchronous, and the obvious version of it lies.</strong> Set{' '}
          <code>currentTime</code>, wait for the <code>seeked</code> event, draw — and you get
          duplicate frames, because <code>seeked</code> fires when the seek completes rather than
          when the new frame has been composited. <code>requestVideoFrameCallback</code> fires at
          the right moment instead, and comes with its own trap: for a paused, off-screen video it
          may never fire at all. Awaiting it unconditionally hangs the entire extraction, which is
          what our first version did. It now races the callback against a 250 ms timeout.
        </p>
        <p>
          <strong>The first frame is often black.</strong> Seek to zero and the decoder has not
          necessarily produced a complete picture yet. The tempting fix — sample the pixels and skip
          frames that are uniformly dark — is wrong, because plenty of real footage opens on black
          and silently discarding someone&rsquo;s first frame is worse than handing them one they can
          delete. Nudging the first sample past zero is the version that does not lie about what it
          did.
        </p>
        <p>
          <strong>Memory is what actually kills the tab.</strong> One frame per second from a
          ten-minute clip is 600 JPEGs, and holding them all until the end works right up until it
          does not. Worse, the obvious way to measure that cannot see it: JavaScript heap counters
          do not count canvas backing stores, <code>ImageBitmap</code>s or blob data, so a naive
          measurement reports everything is fine while the process grows by hundreds of megabytes.
        </p>
        <p>
          So it is measured from outside the browser, and the instrument is checked against a known
          allocation before any number from it is quoted:
        </p>
        <Measured>{`idle                      356 MB
holding a known 300 MB    663 MB   (+307)
after release             365 MB   (+9)`}</Measured>
        <p>
          With something that demonstrably sees the thing, each frame is streamed into the ZIP as it
          is produced rather than accumulated.
        </p>
      </Prose>

      <Prose heading="What I would do">
        <p>
          Drag the file onto <Link href="/tools/video-frames">the extractor</Link> first. It takes
          two seconds to find out, nothing is uploaded either way, and if the browser cannot decode
          it you are told before you wait for anything.
        </p>
        <p>
          If it is an AVI, a WMV, an FLV, or an iPhone MOV your browser will not play, install
          ffmpeg and use the line above. Do not upload a video to a converter to solve a decoding
          problem you can solve locally — especially not one you would mind a stranger watching.
        </p>
      </Prose>
    </BlogPostPage>
  );
}
