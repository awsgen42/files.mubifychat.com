import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentPageCta, ContentPageFaq, ContentPageShell } from '@/components/ContentPageShell';
import { OG_IMAGE, SITE_URL } from '@/lib/seo';
import { COMPARISON, SNAPDROP_FAQ, TOOL_NOTES, WRONG_TOOL } from '@/lib/snapdrop';

const PATH = '/snapdrop-alternative';
const TITLE = 'Snapdrop Alternatives in 2026 — What Happened and What to Use Now';
const DESCRIPTION =
  'Snapdrop was sold and is no longer the tool it was. Here’s an honest comparison of PairDrop, LocalSend, Quick Share and Mubifiles, and which one fits your situation.';

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

export default function SnapdropAlternativePage() {
  return (
    <ContentPageShell breadcrumbName="Snapdrop alternatives" path={PATH} faq={SNAPDROP_FAQ}>
        <section className="glass card p-5 sm:p-6">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Snapdrop alternatives in 2026
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
            Snapdrop was, for years, the simplest way to move a file between two devices: open a
            website on both, and they found each other. No install, no account. Then it changed
            hands, and the tool most people remember is effectively gone.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
            If you have arrived here because snapdrop.net stopped working, or because it no longer
            feels like the thing you used to trust, this page explains what actually happened and
            lays out the honest options — including where Mubifiles is the wrong choice.
          </p>
        </section>

        <section className="glass card p-5 sm:p-6">
          <h2 className="text-lg font-semibold">What happened to Snapdrop</h2>
          <div className="mt-3 grid gap-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              The original Snapdrop was an open-source project that paired devices over your local
              network through the browser. In 2024 the snapdrop.net domain was sold to LimeWire. The
              project&rsquo;s own maintainers now direct people elsewhere: the GitHub issue that sits
              pinned on the repository states plainly that the site was sold and that PairDrop, built
              on the original code, is the continuation.
            </p>
            <p>
              The Android client that used to support it dropped snapdrop.net entirely, citing
              concerns about the new owner&rsquo;s security and privacy practices, and now points
              only at PairDrop.
            </p>
            <p>
              Alongside that, uptime has been poor. Public status trackers carry a steady stream of
              reports from people finding the site unreachable.
            </p>
            <p>
              None of this means the original idea was bad. It means the address you remember is no
              longer the project you remember.
            </p>
          </div>
        </section>

        {/* min-w-0: as a grid item this section would otherwise default to
            min-width:auto and stretch to the table's width, widening the whole
            page instead of letting the wrapper below scroll. */}
        <section className="glass card min-w-0 p-5 sm:p-6">
          <h2 className="text-lg font-semibold">The options, honestly compared</h2>

          {/* Wide table: scrolls inside its own container so the page body
              never scrolls sideways on a phone. */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border-contrast text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Tool
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Same Wi-Fi needed?
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Install?
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Account?
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    Best at
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row) => (
                  <tr key={row.tool} className="border-b border-border-contrast/60 last:border-0">
                    <th scope="row" className="py-3 pr-3 font-semibold">
                      {row.isUs ? <span className="text-accent">{row.tool}</span> : row.tool}
                    </th>
                    <td className="py-3 pr-3 text-muted-foreground">{row.sameWifi}</td>
                    <td className="py-3 pr-3 text-muted-foreground">{row.install}</td>
                    <td className="py-3 pr-3 text-muted-foreground">{row.account}</td>
                    <td className="py-3 text-muted-foreground">{row.bestAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 grid gap-5">
            {TOOL_NOTES.map((tool) => (
              <div key={tool.name}>
                <h3 className="text-sm font-semibold">{tool.name}</h3>
                {tool.body.map((para) => (
                  <p key={para} className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {para}
                  </p>
                ))}
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  <strong className="font-medium text-foreground">Choose it if</strong> {tool.chooseIt}
                </p>
              </div>
            ))}

            <div>
              <h3 className="text-sm font-semibold">Mubifiles</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Open the site on both devices, read a six-digit code off one, type it into the other.
                Nothing to install, no account.
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Working across networks is not the difference — PairDrop does that too, via public
                rooms. The real one is that{' '}
                <strong className="font-medium text-foreground">
                  Mubifiles stores what you send.
                </strong>{' '}
                PairDrop is peer-to-peer over WebRTC, so both devices have to be online at the same
                moment, with both tabs open. Mubifiles puts the file in storage, so the sender can
                upload and walk away; the receiver picks it up whenever they like inside the session
                window.
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                The second difference is how much you have to think about. PairDrop has three
                connection modes — local network discovery, persistent pairing, and public rooms —
                and which applies depends on where your devices happen to be. Mubifiles has one
                path, a six-digit code, and it behaves the same way every time.
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                It handles text as well as files, which is the case most of these tools treat as an
                afterthought: a link, a password, an error message, a paragraph you want off your
                phone and into an editor.
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Everything is deleted when the session closes.
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                <strong className="font-medium text-foreground">Choose it if</strong> the sender and
                receiver will not be at their devices at the same time, the thing you are moving is
                text, or you simply want the fastest possible start. It works across{' '}
                <Link
                  href="/send-files-between-different-networks"
                  className="font-medium text-accent underline underline-offset-2 hover:opacity-80"
                >
                  different networks
                </Link>{' '}
                either way.{' '}
                <Link
                  href="/"
                  className="font-medium text-accent underline underline-offset-2 hover:opacity-80"
                >
                  Try Mubifiles
                </Link>
                .
              </p>
            </div>
          </div>
        </section>

        <section className="glass card p-5 sm:p-6">
          <h2 className="text-lg font-semibold">When Mubifiles is the wrong tool</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Worth saying clearly, because a comparison page that never recommends anyone else is not
            a comparison page.
          </p>
          <ul className="mt-4 grid gap-3">
            {WRONG_TOOL.map((item) => (
              <li key={item.title} className="flex gap-3">
                <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                <p className="text-sm leading-relaxed text-muted-foreground">
                  <strong className="font-medium text-foreground">{item.title}</strong> {item.body}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <ContentPageFaq faq={SNAPDROP_FAQ} />

        <ContentPageCta
          heading="Try it now"
          body="Open mubifiles.com on both devices. It takes about ten seconds."
        />
    </ContentPageShell>
  );
}
