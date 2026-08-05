import type { FaqEntry } from './faq';

/**
 * Copy for /snapdrop-alternative. The FAQ lives here so the rendered markup
 * and the FAQPage JSON-LD read from one array and cannot drift.
 *
 * The comparison table below is a factual claim about other people's software.
 * If any of these tools ships a change, this page goes stale — stale comparison
 * pages lose both rankings and trust. Worth revisiting every few months.
 */

export interface ComparisonRow {
  tool: string;
  sameWifi: string;
  install: string;
  account: string;
  bestAt: string;
  /** Highlights our own row in the table. */
  isUs?: boolean;
}

export const COMPARISON: readonly ComparisonRow[] = [
  {
    tool: 'Mubifiles',
    sameWifi: 'No',
    install: 'No',
    account: 'No',
    bestAt: 'Any two networks, text + files, fastest to start',
    isUs: true,
  },
  {
    tool: 'PairDrop',
    sameWifi: 'Not if you pair devices first',
    install: 'No',
    account: 'No',
    bestAt: 'The direct Snapdrop successor',
  },
  {
    tool: 'LocalSend',
    sameWifi: 'Yes',
    install: 'Yes, both devices',
    account: 'No',
    bestAt: 'Large files on one network',
  },
  {
    tool: 'Quick Share',
    sameWifi: 'Yes',
    install: 'Yes on PC',
    account: 'Google account',
    bestAt: 'Android to Windows, deep OS integration',
  },
];

export interface ToolNote {
  name: string;
  body: string[];
  chooseIt: string;
}

export const TOOL_NOTES: readonly ToolNote[] = [
  {
    name: 'PairDrop',
    body: [
      'The closest thing to the Snapdrop you remember, because it is literally built from the same codebase by people who cared about the original. Browser-based, no install. It also added device pairing, which lets paired devices reach each other without sharing a network.',
    ],
    chooseIt: 'you want the Snapdrop experience back and are happy to pair your devices once.',
  },
  {
    name: 'LocalSend',
    body: [
      'Free, open source, and genuinely excellent — but it is an app, and it needs to be installed on both ends. It also requires both devices on the same local network.',
    ],
    chooseIt:
      'you move large files regularly between your own machines on your own Wi-Fi. For that job it beats everything here, including us.',
  },
  {
    name: 'Quick Share',
    body: [
      "Google's own, now available on Windows. Deep integration, and fast when it works. It leans on having a Google account and compatible hardware, and both devices still need to be nearby.",
    ],
    chooseIt: 'you are on Android and Windows and want it built into the share sheet.',
  },
];

export const WRONG_TOOL: readonly { title: string; body: string }[] = [
  {
    title: 'Multi-gigabyte files on your own Wi-Fi.',
    body: 'Use LocalSend. Local transfer will be faster than anything routed over the internet, and there is no size ceiling.',
  },
  {
    title: 'A permanent link you can send to someone next week.',
    body: 'Mubifiles sessions expire by design. You want proper file hosting.',
  },
  {
    title: 'Continuous folder sync between machines.',
    body: "That is Syncthing's job.",
  },
  {
    title: 'No internet at all.',
    body: 'Mubifiles needs a connection. LocalSend and PairDrop work on a bare local network.',
  },
];

export const SNAPDROP_FAQ: readonly FaqEntry[] = [
  {
    q: 'Is Snapdrop safe to use now?',
    a: "The site changed ownership, and the developers of the associated Android client removed support for it over security and privacy concerns. The original project's maintainers point people to PairDrop instead. Draw your own conclusion, but the people who built it are not using it.",
  },
  {
    q: 'What is the closest replacement for Snapdrop?',
    a: 'PairDrop, if you want the same experience — it is a fork of the original code. Mubifiles, if the local-network requirement was the part that annoyed you.',
  },
  {
    q: 'Do I need to install anything to use Mubifiles?',
    a: 'No. It runs in the browser on both devices. There is no app and no account.',
  },
  {
    q: 'Can I send files between two different Wi-Fi networks?',
    a: 'Yes. This is the main practical difference between Mubifiles and the local-network tools. The devices never need to see each other on a network.',
  },
  {
    q: 'How long do the files stay available?',
    a: 'A session closes after about 15 minutes of inactivity, with a 24-hour hard limit. When it closes, the files are deleted. You can also end a session yourself.',
  },
];
