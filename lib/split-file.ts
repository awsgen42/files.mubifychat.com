/**
 * Copy for /tools/split-file. The FAQ lives here so the rendered <dl> and the
 * FAQPage JSON-LD read from one array and cannot drift — the same arrangement
 * as the other tool pages.
 *
 * The page leads on joining rather than splitting. What ranks for the splitting
 * query is mostly CSV and text splitters, so half of that intent is spreadsheet
 * users this tool cannot help; what ranks for the joining query is desktop
 * software and how-to articles. Someone holding a folder of .001 files and no
 * idea what they are is the person this page can actually finish the job for.
 */

import type { FaqEntry } from './faq';

export const NO_LOCK_IN =
  'The parts are plain byte ranges with nothing added — no header, no index, no container. That means you do not need this tool, or any tool, to put them back: on macOS or Linux `cat myfile.zip.* > myfile.zip` rebuilds the original, and on Windows `copy /b myfile.zip.001 + myfile.zip.002 myfile.zip` does the same. They are also the same .001/.002 files HJSplit and 7-Zip produce and read, so whoever receives them can use whatever they already have.';

/**
 * The size sentence is the one claim here that was measured before it was
 * written: a 4 GB round trip through this page's own controls, with the whole
 * browser held in a 2 GB cgroup, against an in-memory join of the same parts
 * under the same cap that was killed. The numbers are in the commit.
 */
export const WHY_LOCAL: readonly { title: string; body: string }[] = [
  {
    title: 'It is not limited by your memory.',
    body: 'Parts are read a window at a time and written straight to disk as they go, so the result never exists in memory all at once. The other browser-based joiners build the finished file in memory before handing it over, which is why they stop working somewhere below the size of your RAM. Measured: a 4 GB join completed with the browser capped at 2 GB, where the in-memory approach on the same parts was killed.',
  },
  {
    title: 'It knows which kind of split you have.',
    body: 'The first bytes of part 001 are read and you are told what you are holding — a split ZIP, a split .7z, or something with no signature at all — before anything is written. Almost all of them join fine, including 7-Zip’s own .7z.001 volumes; the one exception is a ZIP written by `zip -s`, whose volumes carry a spanning marker that makes raw joining produce a malformed archive, and that is the only case this refuses.',
  },
  {
    title: 'Nothing is uploaded, so nothing is stored.',
    body: 'A site that joins your file has a copy of it, for as long as it keeps one. Here there is no copy, because there was never a transfer — which matters most for exactly the files big enough to have been split.',
  },
  {
    title: 'The parts are not ours.',
    body: 'They are raw byte ranges in the .001 convention, joinable with a single shell command or with 7-Zip. Nothing about the format ties you to this page, and the sidecar .join.txt written on the split side is a plain text file you can read and ignore.',
  },
];

export const WHICH_BROWSERS =
  'Chrome and Edge on a computer can write straight to disk, which is what removes the size ceiling: joining streams to the file as it goes, and splitting writes the parts into a folder you pick. Firefox and Safari do not implement that yet, so there the result has to be built in memory and handed over as a download, which works for ordinary files and will fail on very large ones. The page tells you which of the two you are getting before you choose a file, not after.';

export const SPLIT_FAQ: readonly FaqEntry[] = [
  {
    q: 'How do I open a .001 file?',
    a: 'You do not open it — a .001 file is the first slice of a larger file that was cut into numbered pieces, and on its own it is incomplete. Put all the numbered pieces back together and you get the original file, which is then whatever it always was: a video, a ZIP, an installer. Drop the whole set into the box above and it rebuilds it.',
  },
  {
    q: 'How do I join 001 and 002 files without installing software?',
    a: 'Select or drag every numbered part into the box above and choose where to save. The joining happens in this page, on your own device, so there is nothing to download and install and nothing to sign up for. If you would rather not use a website at all, one command does it: `cat myfile.zip.* > myfile.zip` on macOS or Linux, `copy /b myfile.zip.001 + myfile.zip.002 myfile.zip` on Windows.',
  },
  {
    q: 'What if the parts came out of 7-Zip or WinRAR?',
    a: 'Then they almost certainly still join. 7-Zip’s volume option produces a raw byte split — `archive.7z.001`, `archive.7z.002` — and concatenating those gives back the original .7z, which you then open in 7-Zip; the same is true of its ZIP volumes. We checked rather than assumed: joining a 7z volume set here produces bytes identical to `cat` of the same parts, and that file passes `7z t` and extracts to the original digest. The single case that does not work is a ZIP made with `zip -s`, whose first volume starts with a spanning marker; joining those shifts every offset in the archive and the result is malformed, so the join is refused and you are told to open the .zip with 7-Zip instead. A true multi-volume RAR is named .part1.rar and never looks like a .001 set in the first place.',
  },
  {
    q: 'Is there a size limit?',
    a: 'Not in Chrome or Edge on a computer. Nothing is uploaded, and the output is written to disk as the parts are read rather than assembled in memory first, so a file larger than the memory available to the browser joins normally — this was measured at 4 GB with the browser limited to 2 GB. In Firefox and Safari the file has to be built in memory before it can be saved, so there the practical ceiling is your RAM.',
  },
  {
    q: 'Does the order I pick the parts in matter?',
    a: 'No. They are sorted by their number before anything is written, so selecting them in any order, or dragging a whole folder in, gives the same result. Sorting by name would be correct only while the numbering stays the same width — a set running past .999 into .1000 sorts wrongly by name and joins into a corrupt file.',
  },
  {
    q: 'What happens if a part is missing?',
    a: 'The join is refused and the missing part is named, before anything is written. A set with a hole in it would otherwise produce a file that looks complete and is corrupt, which is the worst outcome for a tool like this.',
  },
  {
    q: 'What is the .join.txt file?',
    a: 'A small text file written next to the parts when you split, listing the original name and size, every part and its size, the SHA-256 of the original, and the commands to rejoin them by hand. Drop it in with the parts and they are checked against it before the join — including each part’s size, which catches one truncated by a failed transfer. It is optional on the way out and never required on the way in: nothing is written inside the parts themselves, so a set without it joins exactly the same.',
  },
  {
    q: 'Can I drop a whole folder in?',
    a: 'Yes. Anything that is not a numbered part — the .join.txt, .DS_Store, Thumbs.db, a CHECKSUMS.txt, a stray readme — is set aside and listed, not sorted into the sequence and not treated as an error.',
  },
  {
    q: 'Can I split a file here too?',
    a: 'Yes, on the second tab. Choose a file and a part size — 25 MB for email, 100 MB for most upload forms, 2 GB for a FAT32 drive — and the parts are written straight to a folder you pick. Nothing is uploaded, so the file being large is not a problem in the way it is for a site that has to receive it first.',
  },
  {
    q: 'Can I do this on a phone?',
    a: 'Joining a small set works. Beyond that it is a poor bet: iOS Safari cannot write to a folder or stream to disk, so the whole result has to fit in memory, and phone browsers are quick to discard a page doing sustained work. For anything large, use a computer with Chrome or Edge.',
  },
];
