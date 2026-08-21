import type { Metadata } from 'next';
import Link from 'next/link';
import { BlogPostPage, Measured, Prose } from '@/components/BlogPost';
import { postBySlug } from '@/lib/blog';
import { pageMetadata } from '@/lib/seo';

const post = postBySlug('send-a-file-too-big-for-email')!;

export const metadata: Metadata = pageMetadata({
  path: `/blog/${post.slug}`,
  title: 'How to Send a File Too Big for WhatsApp or Email',
  description: post.description,
});

export default function Page() {
  return (
    <BlogPostPage post={post}>
      <Prose>
        <p>
          Cut the file into numbered parts and send the parts. It is the only route that needs
          nothing from the person receiving it — no account, no app, no upload to a third party —
          and it works on any file of any size.
        </p>
        <p>
          There are three other routes and they are each better in specific situations. Here is what
          every one of them actually costs you.
        </p>
      </Prose>

      <Prose heading="Split it into parts">
        <p>
          A 300 MB video becomes twelve 25 MB pieces, and twelve 25 MB attachments go through where
          one 300 MB attachment does not. The pieces are raw byte ranges named{' '}
          <code>video.mp4.001</code>, <code>video.mp4.002</code> and so on.
        </p>
        <p>
          The thing that makes this route good is that the recipient does not need your tool, or any
          tool. One command:
        </p>
        <Measured>{`cat video.mp4.??? > video.mp4                          # macOS, Linux
copy /b video.mp4.001+video.mp4.002 video.mp4          # Windows`}</Measured>
        <p>
          That is a claim worth testing rather than repeating, so we test it on every change: split a
          file with our tool, throw away everything the tool wrote except the numbered parts,
          reassemble them with <code>cat</code>, and compare digests against the original.
        </p>
        <Measured>{`source            629145600 bytes  c4255503e1da1cf183273999ea8e9e393f71587fe9e75425b8bfaa4d11c6cb7e
joined with cat   629145600 bytes  c4255503e1da1cf183273999ea8e9e393f71587fe9e75425b8bfaa4d11c6cb7e`}</Measured>
        <p>
          Nothing is added to the parts — no header, no index — which is what keeps that true. If a
          splitter writes its own marker into the pieces, you have quietly made the recipient
          dependent on that splitter.
        </p>
        <p>
          <Link href="/tools/split-file">The splitter here</Link> runs in the browser, so the file is
          never uploaded and its size is not a constraint. The limitation, since it decides whether
          the route is available to you: writing parts straight into a folder needs Chrome or Edge on
          a computer. Firefox and Safari cannot do that, so there each part arrives as a separate
          download with a click for each — workable for four parts, tedious for forty.
        </p>
        <p>
          The mild annoyance of this route is that several small emails in quick succession can look
          to a mail provider like a pattern worth slowing down. Send them over a few minutes rather
          than all at once.
        </p>
      </Prose>

      <Prose heading="Send it straight to the other device">
        <p>
          If the file is going from your phone to your own laptop, or to someone in the same room,
          turning it into an email attachment is a detour. A transfer session moves it once: a
          six-digit code on one device, the same code on the other.
        </p>
        <p>
          Being direct about what this is, because the rest of this site argues that uploads are a
          cost: <strong>this one is an upload.</strong> The file goes to storage both devices can
          reach and is deleted when the session expires — 15 minutes of inactivity, 24 hours
          maximum. Our limits are 1 GB per file and 3 GB per session, which are real numbers rather
          than an &ldquo;unlimited&rdquo; that means something smaller.
        </p>
        <p>
          Unlike splitting or hashing, this task cannot be done locally: something in the middle has
          to hold the bytes until the second device asks for them. That is the difference between a
          transfer and a tool, and it is why the tools on this site upload nothing and the transfer
          does.
        </p>
      </Prose>

      <Prose heading="Upload it and send a link">
        <p>
          Cloud storage is the default answer and it is the right one more often than this site&rsquo;s
          usual argument suggests. If the file is not sensitive and the recipient is happy to click
          through a consent screen, a link is the least friction available.
        </p>
        <p>
          What you are paying is a copy. The file now sits on a third party&rsquo;s disk, under their
          retention policy, attached to your account, for considerably longer than the link stays
          useful. That is a fine trade for holiday photos and a poor one for a contract, a scan of a
          passport, or a database dump.
        </p>
      </Prose>

      <Prose heading="Put it on a USB stick, and watch for FAT32">
        <p>
          Physical media has no size limit worth worrying about. The filesystem does, and this is the
          one that catches people: a stick formatted as FAT32 cannot hold a single file larger than
          4 GB, no matter how empty it is.
        </p>
        <p>
          The failure is baffling in the moment — 200 GB free, and the copy just refuses. Most sticks
          ship as FAT32 because it is the format every device reads, so this is common rather than
          exotic. Splitting fixes it, and our part-size presets include a 2 GB option sized under the
          ceiling for exactly this.
        </p>
      </Prose>

      <Prose heading="Which one I would use">
        <p>
          <strong>Both devices are mine and to hand:</strong> send it directly. There is no reason
          for a copy to exist on a stranger&rsquo;s disk for a file that is going three feet.
        </p>
        <p>
          <strong>Ordinary file, recipient elsewhere:</strong> a cloud link. The copy does not matter
          and it is the least work for both of you.
        </p>
        <p>
          <strong>Sensitive, or crossing a filesystem limit, or the recipient cannot install
          anything:</strong> split it. It is the only route on this list where the file never
          reaches a server at any point, and the only one where the person at the other end needs
          nothing they do not already have.
        </p>
        <p>
          One thing I would not bother with: the &ldquo;just zip it&rdquo; suggestion that appears in
          most answers to this question. Video, photos and PDFs are already compressed, so there is
          nothing left for ZIP to find. Measured on a video and a log file of comparable
          pointlessness and usefulness:
        </p>
        <Measured>{`clip.webm   5,020,668 -> 5,021,289 bytes   0.0% saved (the ZIP is 621 bytes bigger)
log.txt     2,360,000 ->     7,105 bytes  99.7% saved`}</Measured>
        <p>
          Zipping media buys you nothing and costs the recipient a step. Zipping text, spreadsheets
          or a folder of many small files is transformative. Know which one you are holding.
        </p>
      </Prose>
    </BlogPostPage>
  );
}
