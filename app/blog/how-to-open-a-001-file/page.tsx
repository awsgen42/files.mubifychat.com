import type { Metadata } from 'next';
import Link from 'next/link';
import { BlogPostPage, Measured, Prose } from '@/components/BlogPost';
import { postBySlug } from '@/lib/blog';
import { pageMetadata } from '@/lib/seo';

const post = postBySlug('how-to-open-a-001-file')!;

export const metadata: Metadata = pageMetadata({
  path: `/blog/${post.slug}`,
  title: 'How to Open a .001 File',
  description: post.description,
});

export default function Page() {
  return (
    <BlogPostPage post={post}>
      <Prose>
        <p>
          A <code>.001</code> file is one slice of a bigger file that was cut into numbered pieces.
          Join the pieces back in order and you get the original — a video, a ZIP, an installer —
          which then opens like anything else.
        </p>
        <p>On macOS or Linux, one command does it:</p>
        <Measured>{`cat movie.mkv.??? > movie.mkv`}</Measured>
        <p>On Windows:</p>
        <Measured>{`copy /b movie.mkv.001+movie.mkv.002+movie.mkv.003 movie.mkv`}</Measured>
        <p>
          The <code>???</code> glob is safe because the numbers are zero-padded to a fixed width, so
          the shell expands them in the right order. Do not use a wildcard with{' '}
          <code>copy /b</code> — it orders by directory order rather than by name, which is usually
          the same thing and occasionally silently is not.
        </p>
        <p>
          That works for most <code>.001</code> sets. Spend ten seconds on the next part first,
          because there is a second kind that those commands quietly ruin.
        </p>
      </Prose>

      <Prose heading="Check which kind you have">
        <p>
          <strong>A raw byte split</strong> cuts a file at fixed offsets and adds nothing. Part 001
          is the first n bytes, part 002 carries on from there. Concatenating them reproduces the
          original exactly.
        </p>
        <p>
          <strong>A multi-volume archive</strong> is a set of containers that a program wrote and
          expects to read back itself. Concatenating those gives you a broken file.
        </p>
        <p>
          The names usually tell you. <code>.001</code>, <code>.002</code> and{' '}
          <code>file.7z.001</code> are raw splits. <code>.part1.rar</code> / <code>.part2.rar</code>{' '}
          and <code>.z01</code> / <code>.z02</code> / <code>.zip</code> are multi-volume archives —
          open the first one with 7-Zip or The Unarchiver and it finds the rest itself.
        </p>
        <p>
          When the names are ambiguous, look at the first bytes. Any Unix machine can do this
          without installing anything:
        </p>
        <Measured>{`$ od -A n -t x1z -N 8 archive.zip.001
   50 4b 03 04 14 00 00 00    >PK......<
$ od -A n -t x1z -N 8 archive.zip.002
   ba b7 8f ea fd e7 81 77    >.......w<`}</Measured>
        <p>
          That is a real raw split of a ZIP. Part 001 starts with <code>PK</code> because the ZIP
          does; every later part starts mid-stream, on whatever byte fell at the boundary.{' '}
          <code>Rar!</code> and <code>7z</code> are the equivalent markers for those formats.
        </p>
        <p>
          Which brings up the advice you will find everywhere else, and which is wrong: &ldquo;if
          part 001 starts with PK, it is a ZIP archive, so do not join it&rdquo;. Splitting a ZIP is
          the single most common reason a <code>.001</code> file exists. Follow that rule and you
          refuse the join that works. We reassembled the set above with <code>cat</code> and checked
          it properly:
        </p>
        <Measured>{`$ cat archive.zip.??? > rejoined.zip
$ sha256sum archive.zip rejoined.zip
  97ca7bc37adffec5fe4015ed183553d8…  archive.zip
  97ca7bc37adffec5fe4015ed183553d8…  rejoined.zip
$ unzip -t rejoined.zip
  No errors detected in compressed data of rejoined.zip.`}</Measured>
        <p>
          A header in part 001 tells you what the original file was. It does not tell you how the
          pieces were made.
        </p>
      </Prose>

      <Prose heading="Order, and the way it fails">
        <p>
          Sorting by filename is correct only while the numbering stays the same width. A set
          running past <code>.999</code> into <code>.1000</code> sorts wrongly by name, and so does
          anything from a tool that did not pad — <code>.1</code>, <code>.2</code>, <code>.10</code>{' '}
          sorts as <code>.1</code>, <code>.10</code>, <code>.2</code>.
        </p>
        <p>
          The output is then exactly the right size and completely wrong, with no error anywhere. We
          broke the sort in our own joiner to see what a user would actually get from a 24-part,
          600 MB set:
        </p>
        <Measured>{`unsorted  629145600 bytes  d2fdbc04f3743db61f664ec8fe3f501130f20d8c42a350647e044498e59c506e
sorted    629145600 bytes  c4255503e1da1cf183273999ea8e9e393f71587fe9e75425b8bfaa4d11c6cb7e`}</Measured>
        <p>
          Same size, different file. If a part is missing entirely you get the same silence, which
          is why the joiner here refuses and names the gap instead of writing anything.
        </p>
      </Prose>

      <Prose heading="Joining in a browser, and where that breaks">
        <p>
          The limitation first, because it decides whether this is worth your time: only Chrome and
          Edge on a computer can stream the result to disk. In Firefox and Safari the whole joined
          file has to be built in memory before it can be handed to you, so a set adding up to more
          than a few gigabytes will fail there. That is not our choice — the File System Access API
          does not exist in those browsers yet.
        </p>
        <p>
          It is also why most browser-based joiners fall over on large sets: they build the output
          in memory as a matter of design, so they stop working somewhere below the size of your
          RAM — which is unfortunate, because files big enough to be split are exactly the ones
          this matters for.
        </p>
        <p>
          Measured on the same 300 MB of parts, through the same harness, our streaming join against
          a conventional in-memory one:
        </p>
        <Measured>{`streaming to disk    grew  70 MB  (0.23× the payload)
built in memory      grew 360 MB  (1.20× the payload)`}</Measured>
        <p>
          Pushed further, with the whole browser confined to a hard 2 GB memory cap and a 4 GB file:
          the streaming join finished in 147 seconds with a digest matching the source, and the
          in-memory version killed the renderer after 464 seconds.
        </p>
      </Prose>

      <Prose heading="What I would actually do">
        <p>
          If you have a terminal, use <code>cat</code>. It is one line, it is instant, and there is
          no tool between you and your file.
        </p>
        <p>
          If you are on Windows without a terminal habit, or you would rather see the parts checked
          before anything is written,{' '}
          <Link href="/tools/split-file">the joiner on this site</Link> does it in the browser — it
          sorts numerically, refuses a set with a gap, and tells you if the parts look like an
          archive rather than a raw split. Nothing is uploaded.
        </p>
        <p>
          If the names are <code>.part1.rar</code> or <code>.z01</code>, do not join anything. Open
          the first file with 7-Zip.
        </p>
      </Prose>
    </BlogPostPage>
  );
}
