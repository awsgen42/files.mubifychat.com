/**
 * Copy for /tools/checksum. The FAQ lives here so the rendered <dl> and the
 * FAQPage JSON-LD read from one array and cannot drift — the same arrangement
 * as lib/snapdrop.ts and lib/networks.ts.
 */

import type { FaqEntry } from './faq';

export const VERIFY_STEPS: readonly { title: string; body: string }[] = [
  {
    title: 'Find the hash the publisher gave you.',
    body: 'It is usually next to the download link, or in a file called SHA256SUMS, checksums.txt or similar. If the project offers a choice, take the SHA-256 — it is the one worth trusting.',
  },
  {
    title: 'Hash the file you actually downloaded.',
    body: 'Drop it into the box above. Nothing is sent anywhere; your browser reads the file off your disk and does the arithmetic locally.',
  },
  {
    title: 'Paste the published hash into the compare box.',
    body: 'You can paste the whole line from a checksums file — the hash is picked out of it. Case does not matter.',
  },
  {
    title: 'Match means the bytes are identical.',
    body: 'Not one bit differs from what the publisher hashed. No match means the file you have is not that file: an interrupted download, a mirror serving something stale, or in the worst case something you should not run.',
  },
];

export const LIMITS_NOTE =
  'A hash tells you whether two files are byte-for-byte the same. It cannot tell you whether the publisher is trustworthy, and it is only as good as where you got the expected hash from — if both the file and the hash come from the same compromised page, they will agree with each other. For downloads where that matters, prefer a signature over a checksum.';

export const CHECKSUM_FAQ: readonly FaqEntry[] = [
  {
    q: 'Is my file uploaded anywhere?',
    a: 'No. The file is read by your own browser and hashed on your device. There is no upload, no server request, and no copy of it anywhere but your disk. You can disconnect from the network and the tool still works.',
  },
  {
    q: 'How large a file can I hash?',
    a: 'There is no fixed limit. The file is read in small pieces rather than loaded into memory all at once, so a multi-gigabyte file uses about as much memory as a small one. Very large files simply take longer.',
  },
  {
    q: 'Which algorithm should I use?',
    a: 'SHA-256 unless the publisher gave you something else. SHA-1 and MD5 are offered because a great deal of software still publishes them, but both are broken against a deliberate attacker: they will tell you a download is not corrupted, and they will not tell you that nobody tampered with it.',
  },
  {
    q: 'The hash does not match. What does that mean?',
    a: 'The file you have is not the file the publisher hashed. The usual cause is a download that was interrupted or a mirror serving an older build, so downloading again is the first thing to try. If a fresh download from the official source still does not match, do not run the file.',
  },
  {
    q: 'Why do I get a different hash from sha256sum?',
    a: 'You should not — the same bytes give the same digest everywhere. If they differ, the two are almost certainly not looking at the same file: check you hashed the file you think you did, and that the download finished. Note that the hash covers the file contents only, so renaming a file never changes it.',
  },
  {
    q: 'Does this work offline?',
    a: 'Yes. Mubifiles installs as an offline-capable app, and this tool needs no network at all once the page has loaded, because all the work happens in your browser.',
  },
];
