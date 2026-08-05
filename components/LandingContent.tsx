/**
 * Static marketing copy. Deliberately NOT a client component and free of any
 * state, so it is present in the prerendered HTML before JavaScript runs —
 * without it a crawler sees only the app's loading state.
 */

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

const FAQ = [
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

export function LandingContent() {
  return (
    <div className="mt-10 grid gap-4 sm:mt-12 sm:gap-5">
      <section className="glass card p-5 sm:p-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Send files and text between your phone and your PC — instantly
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Mubifiles moves a screenshot, a link, a password, or a 100 MB file from one device to another
          in seconds. No app to install, no account to create, nothing left behind — just open the site
          on both devices and share a 6-digit code. Everything you send is deleted automatically once
          the session closes.
        </p>
      </section>

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
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
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
              <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
