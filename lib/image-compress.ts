/**
 * Copy for /tools/image-compress. The FAQ lives here so the rendered <dl> and
 * the FAQPage JSON-LD read from one array and cannot drift — the same
 * arrangement as lib/checksum.ts, lib/qr.ts and the prose pages.
 */

import type { FaqEntry } from './faq';

export const HOW_IT_WORKS: readonly { title: string; body: string }[] = [
  {
    title: 'Start with quality, not size.',
    body: 'For photographs, 70–80% is usually indistinguishable from the original at normal viewing size and often a fraction of the file. Drop it further only if the result still looks right to you — the preview here is the real output, not an approximation.',
  },
  {
    title: 'Resize before you compress.',
    body: 'Most oversized images are oversized in dimensions, not in quality. A 4000-pixel photo shown 800 pixels wide is carrying five times the pixels anyone will see; setting a maximum edge usually saves more than any quality setting.',
  },
  {
    title: 'Pick the format for the job.',
    body: 'WebP is smaller than JPEG at the same quality and is supported everywhere that matters now. JPEG is the safest choice for anything that has to be opened by old software. Keep original is right when you only wanted to resize.',
  },
  {
    title: 'Check the saving before you use it.',
    body: 'Every image here shows its old and new size. If re-encoding made a file bigger — which happens with images that were already optimised — you are given the original back rather than a worse version of it.',
  },
];

export const LIMITS_NOTE =
  'Compression here is lossy for JPEG and WebP: the file gets smaller because information is discarded, and it cannot be recovered by re-saving at a higher quality later. Keep your originals. Editing metadata is out of scope — re-encoding drops EXIF data such as camera model and GPS location, which is often welcome before sharing a photo but is worth knowing about if you rely on it.';

export const IMAGE_FAQ: readonly FaqEntry[] = [
  {
    q: 'Are my images uploaded anywhere?',
    a: 'No. Every image is read, resized and re-encoded by your own browser, on your device. Nothing is sent to us or to anyone else, and no request leaves the page while it works. You can disconnect from the network and the tool still works.',
  },
  {
    q: 'Will my photos come out rotated?',
    a: 'No. Photos from a phone usually store the picture the way the sensor saw it plus a tag saying which way up it is, and re-encoding normally discards that tag — which is why so many compressed photos end up on their side. This tool reads the tag and rotates the pixels themselves before encoding, so the result is upright everywhere.',
  },
  {
    q: 'What happens to transparency if I choose JPEG?',
    a: 'JPEG cannot store transparency. Where a transparent image is converted to JPEG, the see-through areas are filled with white and the image is marked as flattened so you know it happened. Left to itself a browser fills them with black, which turns a transparent logo into a black rectangle. Choose WebP or keep the original format to preserve transparency.',
  },
  {
    q: 'Why is my compressed file bigger than the original?',
    a: 'Because the original was already efficient. Re-encoding an optimised PNG, or a JPEG that was saved at a lower quality than you have selected, adds bytes rather than removing them. When that happens you are given the original file back instead, and the result is labelled so you can see why.',
  },
  {
    q: 'Is there a limit on image size?',
    a: 'Browsers cap how large a canvas can be — around 16.7 million pixels on iOS — and past that some of them return a blank image rather than an error. Anything larger is scaled down to fit before processing, and the output is checked for being blank before it is offered to you, so you will never be handed an empty file that looks like a good result.',
  },
  {
    q: 'Can I compress several images at once?',
    a: 'Yes. Add as many as you like and they are processed one after another rather than all together, which keeps memory use flat no matter how many you add. Download them individually, or take the whole set as a single ZIP.',
  },
];
