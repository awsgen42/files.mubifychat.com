import type { Metadata } from 'next';
import Link from 'next/link';
import { BlogPostPage, Measured, Prose } from '@/components/BlogPost';
import { postBySlug } from '@/lib/blog';
import { pageMetadata } from '@/lib/seo';

const post = postBySlug('the-risk-of-uploading-files-to-online-tools')!;

export const metadata: Metadata = pageMetadata({
  path: `/blog/${post.slug}`,
  title: 'Why Uploading Your Files to an Online Tool Is a Risk',
  description: post.description,
});

export default function Page() {
  return (
    <BlogPostPage post={post}>
      <Prose>
        <p>
          You need to compress a PDF, split a video, or convert an image. You search, you find a
          free site, you drag your file in, you get your result. The whole thing takes forty
          seconds and nothing appears to go wrong.
        </p>
        <p>
          What happened underneath is that your file was copied to a server belonging to someone you
          have never heard of, in a jurisdiction you did not check, and processed by software you
          cannot see. Usually that is fine. The question is what you are relying on for it to be
          fine, and the answer is almost always: their word.
        </p>
      </Prose>

      <Prose heading="Why so many tools upload when they do not need to">
        <p>
          Most of what these sites do can be done in the browser. Hashing, splitting, resizing,
          converting between image formats, extracting video frames — all of it runs on the
          device, in every browser shipped in the last several years.
        </p>
        <p>They upload anyway, for reasons that have nothing to do with capability:</p>
        <p>
          <strong>It is easier to build.</strong> A server-side converter is a known quantity —
          spawn ffmpeg, return the output. The browser version means learning what the platform can
          do and handling the cases where it cannot.
        </p>
        <p>
          <strong>The file is the product.</strong> Not necessarily its contents — often just the
          fact that you have it. Upload volume is a metric, a reason to make you wait on a page with
          advertising, and a reason to ask for an email address to get your result.
        </p>
        <p>
          <strong>It enables the upsell.</strong> A size limit is a conversion funnel. If processing
          happened on your device there would be nothing to cap, which is inconvenient for a pricing
          page.
        </p>
      </Prose>

      <Prose heading="What &ldquo;we delete your files after an hour&rdquo; is worth">
        <p>
          It is worth something — it is a statement someone can be held to. It is not a technical
          guarantee, and it is not verifiable from outside.
        </p>
        <p>Between the upload finishing and the deletion running, the file exists:</p>
        <p>
          in the receiving server&rsquo;s memory and on its disk; probably in a load balancer or CDN
          buffer; in whatever object storage the app uses, where deletion may be a tombstone rather
          than an erase; in backups taken during that window, which have their own retention that
          nobody is promising to expire in an hour; and in logs, if anything logged more than a
          filename.
        </p>
        <p>
          None of that implies bad faith. It is what a normal, competently run web service looks
          like. The point is that &ldquo;deleted after an hour&rdquo; describes an intention about
          one of those copies, and you have no way to check any of them.
        </p>
        <p>
          The only version of this claim that survives scrutiny is the one where there was never a
          transfer.
        </p>
      </Prose>

      <Prose heading="When it actually matters">
        <p>
          Compressing a photo of your lunch: it does not matter, use whatever is convenient. This is
          not an argument that all uploads are reckless.
        </p>
        <p>It matters when the file is one of these, and people upload these constantly:</p>
        <p>
          a scanned passport or driving licence for a form; a bank statement being converted to
          CSV; a contract being merged or split; a database dump being compressed to email; medical
          images; anything covered by an NDA you signed; anything containing other people&rsquo;s
          personal data, where the exposure is not even yours to accept.
        </p>
        <p>
          For that last category, in many jurisdictions, handing the file to a third-party processor
          is a decision with legal weight — one that a free web tool&rsquo;s terms page is unlikely
          to have made you aware you were taking.
        </p>
      </Prose>

      <Prose heading="How to tell, in fifteen seconds">
        <p>
          You do not have to take anyone&rsquo;s word for it, including ours. Open developer tools
          with F12, go to the Network tab, then use the tool.
        </p>
        <p>
          <strong>A tool that uploads</strong> shows a request the size of your file, climbing. You
          can watch it.
        </p>
        <p>
          <strong>A tool that does not</strong> shows nothing at all during processing. Here is what
          we record on our own pages, capturing every request between pressing the button and the
          result appearing, on a 600 MB round trip:
        </p>
        <Measured>{`source            629145600 bytes  c4255503e1da1cf183273999ea8e9e393f71587fe9e75425b8bfaa4d11c6cb7e
result            629145600 bytes  c4255503e1da1cf183273999ea8e9e393f71587fe9e75425b8bfaa4d11c6cb7e
requests during processing: 0 (none)`}</Measured>
        <p>
          The stronger version of the test takes no tools at all: load the page, turn your network
          off, then use it. A local tool carries on. An uploader stops.
        </p>
      </Prose>

      <Prose heading="What we do, and where the line is">
        <p>
          <Link href="/tools">The tools on this site</Link> — checksums, image compression, video
          frames, splitting and joining — run entirely in your browser. There is no upload endpoint
          for them to use.
        </p>
        <p>
          The transfer feature is different and it would be dishonest to blur them. Sending a file
          from your phone to your laptop requires the file to go somewhere both can reach. It is
          stored, briefly, and deleted when the session expires — and it is subject to exactly the
          argument above: you have our word for the deletion, and words are what they are.
        </p>
        <p>
          The difference is that the transfer needs a server to do its job at all, and a checksum
          tool does not. When a task can be done on your device, doing it anywhere else is a choice
          made for the site&rsquo;s benefit rather than yours.
        </p>
      </Prose>
    </BlogPostPage>
  );
}
