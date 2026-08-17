import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentPageCta, ContentPageShell } from '@/components/ContentPageShell';
import { BLOG_DESCRIPTION, BLOG_TITLE, POSTS, formatPublished } from '@/lib/blog';
import { pageMetadata } from '@/lib/seo';

const PATH = '/blog';

export const metadata: Metadata = pageMetadata({
  path: PATH,
  title: 'Notes on Moving Files Around — the Mubifiles blog',
  description: BLOG_DESCRIPTION,
  type: 'website',
});

export default function BlogIndexPage() {
  return (
    <ContentPageShell breadcrumbName="Notes" path={PATH} title={BLOG_TITLE} subhead={BLOG_DESCRIPTION}>
      <section className="glass card p-5 sm:p-6">
        <h2 className="sr-only">Posts</h2>
        <ul className="grid gap-5">
          {POSTS.map((post) => (
            <li key={post.slug}>
              <Link
                href={`/blog/${post.slug}`}
                className="group block rounded-xl -m-2 p-2 transition-colors hover:bg-accent-soft"
              >
                <p className="text-xs text-muted-foreground">
                  <time dateTime={post.published}>{formatPublished(post.published)}</time>
                </p>
                <p className="mt-1 font-medium group-hover:text-accent">{post.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{post.hook}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="glass card p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Why there are only five</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Because each one had to contain something we could only write after building the thing it
          describes — a measurement, a failure we hit, a piece of behaviour we checked rather than
          assumed. There is no shortage of topics; there is a shortage of posts that would be worse
          if someone else wrote them.
        </p>
      </section>

      <ContentPageCta
        heading="Move a file between two devices"
        body="A six-digit code on each end. No account, nothing to install, and the session deletes itself."
      />
    </ContentPageShell>
  );
}
