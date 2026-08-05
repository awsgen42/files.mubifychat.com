import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentPageShell } from '@/components/ContentPageShell';
import {
  ABUSE_EMAIL,
  IP_HANDLING,
  IP_HANDLING_DETAIL,
  LOCAL_STORAGE_ITEMS,
  MAX_FILE_MB,
  MAX_SESSION_MB,
  SESSION_HARD_LIMIT_HOURS,
  SESSION_IDLE_MINUTES,
  SUBPROCESSORS,
} from '@/lib/policy';
import { OG_IMAGE, SITE_URL } from '@/lib/seo';

const PATH = '/privacy';
const TITLE = 'Privacy — Mubifiles';
const DESCRIPTION =
  'What Mubifiles stores, for how long, and what it does not collect. Written from how the service actually works: no accounts, no analytics, no tracking cookies.';

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

export default function PrivacyPage() {
  return (
    <ContentPageShell breadcrumbName="Privacy" path={PATH}>
      <section className="glass card p-5 sm:p-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Privacy</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
          Mubifiles has no accounts, no analytics, no advertising and no tracking cookies. This page
          describes what the service actually does with what you send it. It is written from the
          implementation rather than from a template, so where it is vague it is because the answer
          is genuinely uncertain, not because we are being careful with words.
        </p>
      </section>

      <section className="glass card p-5 sm:p-6">
        <h2 className="text-lg font-semibold">What we store</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          While a session is open, we hold two things.
        </p>
        <ul className="mt-4 grid gap-3">
          {[
            {
              t: 'The files you upload.',
              d: `Stored as opaque objects. The storage path contains no filename and no session code — it is built from two random identifiers. The original filename is kept separately so the other device can save it under the right name. Limits are ${MAX_FILE_MB} MB per file and ${MAX_SESSION_MB} MB per session.`,
            },
            {
              t: 'A session record.',
              d: 'The six-digit code, when the session was created and last used, which of the two devices sent each item, and the text of any text you share. Text is small, so it lives in the session record rather than in file storage.',
            },
          ].map((i) => (
            <li key={i.t} className="flex gap-3">
              <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <p className="text-sm leading-relaxed text-muted-foreground">
                <strong className="font-medium text-foreground">{i.t}</strong> {i.d}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Access to a session requires a token issued when you create or join it. We store only a
          hash of that token, not the token itself.
        </p>
      </section>

      <section className="glass card p-5 sm:p-6">
        <h2 className="text-lg font-semibold">How long we keep it</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          A session closes about {SESSION_IDLE_MINUTES} minutes after the last activity, and in no
          case later than {SESSION_HARD_LIMIT_HOURS} hours after it was created. Using the session
          pushes the {SESSION_IDLE_MINUTES}-minute window forward; the{' '}
          {SESSION_HARD_LIMIT_HOURS}-hour limit never moves.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          When you end a session yourself, the files and the session record are deleted immediately.
          Otherwise the session record expires on its own, and a cleanup job that runs every fifteen
          minutes removes any files whose session has gone. Deletion is not something we choose to
          do on request — it is how the service is built.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          There is no archive, no backup you can be restored from, and no way for us to recover a
          session once it has closed.
        </p>
      </section>

      <section className="glass card p-5 sm:p-6">
        <h2 className="text-lg font-semibold">IP addresses</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{IP_HANDLING}</p>
        <p className="mt-4 text-sm font-medium">Exactly what that means</p>
        {IP_HANDLING_DETAIL.map((paragraph) => (
          <p key={paragraph} className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {paragraph}
          </p>
        ))}
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Separately, our hosting providers below receive your IP address as part of ordinary web
          traffic and keep their own request logs under their own policies. We do not control those
          logs and do not consult them.
        </p>
      </section>

      <section className="glass card p-5 sm:p-6">
        <h2 className="text-lg font-semibold">What your browser stores</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          We set no cookies. Two values are kept in your browser&rsquo;s local storage and never sent
          anywhere except as part of using the service:
        </p>
        <dl className="mt-4 grid gap-4">
          {LOCAL_STORAGE_ITEMS.map((item) => (
            <div key={item.key}>
              <dt className="font-mono text-sm font-medium">{item.key}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {item.what} {item.why}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Clearing site data in your browser removes both.
        </p>
      </section>

      <section className="glass card p-5 sm:p-6">
        <h2 className="text-lg font-semibold">What we do not do</h2>
        <ul className="mt-4 grid gap-3">
          {[
            'No accounts, so nothing is tied to an identity.',
            'No analytics, no advertising, no third-party scripts of any kind. The pages load nothing from outside our own domain.',
            'No tracking cookies. No cookies at all.',
            'No selling or sharing of anything you send. The providers listed below process it to run the service and for nothing else.',
            'No scanning or reviewing of what you send, except when acting on a specific report.',
          ].map((t) => (
            <li key={t} className="flex gap-3">
              <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <p className="text-sm leading-relaxed text-muted-foreground">{t}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="glass card p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Who processes your data</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Mubifiles runs on two providers. Both may process data outside your country.
        </p>
        <dl className="mt-4 grid gap-4">
          {SUBPROCESSORS.map((s) => (
            <div key={s.name}>
              <dt className="text-sm font-medium">{s.name}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.role}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="glass card p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Security, honestly</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Traffic is encrypted in transit, and files are stored encrypted at rest by our storage
          provider. But we can read what you send, because we hold the key material — this is not
          end-to-end encrypted. Anyone who obtains a session code within its short lifetime and gets
          past our rate limits could join that session. Do not use Mubifiles for anything you would
          not be willing to lose control of.
        </p>
      </section>

      <section className="glass card p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Your rights, and their limits</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Because there are no accounts, we hold nothing that identifies you, and so there is
          usually nothing for us to look up, export or delete on request. If you want something
          removed before it expires, end the session — that deletes it immediately. To have a
          specific file removed, see{' '}
          <Link
            href="/report"
            className="font-medium text-accent underline underline-offset-2 hover:opacity-80"
          >
            reporting abuse
          </Link>
          , which explains what we need in order to find it.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Mubifiles is not intended for children, and we have no way to verify anyone&rsquo;s age.
        </p>
      </section>

      <section className="glass card p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Changes and contact</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          If how the service handles data changes, this page changes with it. Questions go to{' '}
          <a
            href={`mailto:${ABUSE_EMAIL}`}
            className="font-medium text-accent underline underline-offset-2 hover:opacity-80"
          >
            {ABUSE_EMAIL}
          </a>
          , which is the same address used for abuse reports.
        </p>
      </section>
    </ContentPageShell>
  );
}
