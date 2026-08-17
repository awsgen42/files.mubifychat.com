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
          Attachment limits are not really about your file. They are about a mail server deciding
          how much of its disk your message is allowed to occupy, and a messaging app deciding how
          much of its bandwidth a forward is worth. The number is a policy, so arguing with it does
          not work; you route around it instead.
        </p>
        <p>There are four ways round, and they fail in different places.</p>
      </Prose>

      <Prose heading="1. Send it to the other device directly">
        <p>
          If the file is going from your phone to your own laptop, or to someone sitting near you,
          the attachment limit is a detour. A transfer session moves the file once, without it
          becoming an email at all.
        </p>
        <p>
          That is what this site does: a six-digit code on one device, the same code on the other,
          and the file is available to fetch. Our own limits are 1 GB per file and 3 GB per session
          — real numbers rather than a marketing &ldquo;unlimited&rdquo;, and the session is deleted
          when it expires.
        </p>
        <p>
          The cost is that both ends have to be present at roughly the same time. It is a transfer,
          not a mailbox.
        </p>
      </Prose>

      <Prose heading="2. Split it into parts and send the parts">
        <p>
          The oldest answer and still the most robust, because it needs nothing from the recipient
          beyond the ability to receive several attachments. A 300 MB file becomes twelve 25 MB
          pieces that each fit an ordinary attachment.
        </p>
        <p>
          The pieces are raw byte ranges — <code>myfile.zip.001</code>, <code>.002</code>, and so on
          — which means the person at the other end does not need your tool, or any tool:
        </p>
        <Measured>{`cat myfile.zip.??? > myfile.zip            # macOS, Linux
copy /b myfile.zip.001+myfile.zip.002 myfile.zip   # Windows`}</Measured>
        <p>
          <Link href="/tools/split-file">Our splitter</Link> writes the parts straight to a folder
          you choose and adds an optional <code>.join.txt</code> beside them listing every part, its
          exact size, the SHA-256 of the original, and both of those commands. Nothing goes inside
          the parts themselves — that was a hard constraint, because the moment a tool writes its
          own header into the pieces, the recipient needs that tool.
        </p>
        <p>
          We tested that claim rather than asserting it: split a 300 MB file, delete the manifest,
          reassemble the parts with <code>cat</code> alone, and compare digests.
        </p>
        <Measured>{`source            314572800 bytes  80f34a13ce01fd002b19a039639a894cffe8a8b20140c636bdc2cebadfecad94
cat of the parts  314572800 bytes  80f34a13ce01fd002b19a039639a894cffe8a8b20140c636bdc2cebadfecad94`}</Measured>
        <p>
          The catch worth knowing: several small emails are more likely to be delivered than one
          large one, but a mail provider may still treat twelve messages in a row as a pattern worth
          slowing down. Send them over a few minutes rather than all at once.
        </p>
      </Prose>

      <Prose heading="3. Upload it somewhere and send a link">
        <p>
          Cloud storage is the default answer and it is a perfectly good one when the file is not
          sensitive and the recipient is happy to click through a consent screen.
        </p>
        <p>
          What you are trading is a copy. The file now exists on a third party&rsquo;s disk, under
          their retention policy, indexed under your account, for as long as they keep it — which is
          usually longer than the link is useful for. That is a reasonable trade for holiday photos
          and a poor one for a contract, a scan of a passport, or a database dump.
        </p>
      </Prose>

      <Prose heading="4. Put it on a USB stick — and the FAT32 trap">
        <p>
          Physical media has no size limit worth worrying about. The filesystem does. A USB stick
          formatted as FAT32 — which is most sticks, out of the box, because it is the only format
          every device reads — cannot hold a single file larger than 4 GB.
        </p>
        <p>
          The failure is confusing because the stick has plenty of space free and the copy simply
          refuses. Splitting fixes it: our part-size presets include a 2 GB option specifically for
          this, sized just under the FAT32 ceiling so each piece copies without complaint.
        </p>
      </Prose>

      <Prose heading="Which one to use">
        <p>
          <strong>Both devices are yours and to hand</strong> — send it directly; there is no reason
          for a copy to exist anywhere else.
        </p>
        <p>
          <strong>The recipient is elsewhere and the file is ordinary</strong> — a cloud link is the
          least friction, and the copy does not matter.
        </p>
        <p>
          <strong>The file is sensitive, or the recipient cannot install anything, or you are
          crossing a filesystem limit</strong> — split it. It is the only option on this list that
          works without a server holding your file at any point, and the only one where the
          recipient needs nothing but a shell command they already have.
        </p>
      </Prose>
    </BlogPostPage>
  );
}
