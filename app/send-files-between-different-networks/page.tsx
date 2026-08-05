import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentPageCta, ContentPageFaq, ContentPageShell } from '@/components/ContentPageShell';
import { NETWORKS_FAQ, NOT_WORKING, PRACTICAL_RULE, WHY_SAME_WIFI } from '@/lib/networks';
import { OG_IMAGE, SITE_URL } from '@/lib/seo';

const PATH = '/send-files-between-different-networks';
const TITLE = 'Send Files Between Devices on Different Networks — No Same Wi-Fi Needed';
const DESCRIPTION =
  'Most browser file-transfer tools need both devices on one Wi-Fi. Here’s why, and how to move files when your phone is on mobile data and your laptop isn’t.';

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

export default function DifferentNetworksPage() {
  return (
    <ContentPageShell breadcrumbName="Different networks" path={PATH} faq={NETWORKS_FAQ}>
      <section className="glass card p-5 sm:p-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Sending files between devices on different networks
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
          Almost every quick file-transfer tool has the same footnote: <em>both devices must be on
          the same Wi-Fi.</em> That is fine at home. It falls apart the moment your phone is on
          mobile data, your laptop is on a café network, or you are on an office Wi-Fi that isolates
          clients from each other.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
          This page explains why that limitation exists, and what to do when it applies to you.
        </p>
      </section>

      <section className="glass card p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Why most tools need the same Wi-Fi</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          The fast browser-based tools work by having your two devices talk to each other directly,
          over the local network, without a server in the middle. That is what makes them quick and
          private — the file never leaves your house.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          It is also exactly what breaks. Direct device-to-device connections need the two devices to
          be able to see each other, and that requires:
        </p>
        <ul className="mt-4 grid gap-3">
          {WHY_SAME_WIFI.map((item) => (
            <li key={item.title} className="flex gap-3">
              <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <p className="text-sm leading-relaxed text-muted-foreground">
                <strong className="font-medium text-foreground">{item.title}</strong> {item.body}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          So “same Wi-Fi” is really “same Wi-Fi, and that Wi-Fi has to allow it” — which is why the
          tools feel unreliable rather than simply limited.
        </p>
      </section>

      <section className="glass card p-5 sm:p-6">
        <h2 className="text-lg font-semibold">What works across different networks</h2>
        <div className="mt-4 grid gap-5">
          <div>
            <h3 className="text-sm font-semibold">A relay-based browser tool</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              Instead of connecting the devices directly, the file goes up to a server and comes back
              down on the other side. You lose the “never leaves my house” property and you are
              bounded by your upload speed. In exchange, it works from anywhere to anywhere.
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              <strong className="font-medium text-foreground">Mubifiles</strong> works this way. Open
              the site on both devices, share a six-digit code, send. The two devices never need to
              see each other. Files are deleted when the session closes.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold">PairDrop public rooms or pairing</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              PairDrop, the successor to Snapdrop, crosses networks two ways. A temporary public room
              needs no setup at all: enter a five-letter code on both devices and they connect over
              the internet, with a TURN server bridging NAT automatically. Persistent pairing does
              the same for devices you use together often.
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              Transfers stay peer-to-peer, which means no third party stores your file and there is
              no hard size limit — but it also means both devices have to be online at the same
              moment, with both tabs open.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold">Cloud storage</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              Google Drive, Dropbox, OneDrive. Reliable and universal, but heavier: upload, wait,
              switch device, find the file, download, and then remember to delete it. Good for things
              you want to keep. Overkill for a screenshot.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold">Messaging yourself</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              Works everywhere, but compresses images and video, and permanently clutters a chat you
              use for other things.
            </p>
          </div>
        </div>
      </section>

      <section className="glass card p-5 sm:p-6">
        <h2 className="text-lg font-semibold">What does not work across networks</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Worth being direct about these so you do not waste time:
        </p>
        <ul className="mt-4 grid gap-3">
          {NOT_WORKING.map((item) => (
            <li key={item.tool} className="flex gap-3">
              <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <p className="text-sm leading-relaxed text-muted-foreground">
                <strong className="font-medium text-foreground">
                  {item.linkTo ? (
                    <Link
                      href={item.linkTo}
                      className="text-accent underline underline-offset-2 hover:opacity-80"
                    >
                      {item.tool}
                    </Link>
                  ) : (
                    item.tool
                  )}
                </strong>{' '}
                — {item.note}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          If you are on the same reliable network, prefer one of these. Local transfer beats anything
          routed through the internet on both speed and privacy.
        </p>
      </section>

      <section className="glass card p-5 sm:p-6">
        <h2 className="text-lg font-semibold">A practical rule</h2>
        <ul className="mt-4 grid gap-3">
          {PRACTICAL_RULE.map((item) => (
            <li key={item.when} className="flex gap-3">
              <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <p className="text-sm leading-relaxed text-muted-foreground">
                <strong className="font-medium text-foreground">{item.when}</strong>{' '}
                <span aria-hidden="true">→</span> {item.then}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <ContentPageFaq faq={NETWORKS_FAQ} />

      <ContentPageCta
        heading="Try it across your own two networks"
        body="Open mubifiles.com on both devices."
      />
    </ContentPageShell>
  );
}
