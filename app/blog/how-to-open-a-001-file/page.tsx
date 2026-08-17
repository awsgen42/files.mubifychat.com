import type { Metadata } from 'next';
import Link from 'next/link';
import { BlogPostPage, Measured, Prose } from '@/components/BlogPost';
import { postBySlug } from '@/lib/blog';
import { pageMetadata } from '@/lib/seo';

const post = postBySlug('how-to-open-a-001-file')!;

export const metadata: Metadata = pageMetadata({
  path: `/blog/${post.slug}`,
  title: 'How to Open a .001 File — raw split or archive, and how to tell',
  description: post.description,
});

export default function Page() {
  return (
    <BlogPostPage post={post}>
      <Prose>
        <p>
          A file ending in <code>.001</code> is not a format. It is the first slice of something
          larger that was cut into numbered pieces so each piece would fit through an email, an
          upload form, or a FAT32 drive. Nothing will open it on its own, because on its own it is
          the first n bytes of a file and nothing else.
        </p>
        <p>
          Put the pieces back in order and you get the original — which is then whatever it always
          was. Usually that turns out to be a ZIP, an MKV or an installer.
        </p>
      </Prose>

      <Prose heading="There are two completely different things called a .001 file">
        <p>
          This is the part almost nothing on the web gets right, and it is the whole reason people
          end up with a file that will not open.
        </p>
        <p>
          <strong>A raw byte split</strong> cuts a file at fixed offsets. Part 001 is bytes 0 to
          25,165,824, part 002 continues from there, and none of the parts knows anything about the
          others. Concatenating them in order reproduces the original exactly. This is what{' '}
          <code>split</code>, HJSplit, and the tool on this site produce.
        </p>
        <p>
          <strong>A multi-volume archive</strong> is a different animal. RAR&rsquo;s{' '}
          <code>.part1.rar</code>, ZIP&rsquo;s <code>.z01</code>, and archives written with a volume
          size are sequences of independently framed containers. Each volume has its own header.
          Concatenating them produces garbage, in any order, because you end up with headers
          embedded in the middle of the data stream.
        </p>
        <p>
          From the filenames alone the two are indistinguishable. 7-Zip will happily write{' '}
          <code>archive.7z.001</code>, <code>archive.7z.002</code> — and <em>those</em> are a raw
          split of the <code>.7z</code> container, so they do join with <code>cat</code>. The
          extension tells you nothing.
        </p>
      </Prose>

      <Prose heading="The advice you will find, and why it is wrong">
        <p>
          The rule repeated across forums and articles is: look at the first bytes of part 001, and
          if you see an archive signature — <code>PK</code> for ZIP, <code>Rar!</code> for RAR,{' '}
          <code>7z</code> for 7-Zip — then it is an archive and you must not join it raw.
        </p>
        <p>
          That rule is wrong, and it is wrong in the direction that hurts most. The commonest thing
          anyone splits <em>is</em> a ZIP. A raw byte split of <code>photos.zip</code> begins with{' '}
          <code>PK\x03\x04</code> for the simple reason that <code>photos.zip</code> begins with it.
          Follow the rule and you refuse the join that works.
        </p>
        <p>
          What actually separates the two cases is whether the signature <em>repeats</em>. A raw
          split has a file header at the very front and nowhere else; every later part starts
          mid-stream, on whatever byte happened to fall at the boundary. A genuine multi-volume
          archive has a header at the front of <em>every</em> volume, because every volume is its
          own container.
        </p>
        <p>
          So the test is on the first two parts together, and that is what{' '}
          <Link href="/tools/split-file">our joiner</Link> does before it writes a byte:
        </p>
        <Measured>{`classifyParts(zipHeader, midStreamBytes) -> { kind: 'raw',        container: 'ZIP' }   joins fine
classifyParts(zipHeader, zipHeader)      -> { kind: 'structured', container: 'ZIP' }   refuses
classifyParts(rarHeader, rarHeader)      -> { kind: 'structured', container: 'RAR' }   refuses
classifyParts(midStream, midStream)      -> { kind: 'raw',        container: null }    joins fine`}</Measured>
        <p>
          If it is the structured kind you are told to open the first volume with 7-Zip or The
          Unarchiver, which finds the rest itself. That is a thing a tool can do by reading eight
          bytes and an article cannot do at all.
        </p>
      </Prose>

      <Prose heading="Joining a raw split, three ways">
        <p>
          <strong>On macOS or Linux</strong>, one command, and the glob is safe because the numbers
          are zero-padded to a fixed width — lexical order and numeric order agree while that holds:
        </p>
        <Measured>{`cat movie.mkv.??? > movie.mkv`}</Measured>
        <p>
          <strong>On Windows</strong>, the explicit list. Do not use a wildcard here:{' '}
          <code>copy /b</code> with one orders by directory order rather than by name, which is
          usually right and occasionally silently is not.
        </p>
        <Measured>{`copy /b movie.mkv.001+movie.mkv.002+movie.mkv.003 movie.mkv`}</Measured>
        <p>
          <strong>In a browser</strong>, if you would rather not use a terminal, drop the parts into{' '}
          <Link href="/tools/split-file">the joiner</Link>. Nothing is uploaded — the parts are read
          from your disk and the result is written back to it.
        </p>
      </Prose>

      <Prose heading="The order matters more than people expect">
        <p>
          Sorting the parts by name is correct exactly while the numbering stays the same width. A
          set that runs past <code>.999</code> into <code>.1000</code> sorts wrongly by name, and so
          does anything from a tool that did not pad at all — <code>.1</code>, <code>.2</code>,{' '}
          <code>.10</code> sorts as <code>.1</code>, <code>.10</code>, <code>.2</code>.
        </p>
        <p>
          The failure mode is the nasty one: the output is exactly the right size, no error is
          raised, and the file is corrupt. We sabotaged our own joiner to skip the numeric sort to
          see what a user would actually get from a 24-part, 600 MB set:
        </p>
        <Measured>{`unsorted : 629145600 bytes  d2fdbc04f3743db61f664ec8fe3f501130f20d8c42a350647e044498e59c506e
sorted   : 629145600 bytes  c4255503e1da1cf183273999ea8e9e393f71587fe9e75425b8bfaa4d11c6cb7e
           ^ same size, different bytes, no error anywhere`}</Measured>
        <p>
          Which is why a missing part is refused by name before anything is written, rather than
          discovered afterwards as a file that will not open.
        </p>
      </Prose>

      <Prose heading="If the parts are large">
        <p>
          Most browser-based joiners assemble the whole output in memory and then hand it over, so
          they stop working somewhere below the size of your RAM — which is unfortunate, given that
          files big enough to be split are exactly the ones this matters for.
        </p>
        <p>
          Where the File System Access API exists — Chrome and Edge on a computer — a joiner can
          stream to disk instead and never hold the result at all. We measured ours with the whole
          browser confined to a 2 GB memory cap, joining a 4 GB file:
        </p>
        <Measured>{`source 4.00 GB | hard cap 2.00 GB

streaming join   4.0 GB written, 147s, digest matches the source
in-memory join   renderer killed after 464s`}</Measured>
        <p>
          Firefox and Safari do not implement that yet, so there the file is built in memory and
          handed over as a download — fine for ordinary sizes, and the practical ceiling is your
          RAM. The page tells you which of the two you are getting before you choose a file.
        </p>
      </Prose>
    </BlogPostPage>
  );
}
