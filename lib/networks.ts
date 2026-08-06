import type { FaqEntry } from './faq';

/**
 * Copy for /send-files-between-different-networks. The FAQ feeds both the
 * rendered <dl> and the FAQPage JSON-LD, so the two cannot drift.
 *
 * ACCURACY WATCH: the lists below make claims about other people's software.
 * If any of these tools ships cross-network support, this page becomes wrong.
 * Worth re-checking every few months.
 */

export const WHY_SAME_WIFI: readonly { title: string; body: string }[] = [
  {
    title: 'The same network.',
    body: 'Different networks means no shared address space.',
  },
  {
    title: 'Client isolation switched off.',
    body: 'Most public, hotel, and corporate Wi-Fi turns it on deliberately, so devices on the network cannot reach each other. This is why these tools so often fail on office Wi-Fi even when both devices are genuinely on it.',
  },
  {
    title: 'A firewall that permits it.',
    body: 'Corporate laptops frequently do not.',
  },
];

/** `linkTo` renders the tool name as an internal link. */
export const NOT_WORKING: readonly { tool: string; note: string; linkTo?: string }[] = [
  { tool: 'LocalSend', note: 'same local network, by design' },
  {
    tool: 'Snapdrop / ShareDrop',
    note: 'same, and the original Snapdrop domain has changed hands and is no longer the project people remember',
    linkTo: '/snapdrop-alternative',
  },
  { tool: 'Quick Share / Nearby Share', note: 'proximity-based' },
  { tool: 'AirDrop', note: 'proximity-based' },
  { tool: 'KDE Connect', note: 'same network unless you configure your own relay' },
  { tool: 'Bluetooth', note: 'proximity, and slow' },
];

export const PRACTICAL_RULE: readonly { when: string; then: string }[] = [
  { when: 'Same trusted Wi-Fi, large file', then: 'LocalSend' },
  {
    when: 'Same Wi-Fi but it’s public or corporate and the tools keep failing',
    then: 'use a relay-based tool instead; client isolation is fighting you',
  },
  { when: 'Different networks, one-off', then: 'Mubifiles, or a PairDrop public room' },
  {
    when: 'Different networks, both devices online together, large file',
    then: 'PairDrop — peer-to-peer, no size cap',
  },
  {
    when: 'Different networks, sender and receiver at different times',
    then: 'Mubifiles — the file waits in storage',
  },
  { when: 'You want to keep the file long-term', then: 'cloud storage' },
];

export const NETWORKS_FAQ: readonly FaqEntry[] = [
  {
    q: 'Can I send a file from mobile data to a computer on Wi-Fi?',
    a: 'Yes, with a relay-based tool. Open the site on both, share the code, send. The devices do not need to be on the same network.',
  },
  {
    q: 'Why does Snapdrop or LocalSend fail on my office Wi-Fi?',
    a: 'Most likely client isolation. The network deliberately prevents devices on it from seeing each other, which is exactly what those tools depend on.',
  },
  {
    q: 'Is a relay slower than a direct transfer?',
    a: 'Usually, yes. Your file travels up and then back down, so your upload speed sets the pace. On a fast connection with a small file the difference is not noticeable.',
  },
  {
    q: 'Is it safe to send files through a server?',
    a: 'It depends on the service. With Mubifiles, the session code is random and short-lived, access requires a private token issued when you join, and files are deleted when the session closes. For anything highly sensitive, use the one-time download option.',
  },
  {
    q: 'How large a file can I send?',
    a: 'Up to 1 GB per file and 3 GB per session. It is still a ceiling the alternatives do not have: PairDrop transfers peer-to-peer and imposes no hard size cap, and LocalSend has none either. For a file past a gigabyte, use LocalSend on a shared network or PairDrop across networks.',
  },
];
