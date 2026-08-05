import type { Metadata } from 'next';
import { ContentPageShell } from '@/components/ContentPageShell';
import { OG_IMAGE, SITE_URL } from '@/lib/seo';

const PATH = '/report';
const ABUSE_EMAIL = 'abuse@mubifiles.com';
const TITLE = 'Report abuse — Mubifiles';
const DESCRIPTION =
  'How to report content shared through Mubifiles, what to include so we can find it, and what we can and cannot tell you about who sent it.';

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

export default function ReportPage() {
  return (
    <ContentPageShell breadcrumbName="Report abuse" path={PATH}>
      <section className="glass card p-5 sm:p-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Report abuse</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
          Mubifiles is an anonymous, no-account file transfer tool. We do not review what people
          send, but we will remove content that should not be here.
        </p>
        <p className="mt-4 text-sm text-muted-foreground">Email:</p>
        <a
          href={`mailto:${ABUSE_EMAIL}`}
          className="mt-1 inline-block break-all font-mono text-lg font-medium text-accent underline underline-offset-4 hover:opacity-80 sm:text-xl"
        >
          {ABUSE_EMAIL}
        </a>
      </section>

      <section className="glass card p-5 sm:p-6">
        <h2 className="text-lg font-semibold">What to include</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          We can only act on a report that contains the download link. It is the only way we can
          locate a specific file — the link carries the session code and item id, which is what lets
          us find the object and delete it.
        </p>
        <ul className="mt-4 grid gap-3">
          {[
            'The full download URL.',
            'What the problem is: copyright infringement, malware, illegal content, or something else.',
            'If it is a copyright claim, who you are and what work is involved.',
          ].map((item) => (
            <li key={item} className="flex gap-3">
              <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <p className="text-sm leading-relaxed text-muted-foreground">{item}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="glass card p-5 sm:p-6">
        <h2 className="text-lg font-semibold">What happens next</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          We delete the object. There is no appeal process and no account to suspend, because there
          are no accounts.
        </p>
      </section>

      <section className="glass card p-5 sm:p-6">
        <h2 className="text-lg font-semibold">A note on timing</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Sessions close after about 15 minutes of inactivity, with a 24-hour hard limit. When a
          session closes, everything in it is deleted automatically. In practice most reported
          content is already gone before a report reaches us. That is not us declining to act — the
          file genuinely no longer exists.
        </p>
      </section>

      <section className="glass card p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Law enforcement</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          We do not retain uploader identity. IP addresses are used transiently to rate-limit
          requests and are not stored against uploads, so we cannot tell you who sent a file. There
          is no log to hand over.
        </p>
      </section>
    </ContentPageShell>
  );
}
