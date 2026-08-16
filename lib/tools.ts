/**
 * The tools index.
 *
 * One entry per tool, read by /tools/, by the footer link and by the test that
 * checks every built route is in the sitemap. Adding a tool means adding a row
 * here and a page — nothing else knows the list.
 */

export interface ToolEntry {
  /** Path without the trailing slash; Next adds it, as everywhere else. */
  path: string;
  name: string;
  /** One line, shown on the index. */
  blurb: string;
}

export const TOOLS: readonly ToolEntry[] = [
  {
    path: '/tools/checksum',
    name: 'File hash & checksum generator',
    blurb:
      'Work out the SHA-256, SHA-1 or MD5 of a file and check it against the one the publisher gave you. The file is read in your browser and never uploaded.',
  },
  {
    path: '/tools/qr',
    name: 'QR code generator',
    blurb:
      'Make a QR code for text, a link or your Wi-Fi network, and download it as a PNG or an SVG. Nothing you type is sent anywhere.',
  },
  {
    path: '/tools/image-compress',
    name: 'Image compressor & resizer',
    blurb:
      'Shrink and resize photos, convert between JPEG, PNG and WebP, and take the set as a ZIP. Every image is processed on your own device.',
  },
  {
    path: '/tools/video-frames',
    name: 'Video frame extractor',
    blurb:
      'Pull JPEG stills out of a video at the frame rate you choose. No upload, so no size limit and no copy left on a server.',
  },
  {
    path: '/tools/split-file',
    name: 'File splitter & joiner',
    blurb:
      'Cut a file too big to email into .001/.002 parts, and join parts back. No size limit, and the parts work with cat, copy /b and 7-Zip.',
  },
];

export const TOOLS_INDEX_TITLE = 'Free file tools that run in your browser';
export const TOOLS_INDEX_DESCRIPTION =
  'Small, free utilities for working with files. Everything runs in your own browser — nothing is uploaded, and there is no account.';
