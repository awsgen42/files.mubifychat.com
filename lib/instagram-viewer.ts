/**
 * Copy for /tools/instagram-data-download-viewer.
 *
 * The FAQ lives here so the rendered <dl> and the FAQPage JSON-LD read from one
 * array and cannot drift — the same arrangement as the other tool pages.
 *
 * Two rules held the whole way through this page:
 *
 * Nothing is uploaded, and there is nowhere to upload to. That is not a privacy
 * posture bolted on afterwards; it is the reason the page exists. The archive
 * contains the other side of every conversation, written by people who were
 * never asked.
 *
 * No number appears here that was not measured. The measurements are against
 * synthetic archives — no real export has been available — and the copy says so
 * where a number is quoted, because a figure from a fixture I built myself is
 * weaker evidence than a figure from a real one and the reader should know
 * which they are getting.
 */

import type { FaqEntry } from './faq';

export const WHY_NO_UPLOAD =
  'Every other viewer for this file asks you to upload it. Think about what is in it: not your messages, but your conversations — every reply the other person sent, every photo they sent you, their name against all of it. They were never asked. There is no upload here, and no endpoint to add one to later; the archive is read inside the page, which is why it also works with your connection turned off, and why there is no size limit for us to impose.';

export const HOW_IT_WORKS: readonly { title: string; body: string }[] = [
  {
    title: 'The zip is never unpacked.',
    body: 'A zip file ends with a directory of everything inside it, so the browser can seek straight to one conversation and decompress that alone. Nothing else is touched. This is what makes a very large export openable at all — the alternative, which most tools take, is to hold the whole archive in memory first, and that is the step that fails.',
  },
  {
    title: 'Conversations split across files are put back together.',
    body: 'A long thread is not one file. Instagram writes message_1.json, message_2.json and so on, newest-first inside each file — and the files are not in order relative to each other, so message_2.json can hold older or newer messages than message_1.json depending on how the export was cut. Merging them means sorting by timestamp across the whole set, not concatenating them. The best-known script for this tells you to merge them by hand; the best-known hosted viewer opens one of them at a time.',
  },
  {
    title: 'The mojibake is repaired.',
    body: 'Instagram writes UTF-8 bytes as if they were Latin-1, so Urdu, Arabic, Japanese, accented French and every emoji arrive as strings like Ã¢ÂÂ¤. The fix is to reverse the mistake and decode properly — with a strict decoder, so text that only resembles mojibake is returned untouched rather than mangled.',
  },
  {
    title: 'Reading happens off the drawing thread.',
    body: 'Unzipping, parsing, repairing and searching all run in a Web Worker. The page you are scrolling never does that work, which is why the conversation stays smooth while a large archive is still being read.',
  },
  {
    title: 'Only what is on screen exists.',
    body: 'A fifty-thousand-message conversation is not fifty thousand elements. About twenty-five exist at a time and are recycled as you scroll, with the scrollbar reflecting the whole thread. Photos are decompressed when their row appears and released when it leaves.',
  },
];

/**
 * The media-mode explainer. This is the one design decision on the page worth
 * arguing for in public, because the obvious version of it is wrong.
 */
export const WHY_MEDIA_MODE =
  'There are two states — text only, and show media — and which one an archive opens in is decided by how much media it has, not by how big the file is. Those are not the same thing, and the difference is large: an export can be a gigabyte and hold fifty-odd megabytes that a conversation can actually show, because the rest is your posts, your stories and your profile pictures, none of which appear in a thread. Sizing the decision off the file would start that archive text-only for no reason, and would start a smaller, attachment-heavy one with everything on. So the count comes from the zip directory — which lists the size of every attachment before any of it is read — and the archive opens the right way round without costing anything to find out.';

export const INSTAGRAM_FAQ: readonly FaqEntry[] = [
  {
    q: 'Is my export uploaded anywhere?',
    a: 'No. It is read inside the page by your own browser, and there is no server to send it to — this site has no endpoint that accepts one. You can check the way you would check any such claim: open the Network tab while you use it, or load the page, turn off your connection, and carry on. The reason it is built this way is that your archive is not only about you. It holds what other people wrote to you, and they never agreed to it being sent to anybody.',
  },
  {
    q: 'How big an export can it open?',
    a: 'There is no limit set here, because there is no upload to size. What matters is your device rather than the file: the archive is read a piece at a time out of the zip rather than loaded whole. Archives of two gigabytes open in testing, on a phone-sized memory profile — though those tests are against archives built to match the documented format, not a real export, so treat that as an indication and not a guarantee.',
  },
  {
    q: 'Why are my messages full of Ã and Â?',
    a: 'That is Instagram’s bug, not yours and not your phone’s. The export writes UTF-8 text as if each byte were a separate Latin-1 character, so anything outside plain English arrives scrambled. It is reversible — the original text is still in there, encoded wrongly — and it is reversed here, for Arabic and Urdu and Japanese and emoji, not only for accented Latin letters. That last part is where most implementations stop, because accented Latin is the case people test with.',
  },
  {
    q: 'Why does the conversation open with photos hidden?',
    a: 'Because that conversation has enough attachments that showing all of them while you scroll would be the slowest thing on the page. It is one button to turn them on, and the line under the toggle tells you how much media the archive holds, so the decision is yours and it is an informed one. Archives with a modest amount of media open with it already on.',
  },
  {
    q: 'A conversation is missing messages. Where did they go?',
    a: 'Check whether the thread is marked as merged from several files — long conversations are split across message_1.json, message_2.json and so on, and a viewer that reads only the first one shows you a fragment. They are merged here by timestamp across the whole set. If messages are genuinely absent from the export itself, that is Instagram’s doing rather than the viewer’s; nothing here filters or drops a message, and a message whose type is not recognised still appears, with its sender and time, labelled rather than hidden.',
  },
  {
    q: 'My export is a folder, not a zip. Can I still use it?',
    a: 'Yes — pick the folder instead. Every guide tells people to unzip the export first, so plenty of people arrive without a zip, and telling them to compress it again would be asking them to undo a step to suit the tool.',
  },
  {
    q: 'It says my export is the HTML version.',
    a: 'Instagram offers HTML or JSON, and the HTML one is a website rather than data — it can be opened in a browser but not read reliably by anything else. Request the export again and choose JSON. Only the format changes; the same conversations are in it.',
  },
  {
    q: 'Does this work for a Facebook or WhatsApp export?',
    a: 'It is built and tested for Instagram. Facebook’s export uses a very similar layout, and nothing here refuses a file for not being Instagram — so it may well work, and the page will tell you what it found if it does not. WhatsApp is a different format entirely and will not.',
  },
  {
    q: 'Can I share a conversation from here with someone?',
    a: 'No, and that is deliberate. A share link means a copy on a server, which is the exact thing this page exists not to do — and the messages in it are half someone else’s. Your browser’s own screenshot and print are still there and do not involve us.',
  },
];
