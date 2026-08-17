/**
 * The blog index.
 *
 * Five posts, and the number is the point rather than a starting position.
 * Thin pages scaled up are a demotion risk that lands on the whole domain,
 * and the tool pages are currently clean; each post here exists because it
 * says something the rest of the web does not, drawn from work that was
 * actually done and measured.
 *
 * This does not replace /snapdrop-alternative/ or
 * /send-files-between-different-networks/. Those are established URLs with
 * whatever authority they have accumulated, and moving them under /blog/ would
 * trade that for tidiness. They stay; new prose lands here.
 */

export interface BlogPost {
  slug: string;
  title: string;
  /** Shown on the index and used as the meta description. */
  description: string;
  /**
   * ISO date, written by hand and never touched again.
   *
   * The same reasoning as the sitemap's absent lastmod: a date that moves on
   * every deploy is a false claim about the content, and the cost of making
   * one is that the real ones stop being believed. If a post is substantially
   * revised, change this in that commit.
   */
  published: string;
  /** The tool the post is about; each links to the other. */
  tool: { path: string; name: string };
  /** One line on the index, under the title. */
  hook: string;
}

export const POSTS: readonly BlogPost[] = [
  {
    slug: 'how-to-open-a-001-file',
    title: 'How to open a .001 file',
    description:
      'A .001 file is one slice of a larger file. Here is how to tell a raw byte split from a multi-volume archive — they look identical from the filenames and need completely different handling — and how to put either back together.',
    published: '2026-08-17',
    tool: { path: '/tools/split-file', name: 'the file joiner' },
    hook: 'Why the usual advice about PK headers is wrong, and what actually distinguishes the two cases.',
  },
  {
    slug: 'send-a-file-too-big-for-email',
    title: 'How to send a file that is too big for WhatsApp or email',
    description:
      'Four ways to move a file that will not fit through an attachment limit, what each one costs you, and when splitting it into parts beats every alternative.',
    published: '2026-08-17',
    tool: { path: '/tools/split-file', name: 'the file splitter' },
    hook: 'Splitting, a transfer code, a cloud link, or a USB stick — and the FAT32 trap in the last one.',
  },
  {
    slug: 'verify-a-download-with-sha256',
    title: 'How to verify a download with SHA-256',
    description:
      'What a checksum actually proves, what it does not, and how to check one on Windows, macOS, Linux or in a browser — without uploading the file you are checking.',
    published: '2026-08-17',
    tool: { path: '/tools/checksum', name: 'the checksum tool' },
    hook: 'A digest published beside the download proves less than people think. Here is what it is good for.',
  },
  {
    slug: 'extract-frames-from-video-without-uploading',
    title: 'How to extract frames from a video without uploading it',
    description:
      'Pulling stills out of a video in the browser, why the format your camera produced may or may not work, and what the honest boundary is.',
    published: '2026-08-17',
    tool: { path: '/tools/video-frames', name: 'the frame extractor' },
    hook: 'Seeking lies, the first frame is often black, and codec support is a real limit rather than a bug.',
  },
  {
    slug: 'the-risk-of-uploading-files-to-online-tools',
    title: 'Why uploading your files to an online tool is a risk',
    description:
      'What actually happens to a file you hand to a free online converter, why "we delete after an hour" is unverifiable, and how to tell a tool that uploads from one that does not.',
    published: '2026-08-17',
    tool: { path: '/tools', name: 'the tools that do not upload' },
    hook: 'How to check for yourself, in about fifteen seconds, whether a page is sending your file anywhere.',
  },
];

export const BLOG_TITLE = 'Notes on moving files around';
export const BLOG_DESCRIPTION =
  'Occasional writing about file transfer, checksums, splitting and the things that go wrong with them — from the people who build the tools on this site.';

export function postBySlug(slug: string): BlogPost | undefined {
  return POSTS.find((post) => post.slug === slug);
}

/**
 * The posts that belong to a tool, for the link back from the tool page.
 *
 * Plural because the splitter has two: how to open a .001 file, and how to send
 * something too big to email. A singular lookup silently dropped the second,
 * which is the half of the internal linking that was the point.
 */
export function postsForTool(toolPath: string): BlogPost[] {
  return POSTS.filter((post) => post.tool.path === toolPath);
}

/** 17 August 2026 — written out, since 08/17 and 17/08 mean different things. */
export function formatPublished(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return `${day} ${months[month - 1]} ${year}`;
}
