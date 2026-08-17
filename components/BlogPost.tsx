import Link from 'next/link';
import type { ReactNode } from 'react';
import { ContentPageCta, ContentPageShell } from '@/components/ContentPageShell';
import { formatPublished, postsForTool, type BlogPost as Post } from '@/lib/blog';

/**
 * The frame every post shares: the same shell the rest of the site uses, plus
 * the two things a post has that a tool page does not — a date and a link to
 * the thing it is about.
 *
 * There is no second content system here. ContentPageShell already renders a
 * page whose children own their <h1>, which is what /snapdrop-alternative/ has
 * always done; the only addition it needed was BlogPosting schema.
 */
export function BlogPostPage({ post, children }: { post: Post; children: ReactNode }) {
  return (
    <ContentPageShell
      breadcrumbName={post.title}
      path={`/blog/${post.slug}`}
      article={{ headline: post.title, description: post.description, published: post.published }}
    >
      <section className="glass card p-5 sm:p-6">
        <p className="text-xs text-muted-foreground">
          <Link href="/blog" className="hover:text-foreground">
            Notes
          </Link>{' '}
          ·{' '}
          {/* Machine-readable and human-readable from the same value, so they
              cannot drift; written once and never bumped by a deploy. */}
          <time dateTime={post.published}>{formatPublished(post.published)}</time>
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{post.title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">{post.description}</p>
      </section>

      {children}

      <section className="glass card p-5 sm:p-6">
        <h2 className="text-lg font-semibold">The tool this is about</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Everything described here runs in your browser, on your own device, with nothing uploaded.
        </p>
        <Link
          href={post.tool.path}
          className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground shadow-lg shadow-accent/25 transition-all duration-200 hover:shadow-accent/40 hover:brightness-110 active:scale-[0.98]"
        >
          Open {post.tool.name} →
        </Link>
      </section>

      <ContentPageCta
        heading="Or send the whole thing to another device"
        body="Mubifiles moves files and text between two devices with a six-digit code. No account, nothing to install."
      />
    </ContentPageShell>
  );
}

/** A prose section. Posts are mostly these, so the markup lives in one place. */
export function Prose({ heading, children }: { heading?: string; children: ReactNode }) {
  return (
    <section className="glass card p-5 sm:p-6">
      {heading && <h2 className="text-lg font-semibold">{heading}</h2>}
      <div className="mt-3 grid gap-3 text-sm leading-relaxed text-muted-foreground sm:text-base [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:text-foreground [&_code]:font-mono [&_code]:text-[13px] [&_strong]:font-medium [&_strong]:text-foreground">
        {children}
      </div>
    </section>
  );
}

/** A measured result, set apart from the prose because it is evidence. */
export function Measured({ children }: { children: ReactNode }) {
  return (
    <div className="glass-input overflow-x-auto p-3 font-mono text-[12px] leading-relaxed whitespace-pre text-muted-foreground">
      {children}
    </div>
  );
}

/**
 * The link from a tool page back to its post.
 *
 * Read from the same registry as the post's link out, so the pair cannot end
 * up pointing at different things — the internal linking is most of the reason
 * either exists.
 */
export function ToolPostLink({ toolPath }: { toolPath: string }) {
  const posts = postsForTool(toolPath);
  if (posts.length === 0) return null;
  return (
    <section className="glass card p-5 sm:p-6">
      <h2 className="text-lg font-semibold">Read more about this</h2>
      <ul className="mt-3 grid gap-4">
        {posts.map((post) => (
          <li key={post.slug}>
            <Link
              href={`/blog/${post.slug}`}
              className="inline-flex min-h-11 items-center text-sm font-medium text-accent underline underline-offset-4 hover:brightness-110"
            >
              {post.title} →
            </Link>
            <p className="text-sm leading-relaxed text-muted-foreground">{post.hook}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
