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
          That works for nearly every <code>.001</code> set, including the ones 7-Zip produces.
          There is one shape it does not work for, which takes ten seconds to rule out.
        </p>
      </Prose>

      <Prose heading="Check which kind you have">
        <p>
          Almost everything numbered <code>.001</code> is a raw byte split: a file cut at fixed
          offsets with nothing added. That includes 7-Zip&rsquo;s own volume option, which is worth
          saying because people assume an archive tool must have wrapped something. It does not —
          we joined a <code>7z a -v1m</code> set with plain <code>cat</code> and the result passed{' '}
          <code>7z t</code> and extracted to the original file&rsquo;s digest.
        </p>
        <p>
          The exception is a ZIP written by <code>zip -s</code>. Its first volume opens with a
          four-byte spanning marker, and concatenating the volumes shifts every offset recorded
          inside the archive by those four bytes. Those sets are normally named{' '}
          <code>.z01</code> / <code>.z02</code> / <code>.zip</code> rather than <code>.001</code>,
          so you are unlikely to meet one here — but if the names have been changed along the way,
          this is the case to catch.
        </p>
        <p>
          A true multi-volume RAR is a separate thing again, and it announces itself in the name:{' '}
          <code>.part1.rar</code>, <code>.part2.rar</code>. Open the first one with 7-Zip or WinRAR
          and it finds the rest itself.
        </p>
        <p>Look at the first bytes. Any Unix machine can do this without installing anything:</p>
        <Measured>{`$ od -A n -t x1z -N 8 volz.zip.001      # 7-Zip ZIP volumes
   50 4b 03 04 0a 00 00 00    >PK......<     joins fine
$ od -A n -t x1z -N 8 vol.7z.001       # 7-Zip .7z volumes
   37 7a bc af 27 1c 00 04    >7z..'...<     joins fine
$ od -A n -t x1z -N 8 span.z01         # zip -s spanned archive
   50 4b 07 08 50 4b 03 04    >PK..PK..<     does NOT join`}</Measured>
        <p>
          Those are real files, made with <code>7z</code> and <code>zip</code> and read back with{' '}
          <code>od</code>. Note the last one: <code>50 4b 07 08</code> is the spanning marker, and
          it is the <em>only</em> one of these that means &ldquo;do not concatenate&rdquo;. Here is
          what happens if you ignore it — three tools, three different reactions:
        </p>
        <Measured>{`$ cat span.z01 span.z02 span.zip > catspan.zip
7-Zip           ERROR = Missing volume : catspan.z01
python zipfile  opens, and testzip() reports payload.bin corrupt
unzip           bad zipfile offset (local header sig), exit 2,
                then re-compensates and extracts anyway`}</Measured>
        <p>
          Which brings up the advice you will find everywhere else, and which is wrong: &ldquo;if
          part 001 starts with PK, it is an archive, so do not join it&rdquo;. Splitting a ZIP is
          the single most common reason a <code>.001</code> file exists, and 7-Zip&rsquo;s own
          volumes start with PK too. Follow that rule and you refuse the join that works.
        </p>
        <p>
          A signature in part 001 tells you what the original file was. Apart from that one
          four-byte marker, it does not tell you how the pieces were made.
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
          sorts numerically, refuses a set with a gap, and tells you what you are holding before it
          writes anything. Nothing is uploaded.
        </p>
        <p>
          If the names are <code>.part1.rar</code> or <code>.z01</code>, do not join anything. Put
          the volumes in one folder and open the first <code>.rar</code> — or the <code>.zip</code>{' '}
          — with 7-Zip, which finds the others itself.
        </p>
      </Prose>
    </BlogPostPage>
  );
}
