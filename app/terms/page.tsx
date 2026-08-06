import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentPageShell } from '@/components/ContentPageShell';
import {
  ABUSE_EMAIL,
  MAX_FILE_LABEL,
  MAX_SESSION_LABEL,
  SESSION_HARD_LIMIT_HOURS,
  SESSION_IDLE_MINUTES,
} from '@/lib/policy';
import { OG_IMAGE, SITE_URL } from '@/lib/seo';

const PATH = '/terms';
const TITLE = 'Terms of use — Mubifiles';
const DESCRIPTION =
  'The terms for using Mubifiles: what you may send, what you are responsible for, and the fact that the service is provided as-is with no guarantee of availability.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: {
    type: 'article',
    url: `${SITE_URL}${PATH}`,
    siteName: 'Mubifiles',
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE.url],
  },
};

const PROHIBITED = [
  'Anything unlawful where you are, or where the recipient is.',
  'Material you do not have the right to share, including copyrighted work that is not yours to distribute.',
  'Malware, or files designed to damage or gain unauthorised access to a device.',
  'Sexual content involving minors, or material that sexualises children in any form.',
  'Content intended to harass, threaten or endanger someone.',
  'Automated or bulk use that degrades the service for other people, including attempts to work around the rate limits.',
];

export default function TermsPage() {
  return (
    <ContentPageShell breadcrumbName="Terms of use" path={PATH}>
      <section className="glass card p-5 sm:p-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Terms of use</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
          Mubifiles is a free tool for moving files and text between two devices. Using it means
          accepting what follows. It is short because the service is small and there is little to
          agree to.
        </p>
      </section>

      <section className="glass card p-5 sm:p-6">
        <h2 className="text-lg font-semibold">What you may not send</h2>
        <ul className="mt-4 grid gap-3">
          {PROHIBITED.map((t) => (
            <li key={t} className="flex gap-3">
              <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <p className="text-sm leading-relaxed text-muted-foreground">{t}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="glass card p-5 sm:p-6">
        <h2 className="text-lg font-semibold">You are responsible for what you send</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          We do not review, moderate or scan what passes through Mubifiles. You are responsible for
          the content you upload and for having the right to share it, and for who you give a
          session code to — anyone holding it can join that session while it is open.
        </p>
      </section>

      <section className="glass card p-5 sm:p-6">
        <h2 className="text-lg font-semibold">We can remove content and end sessions</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          We may delete any file and close any session at any time, with no notice and no
          obligation to explain. In practice this happens on a{' '}
          <Link
            href="/report"
            className="font-medium text-accent underline underline-offset-2 hover:opacity-80"
          >
            report
          </Link>
          , but the right is not limited to that. Because there are no accounts, there is nothing to
          suspend and no appeal process.
        </p>
      </section>

      <section className="glass card p-5 sm:p-6">
        <h2 className="text-lg font-semibold">No guarantee of availability</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Mubifiles is provided as-is and as-available, with no warranty of any kind. It may be
          slow, unavailable, or withdrawn entirely without notice. Transfers may fail. Nothing here
          is a promise that a file will arrive or that the service will exist tomorrow.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Everything expires by design: a session closes after about {SESSION_IDLE_MINUTES} minutes
          of inactivity and no later than {SESSION_HARD_LIMIT_HOURS} hours after it began, and its
          contents are deleted. Do not use Mubifiles as storage or as your only copy of anything.
          Current limits are {MAX_FILE_LABEL} per file and {MAX_SESSION_LABEL} per session, and may
          change.
        </p>
      </section>

      <section className="glass card p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Liability</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          To the extent the law allows, we are not liable for any loss arising from using Mubifiles
          — including lost or corrupted files, a transfer that did not complete, or content reaching
          someone it was not meant for. The service is free, and the risk of using it is yours.
        </p>
      </section>

      <section className="glass card p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Changes and contact</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          These terms may change, and continuing to use the service means accepting the current
          version. How data is handled is described separately in the{' '}
          <Link
            href="/privacy"
            className="font-medium text-accent underline underline-offset-2 hover:opacity-80"
          >
            privacy policy
          </Link>
          . Questions go to{' '}
          <a
            href={`mailto:${ABUSE_EMAIL}`}
            className="font-medium text-accent underline underline-offset-2 hover:opacity-80"
          >
            {ABUSE_EMAIL}
          </a>
          .
        </p>
      </section>
    </ContentPageShell>
  );
}
