import type { Metadata, Viewport } from 'next';
import { OG_IMAGE, SITE_URL } from '@/lib/seo';
import { ServiceWorker } from '@/components/ServiceWorker';
import { THEME_BACKGROUND } from '@/lib/theme';
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
  // Merged in, not replacing anything. The SVG is listed first so browsers
  // that support it use the scalable mark; the .ico is the fallback and is
  // also what Windows and older browsers look for at the root. Removing
  // app/icon.svg was part of this: the Next file convention was serving its
  // own /icon.svg and would have shadowed the one in public/.
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: '48x48' },
    ],
    apple: '/apple-touch-icon.png',
  },
  manifest: '/manifest.webmanifest',
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
  /**
   * The only thing that can colour the canvas before the stylesheet resolves.
   *
   * Next emits its stylesheet as the third tag in the head and our inline
   * bootstrap script far below it — and a synchronous script that follows a
   * pending stylesheet is blocked until that stylesheet loads. So the script
   * cannot run before CSS, and nothing authored in CSS can help either: until
   * it resolves, the browser paints its own default canvas, which is white.
   * That is the frame between the dark splash and the dark app.
   *
   * This meta is parsed rather than computed, so the browser applies it
   * immediately and picks the canvas from the system preference. Declaring
   * both means the choice follows the user rather than being hardcoded.
   */
  colorScheme: 'light dark',

  // The same values the bootstrap script paints with, so the browser chrome
  // and the page cannot disagree about what colour the app is.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: THEME_BACKGROUND.light },
    { media: '(prefers-color-scheme: dark)', color: THEME_BACKGROUND.dark },
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
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
