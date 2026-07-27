import type { Metadata, Viewport } from 'next';
import { themeBootstrapScript } from '@/lib/useTheme';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mubifiles — instant file & text sharing',
  description:
    'Move text and files between your phone and your PC in seconds. No app, no account — just a 6-digit code.',
  applicationName: 'Mubifiles',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f8fa' },
    { media: '(prefers-color-scheme: dark)', color: '#1b1d24' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
