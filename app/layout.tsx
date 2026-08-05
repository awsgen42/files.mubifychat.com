import type { Metadata, Viewport } from 'next';
import { OG_IMAGE, SITE_URL } from '@/lib/seo';
import { themeBootstrapScript } from '@/lib/useTheme';
import './globals.css';

const TITLE = 'Mubifiles — instant file & text sharing between devices';
const DESCRIPTION =
  'Move text and files between your phone and your PC in seconds. No app, no account — just a 6-digit code or a QR scan. Files are deleted automatically when the session closes.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: 'Mubifiles',
  keywords: [
    'file sharing',
    'send files phone to pc',
    'share text between devices',
    'no account file transfer',
    'QR file transfer',
  ],
  // Hardcoded to the clean homepage: the static export serves the same
  // document for /?code=123456, and those session URLs must never be treated
  // as separate pages.
  alternates: { canonical: '/' },
  robots: { index: true, follow: true },
  verification: {
    google: 'kEYztc7CjWwoB4GtD6Aos-eh-MtuVuNQtokdnfy-XkM',
  },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: 'Mubifiles',
    title: TITLE,
    description: DESCRIPTION,
    // Absolute rather than relative: some crawlers (WhatsApp notably) will not
    // resolve a relative og:image against the page URL.
    images: [OG_IMAGE],
  },
  twitter: {
    // With an image attached, `summary` renders a small thumbnail; the
    // full-bleed card needs summary_large_image.
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE.url],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f4fa' },
    { media: '(prefers-color-scheme: dark)', color: '#16161f' },
  ],
};

/** schema.org WebApplication, emitted into the static HTML at build time. */
const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Mubifiles',
  url: SITE_URL,
  description: DESCRIPTION,
  applicationCategory: 'UtilitiesApplication',
  operatingSystem: 'Any (web browser)',
  browserRequirements: 'Requires JavaScript.',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  featureList: [
    'Share text between devices with a 6-digit code',
    'Send files directly from a phone to a PC',
    'QR code pairing',
    'Automatic expiry after 15 minutes of inactivity',
    'Optional one-time downloads',
    'No account required',
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
        {/* WebApplication describes the product, so it belongs site-wide.
            FAQPage does not: it is emitted per page, next to the questions it
            describes, so a page can never advertise an FAQ it doesn't show. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
