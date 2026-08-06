/**
 * Static marketing copy. Deliberately NOT a client component and free of any
 * state, so it is present in the prerendered HTML before JavaScript runs —
 * without it a crawler sees only the app's loading state.
 */
import Link from 'next/link';
import { FAQ, buildFaqSchema } from '@/lib/faq';
import { TransferDemo } from './TransferDemo';

const STEPS = [
  {
    title: 'Open Mubifiles on the device holding the file',
    body: 'Tap “Start a session”. You get a 6-digit code and a QR code straight away — no sign-up, no install.',
  },
  {
    title: 'Enter the code on your other device',
    body: 'Type the six digits, or scan the QR with your phone camera. Both devices are now paired under the same session.',
  },
  {
    title: 'Send as much as you like, both ways',
    body: 'Paste text or drop files from either side. The code stays live for the whole conversation — you only need a new one for a new session.',
  },
];

export function LandingContent() {
  return (
    /* No max-width of its own: it fills the page container so its edges line
       up with the app area above it. Line length is held in check per
       paragraph instead. At lg the top margin drops to the same 24px used
       between every other block, so the app area and the marketing block are
       not separated by a bigger gap than anything else on the page. */
    <div className="mt-10 grid gap-4 sm:mt-12 sm:gap-5 lg:mt-6 lg:gap-6">
      <section className="glass card p-5 sm:p-6">
        <h1 className="max-w-3xl text-2xl font-semibold tracking-tight sm:text-3xl">
          Send files and text between your phone and your PC — instantly
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Mubifiles moves a screenshot, a link, a password, or a 1 GB video from one device to another
          in seconds. No app to install, no account to create, nothing left behind — just open the site
          on both devices and share a 6-digit code. Everything you send is deleted automatically once
          the session closes.
        </p>
      </section>

      {/* Sits between the headline and the steps because it illustrates the
          steps — the reader sees the shape of the thing before reading how to
          do it. Its height is fixed in CSS, so it reserves its own space. */}
      <TransferDemo />

      <section className="glass card p-5 sm:p-6">
        <h2 className="text-lg font-semibold">How it works</h2>
        <ol className="mt-4 grid gap-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-3.5">
              <span
                aria-hidden="true"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground"
              >
                {index + 1}
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-medium">{step.title}</h3>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="glass card p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Frequently asked questions</h2>
        <dl className="mt-4 grid gap-5">
          {FAQ.map((item) => (
            <div key={item.q}>
              <dt className="text-sm font-medium">{item.q}</dt>
              <dd className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{item.a}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-5 max-w-2xl text-sm text-muted-foreground">
          Moved here from another tool? See our rundown of{' '}
          <Link
            href="/snapdrop-alternative"
            className="font-medium text-accent underline underline-offset-2 hover:opacity-80"
          >
            Snapdrop alternatives
          </Link>{' '}
          and how they compare.
        </p>
      </section>

      {/* Emitted here rather than in the root layout: the schema must describe
          the questions this page actually shows. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildFaqSchema(FAQ)) }}
      />
    </div>
  );
}
