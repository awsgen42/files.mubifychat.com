import type { Metadata } from 'next';
import Link from 'next/link';
import { BlogPostPage, Measured, Prose } from '@/components/BlogPost';
import { postBySlug } from '@/lib/blog';
import { pageMetadata } from '@/lib/seo';

const post = postBySlug('verify-a-download-with-sha256')!;

export const metadata: Metadata = pageMetadata({
  path: `/blog/${post.slug}`,
  title: 'How to Verify a Download with SHA-256',
  description: post.description,
});

export default function Page() {
  return (
    <BlogPostPage post={post}>
      <Prose>
        <p>
          A checksum is a short string derived from every byte of a file. Change one bit anywhere and
          the string changes completely. So if the publisher tells you what their file&rsquo;s
          checksum is, and yours computes to the same thing, you have the same file they shipped.
        </p>
        <p>The interesting part is what that does and does not prove.</p>
      </Prose>

      <Prose heading="What it actually proves">
        <p>
          <strong>It proves the download is intact.</strong> Truncated transfers, a proxy that
          mangled something, a disk that flipped a bit — all caught, reliably, which is the everyday
          use and a real one.
        </p>
        <p>
          <strong>It proves tampering only if the digest came from somewhere else.</strong> This is
          the part that gets skipped. If the checksum is printed on the same page as the download
          link, then anyone who could replace the file could also edit the line above it. You have
          verified that the page is internally consistent, which is not the question you were asking.
        </p>
        <p>
          A digest is worth something when it reaches you by a different route than the file: a
          signed release note, a distribution&rsquo;s package index, a message from the person who
          built it, a repository you already trust. Same page as the download, same trust as the
          download.
        </p>
        <p>
          <strong>It says nothing about whether the file is safe.</strong> A verified digest on
          malware confirms you have exactly the malware the publisher shipped.
        </p>
      </Prose>

      <Prose heading="Computing one">
        <p>Every desktop operating system has this built in.</p>
        <Measured>{`Windows    certutil -hashfile installer.exe SHA256
macOS      shasum -a 256 installer.dmg
Linux      sha256sum installer.iso`}</Measured>
        <p>
          Then compare with the published value. Compare the whole string — checking that it starts
          with <code>a3f9</code> and ends with <code>c21b</code> is not a check, since those are the
          characters an attacker would keep if they were going to bother at all.
        </p>
        <p>
          If you are on a machine where you would rather not open a terminal,{' '}
          <Link href="/tools/checksum">the checksum tool</Link> does the same thing in the browser.
          Paste the expected digest in and it compares for you, so you are not eyeballing sixty-four
          hex characters.
        </p>
      </Prose>

      <Prose heading="Why a browser tool for this is not obviously a good idea">
        <p>
          Most &ldquo;online SHA-256&rdquo; tools upload your file. For a public installer that is
          merely pointless; for anything you would not email a stranger it is worse than pointless,
          because you have now given a copy to a third party in order to check a hash.
        </p>
        <p>
          There is no reason for it. <code>crypto.subtle.digest</code> exists in every browser, and
          for large files a streaming implementation reads the file in windows from disk without
          holding it. Our tool computes SHA-256, SHA-1 and MD5 that way, and issues zero network
          requests while doing it — measured by recording every request between pressing the button
          and the result appearing:
        </p>
        <Measured>{`requests between pressing the button and the result: 0 (none)`}</Measured>
        <p>You can check that yourself on any such tool; see the last section.</p>
      </Prose>

      <Prose heading="A digest that is wrong is worse than no digest">
        <p>
          A checksum tool that returns a plausible but incorrect value is a genuinely harmful thing:
          it will tell you a good download is corrupt, or worse, agree with a published digest by
          accident when your file differs.
        </p>
        <p>
          So the implementations here are tested against the published test vectors for each
          algorithm, and — more usefully — each one was deliberately broken to confirm the tests
          could see it. Swapping the two halves of the length word in MD5&rsquo;s padding is a
          change that leaves the output looking exactly like a normal MD5 and produces a completely
          different value for every input:
        </p>
        <Measured>{`MD5("abc")  correct              900150983cd24fb0d6963f7d28e17f72
MD5("abc")  length word swapped  c79b6f2bcb046d747baab534d067dabb   <- tests went red, as they must`}</Measured>
        <p>
          SHA-1 and MD5 are there because publishers still use them, not because they are good. For
          detecting accidental corruption they are fine. For anything where someone might be trying
          to fool you, both are broken — MD5 thoroughly, SHA-1 in practice — and only the SHA-256
          line means anything.
        </p>
      </Prose>

      <Prose heading="How to tell whether a tool is uploading your file">
        <p>
          Fifteen seconds, no special knowledge. Open the page, press F12 for developer tools, go to
          the Network tab, then pick your file and run the tool.
        </p>
        <p>
          A tool that works locally shows nothing during processing: no request appears while the
          file is being read. A tool that uploads shows a request the size of your file, and you can
          watch it climb. Turning your network off entirely is the same test with a simpler
          readout — a local tool keeps working.
        </p>
      </Prose>
    </BlogPostPage>
  );
}
