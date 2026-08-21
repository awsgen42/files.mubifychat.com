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
          Run one command on the file you downloaded and compare the result to the digest the
          publisher listed. If the two strings are identical, your copy is byte-for-byte what they
          released.
        </p>
        <Measured>{`certutil -hashfile installer.exe SHA256      # Windows
shasum -a 256 installer.dmg                  # macOS
sha256sum installer.iso                      # Linux`}</Measured>
        <p>
          Compare the whole string. Checking that it starts with <code>a3f9</code> and ends with{' '}
          <code>c21b</code> is not a comparison — those are the characters anyone bothering to forge
          a digest would keep.
        </p>
      </Prose>

      <Prose heading="What this does and does not prove">
        <p>
          Start with the part that gets skipped, because it decides whether the exercise was worth
          anything.
        </p>
        <p>
          <strong>If the digest was printed on the same page as the download link, you have proved
          very little.</strong> Anyone able to replace the file could edit the line above it in the
          same breath. What you have confirmed is that the page is internally consistent, which was
          not the question.
        </p>
        <p>
          A digest is worth something when it reaches you by a different route than the file: a
          signed release note, a distribution&rsquo;s package index, a repository you already trust,
          a message from the person who built it. Same page as the download, same trust as the
          download.
        </p>
        <p>
          What it does prove, reliably and every time, is that the file arrived intact. A truncated
          transfer, a proxy that mangled something, a disk that flipped a bit — all caught. That is
          the everyday use, it is a real one, and it is most of why you would bother.
        </p>
        <p>
          It says nothing about whether the file is safe. A matching digest on malware confirms you
          have exactly the malware the publisher shipped.
        </p>
      </Prose>

      <Prose heading="Doing it without a terminal">
        <p>
          Most &ldquo;online SHA-256&rdquo; tools upload your file to compute it. For a public
          installer that is merely pointless. For anything you would not email to a stranger it is
          worse, because you have now handed a third party a copy in order to check a hash.
        </p>
        <p>
          There is no technical reason for it. Browsers can hash a file locally, reading it from disk
          in windows so the file is never held whole in memory. <Link href="/tools/checksum">Ours
          does that</Link> for SHA-256, SHA-1 and MD5, and you paste the published digest in so the
          comparison is done for you rather than by eye.
        </p>
        <p>
          Checked against coreutils on the same 300 MB file, with every network request between
          choosing the file and the answer appearing recorded:
        </p>
        <Measured>{`SHA-256   9c1da030258f5ea3d10c57a59649029ba7bc18c965caedccbd1ca847bce01834
SHA-1     6942871ad3e5fdec1000873f23d6cb266b80c3b8
MD5       68e4e59f7259570a7edc2376bc48e38d
requests while hashing: 0`}</Measured>
      </Prose>

      <Prose heading="A wrong digest is worse than no digest">
        <p>
          A checksum tool that returns a plausible but incorrect value is actively harmful. It will
          tell you a good download is corrupt, and — far worse — it can agree with a published digest
          while your file differs.
        </p>
        <p>
          So each implementation is tested against the published vectors from RFC 1321, RFC 3174 and
          FIPS 180-4. That is table stakes and proves less than it looks: a test suite only tells you
          something if you have checked it can fail. So each hash was deliberately broken to watch
          the tests go red.
        </p>
        <p>
          The sabotage worth showing is MD5&rsquo;s padding. Every one of these algorithms finishes by
          appending the message length as a 64-bit field, and swapping its two halves is the kind of
          mistake that produces output looking exactly like a normal MD5 — right length, right
          character set, completely wrong:
        </p>
        <Measured>{`MD5("abc")  correct              900150983cd24fb0d6963f7d28e17f72
MD5("abc")  length word swapped  c79b6f2bcb046d747baab534d067dabb`}</Measured>
        <p>
          Nothing about the second value announces itself as broken. Only a test comparing against a
          known answer catches it, which is the entire argument for having one.
        </p>
      </Prose>

      <Prose heading="SHA-1 and MD5 are still there, and you should know why">
        <p>
          Publishers still list them, so a tool that refuses to compute them just sends you
          elsewhere. But they are not interchangeable with SHA-256 and it is worth being blunt about
          which job each one can do.
        </p>
        <p>
          For detecting accidental corruption — the truncated download, the bad disk — MD5 and SHA-1
          are completely adequate. For detecting deliberate tampering, both are broken: MD5
          thoroughly and for a long time, SHA-1 in practice as well. If someone might be trying to
          fool you, the SHA-256 line is the only one that means anything, and a page offering only
          an MD5 is telling you something about how much attention it pays.
        </p>
      </Prose>

      <Prose heading="Checking whether a tool uploads your file">
        <p>
          Fifteen seconds, and it works on any tool including this one. Open the page, press F12,
          switch to the Network tab, then choose your file.
        </p>
        <p>
          A local tool shows nothing at all while it works. An uploader shows a request the size of
          your file, and you can watch the bar climb.
        </p>
        <p>
          The simpler version needs no developer tools: load the page, turn off your network, then
          use it. Local tools carry on. Uploaders stop.
        </p>
      </Prose>
    </BlogPostPage>
  );
}
