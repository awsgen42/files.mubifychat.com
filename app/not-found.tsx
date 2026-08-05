import Link from 'next/link';
import { SiteFooter } from '@/components/SiteFooter';

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-sm text-muted-foreground">
        That link doesn&apos;t point anywhere. Sessions are short-lived, so it may simply have expired.
      </p>
      <Link
        href="/"
        className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground hover:opacity-90"
      >
        Back to Mubifiles
      </Link>
      <SiteFooter />
    </div>
  );
}
