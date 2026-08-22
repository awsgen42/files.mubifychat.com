/**
 * Copy for /tools/stylish-name. The FAQ lives here so the rendered <dl> and the
 * FAQPage JSON-LD read from one array and cannot drift — the same arrangement
 * as the other tool pages.
 *
 * The differentiator is compatibility rather than variety. Competing pages list
 * hundreds of styles and say nothing about which survive being pasted; this one
 * lists thirteen and explains what each is made of, because the block a
 * character comes from is the thing that predicts whether it arrives intact.
 *
 * Deliberately absent: any claim about which app or game accepts which style.
 * We have not tested them, and a compatibility table nobody verified is exactly
 * the kind of confident wrongness this page exists to be better than.
 */

import type { FaqEntry } from './faq';

export const WHY_COMPATIBILITY =
  'Every generator offers hundreds of styles. Almost none say which ones actually arrive intact, so you paste one in and find out — from a row of boxes, from a name filter that strips it, or from a form that refuses the length. The styles here are grouped by what they are built from, because that is what decides the outcome: a single character from a block that has been in system fonts since the 1990s behaves very differently from a letter above U+FFFF, and both behave differently from a letter with an invisible mark glued to it.';

export const HOW_IT_WORKS: readonly { title: string; body: string }[] = [
  {
    title: 'It is substitution, not a font.',
    body: 'There is no styling involved. Each letter is swapped for a different Unicode character that happens to look like a styled version of it — 𝐀 is not a bold A, it is U+1D400 MATHEMATICAL BOLD CAPITAL A, a distinct character. That is why the result survives being copied into a plain text field at all, and also why it can be rejected by anything that only accepts letters.',
  },
  {
    title: 'The tables come from the Unicode database.',
    body: 'Mathematical Alphanumeric Symbols has holes: fourteen letters were already encoded years earlier in Letterlike Symbols, so the slots that would hold them are unassigned. Generating these tables by counting from the first character of the block lands in those holes and produces reserved code points. Ours are looked up by name and each borrowed character was checked against its own decomposition.',
  },
  {
    title: 'Unmapped characters are left alone.',
    body: 'Unicode has never encoded a small capital X, for example, so in small caps an X stays an X. Substituting something that looks close would change your name, and dropping it would change it more, so the character passes through and the style says which ones it leaves behind.',
  },
  {
    title: 'Nothing you type is sent anywhere.',
    body: 'The substitution runs in the page. There is no request while you type — you can check that in the Network tab, or by loading the page and turning your connection off.',
  },
];

export const STYLISH_FAQ: readonly FaqEntry[] = [
  {
    q: 'Why does my stylish name show as boxes?',
    a: 'A box means the device has no font containing that character. Nothing is broken and the text is intact — it will look right on a machine that has the font. The styles most likely to do this are the ones built from Mathematical Alphanumeric Symbols, which live above U+FFFF; the fullwidth, circled and small caps styles come from much older blocks and are in system fonts almost everywhere.',
  },
  {
    q: 'Why was my name rejected as too long?',
    a: 'Because length is not counted the way you count it. A name in strikethrough or underline style has an invisible combining mark after every letter, so eight letters become sixteen characters. The Mathematical styles are one character per letter but two UTF-16 units each, and a limit written in JavaScript counts those. Each style here shows all three numbers — characters, UTF-16 units and UTF-8 bytes — so you can see which limit you are hitting.',
  },
  {
    q: 'Which style is safest?',
    a: 'Fullwidth, circled and small caps. They are single characters from blocks encoded in the 1990s, inside the Basic Multilingual Plane, present in essentially every system font, and they keep your name the same length. That is a statement about the characters, not a promise about a particular app — no one can promise that without testing your app.',
  },
  {
    q: 'Do you know if this works in a specific game or app?',
    a: 'No, and we would rather say so than guess. What we can tell you is what each style is made of and how long it becomes, which is enough to predict most rejections: combining marks get stripped or blow the length limit, characters above U+FFFF need a font, and single BMP characters usually just work. Try the safest group first.',
  },
  {
    q: 'Can I turn a stylish name back into normal text?',
    a: 'Usually. Most of these characters carry a compatibility mapping back to plain ASCII in the Unicode data, so software that normalises text — which many name filters do — will turn 𝐀 back into A. That is worth knowing in both directions: it is how you undo it, and it is why some sites show your name plain no matter what you paste.',
  },
  {
    q: 'Is a stylish name a good idea?',
    a: 'For a display name in a game or a profile, it is harmless fun. For anything you might need to type again, search for, or have someone read out — a username you log in with, an email address, a business page — it is a bad trade: the characters are hard to type, inconsistent to search for, and read badly by screen readers.',
  },
  {
    q: 'Is anything I type uploaded?',
    a: 'No. The page carries the substitution tables and does the work locally, so there is no request while you type and nothing to store. The same is true of every tool on this site.',
  },
];
