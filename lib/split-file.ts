/**
 * Copy for /tools/split-file. The FAQ lives here so the rendered <dl> and the
 * FAQPage JSON-LD read from one array and cannot drift — the same arrangement
 * as the other tool pages.
 */

import type { FaqEntry } from './faq';

export const NO_LOCK_IN =
  'The parts are plain byte ranges with nothing added — no header, no index, no container. That means you do not need this tool, or any tool, to put them back: on macOS or Linux `cat myfile.zip.* > myfile.zip` rebuilds the original, and on Windows `copy /b myfile.zip.001 + myfile.zip.002 myfile.zip` does the same. They are also the same .001/.002 files HJSplit and 7-Zip produce and read, so whoever receives them can use whatever they already have.';

export const WHY_LOCAL: readonly { title: string; body: string }[] = [
  {
    title: 'No upload, so no size limit.',
    body: 'The file is read from your disk in pieces and never sent anywhere, so there is nothing to wait for and nothing to fit through. Every online splitter has to receive your file before it can cut it up, which is why every one of them caps what it accepts.',
  },
  {
    title: 'Nothing is stored anywhere afterwards.',
    body: 'A site that splits your file has a copy of it, for as long as it keeps one. Here there is no copy, because there was never a transfer — which matters most for exactly the files big enough to need splitting.',
  },
  {
    title: 'The parts are not ours.',
    body: 'They are raw byte ranges in the .001 convention, joinable with a single shell command or with 7-Zip. Nothing about the format ties you to this page.',
  },
  {
    title: 'You can check the result.',
    body: 'Splitting can produce a SHA-256 of the original alongside the parts. Whoever joins them can hash the result and compare, which turns "it seems to have worked" into a definite answer.',
  },
];

export const SPLIT_FAQ: readonly FaqEntry[] = [
  {
    q: 'Is my file uploaded anywhere?',
    a: 'No. The file is read from your disk by this page, a piece at a time, and the parts are written straight back to disk. Nothing is sent to us or to anyone else, and no request leaves the browser while it works.',
  },
  {
    q: 'Is there a size limit?',
    a: 'No. Because nothing is uploaded and no part is ever held in memory in full, the size of the file is not a constraint the way it is for a site that has to receive it first. Splitting a file larger than your available memory works normally.',
  },
  {
    q: 'Do I need this tool to join the parts again?',
    a: 'No, and that is deliberate. The parts are plain byte ranges with no header, so on macOS or Linux `cat myfile.zip.* > myfile.zip` rebuilds the original, and on Windows `copy /b myfile.zip.001 + myfile.zip.002 myfile.zip` does the same. They are also the same .001/.002 files HJSplit and 7-Zip produce and read.',
  },
  {
    q: 'Why does it ask for a folder?',
    a: 'Because a browser will not let a page start several downloads in a row — it blocks the second and every one after it. Chrome and Edge can be given a folder to write the parts into directly, which is both faster and reliable. Firefox and Safari cannot do that, so there the parts are saved one at a time, with a click for each. You are told which of the two applies before you choose a file.',
  },
  {
    q: 'What happens if a part is missing when I join?',
    a: 'The join is refused and the missing part is named, before anything is written. A set with a hole in it would otherwise produce a file that looks complete and is corrupt, which is the worst outcome for a tool like this.',
  },
  {
    q: 'Does the order of the parts matter?',
    a: 'It matters enormously, and it is handled for you: the parts are sorted by their number, not by their name, so it does not matter what order you select them in. Sorting by name is correct only while the numbering stays the same width — a set that runs past .999 into .1000 sorts wrongly by name and joins into a corrupt file.',
  },
  {
    q: 'Can I do this on a phone?',
    a: 'Joining small sets works. Splitting is a different matter: iOS Safari cannot write files to a folder, so parts have to be saved one at a time, and phone browsers are quick to discard a page doing sustained work. For a large file, use a computer.',
  },
];
