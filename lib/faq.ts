/**
 * Single source of truth for the landing-page FAQ.
 *
 * Both the rendered <dl> and the FAQPage JSON-LD read from here. Google
 * compares the schema answers against the visible text and flags any
 * divergence as a structured data error, so these must never be maintained
 * in two places.
 */
export interface FaqEntry {
  q: string;
  a: string;
}

/**
 * Builds schema.org FAQPage JSON-LD from the same entries a page renders.
 * Every page with an FAQ uses this — the schema must describe the questions
 * visible on *that* page, so it is emitted per page rather than site-wide.
 */
export function buildFaqSchema(entries: readonly FaqEntry[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: entries.map((entry) => ({
      '@type': 'Question',
      name: entry.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: entry.a,
      },
    })),
  };
}

export const FAQ: readonly FaqEntry[] = [
  {
    q: 'Do I need an account to send a file?',
    a: 'No. Mubifiles works without signing up or installing anything. Open the site on both devices, share the 6-digit code, and you are connected. Nothing is tied to an identity.',
  },
  {
    q: 'How long do my files stay available?',
    a: 'A session stays open while it is being used and closes automatically after about 15 minutes of inactivity, with a 24-hour hard limit. When it closes, the files are deleted from storage. You can also end a session yourself at any time.',
  },
  {
    q: 'Is the 6-digit code secure enough?',
    a: 'The code is random, short-lived, and rate-limited, which makes guessing one within its lifetime impractical. Every request also carries a private token issued when you create or join the session, so knowing a code alone is not enough to read it. For sensitive files, use the one-time download option so a file disappears after being fetched once.',
  },
  {
    q: 'How big can a file be?',
    a: 'Individual files are capped at 100 MB and a single session at 500 MB. Those limits keep anonymous sharing fast and cheap to run. Text can be up to 100,000 characters, which is plenty for logs, snippets, or a long note.',
  },
];
