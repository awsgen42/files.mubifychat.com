import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { POSTS, formatPublished, postsForTool } from '../lib/blog';
import { ROUTE_META } from '../lib/routes';

const OUT = 'out';
const built = existsSync(OUT);
const html = (path: string) => readFileSync(join(OUT, path, 'index.html'), 'utf8');
const jsonLd = (source: string) =>
  [...source.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) =>
    JSON.parse(m[1]),
  );

describe('the post registry', () => {
  it('has five posts, which is the decision rather than a starting point', () => {
    expect(POSTS).toHaveLength(5);
  });

  it('has a page behind every entry', () => {
    for (const post of POSTS) {
      expect(existsSync(join('app', 'blog', post.slug, 'page.tsx')), post.slug).toBe(true);
    }
  });

  it('lists every post in the sitemap table', () => {
    expect('/blog/' in ROUTE_META).toBe(true);
    for (const post of POSTS) expect(`/blog/${post.slug}/` in ROUTE_META, post.slug).toBe(true);
  });

  it('points every post at a tool that exists', () => {
    for (const post of POSTS) {
      const dir = post.tool.path === '/tools' ? 'app/tools' : join('app', post.tool.path.slice(1));
      expect(existsSync(join(dir, 'page.tsx')), post.tool.path).toBe(true);
    }
  });

  /**
   * The date is written by hand and never touched again — the same decision as
   * the sitemap's absent lastmod. A date derived at build time would move on
   * every deploy, which is a false claim about the content.
   */
  it('has dates that are fixed, real and not in the future', () => {
    for (const post of POSTS) {
      expect(post.published, post.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(post.published)), post.slug).toBe(false);
      expect(Date.parse(post.published) <= Date.now(), post.slug).toBe(true);
    }
  });

  it('does not compute a date at build time anywhere in the blog code', () => {
    const sources = ['lib/blog.ts', 'components/BlogPost.tsx', ...POSTS.map((p) => `app/blog/${p.slug}/page.tsx`)];
    for (const file of sources) {
      const source = readFileSync(file, 'utf8');
      expect(/new Date\(\)|Date\.now\(\)/.test(source), file).toBe(false);
    }
  });

  it('writes the month out, since 08/17 and 17/08 are different dates', () => {
    expect(formatPublished('2026-08-17')).toBe('17 August 2026');
  });

  it('finds every post for a tool, not just the first', () => {
    // Two posts point at the splitter; a singular lookup dropped one.
    expect(postsForTool('/tools/split-file').map((p) => p.slug)).toEqual([
      'how-to-open-a-001-file',
      'send-a-file-too-big-for-email',
    ]);
    expect(postsForTool('/tools/qr')).toEqual([]);
  });
});

describe.skipIf(!built)('what the posts actually ship', () => {
  it.each(POSTS.map((p) => p.slug))('%s emits BlogPosting with the date from the registry', (slug) => {
    const post = POSTS.find((p) => p.slug === slug)!;
    const types = jsonLd(html(`blog/${slug}`)).map((entry) => entry['@type']);
    expect(types).toContain('BlogPosting');
    const article = jsonLd(html(`blog/${slug}`)).find((entry) => entry['@type'] === 'BlogPosting');
    expect(article.datePublished).toBe(post.published);
    expect(article.headline).toBe(post.title);
  });

  /**
   * FAQPage belongs only where a FAQ renders. A post is an article; claiming
   * both would be exactly the mismatch the placement check exists to catch.
   */
  it.each(POSTS.map((p) => p.slug))('%s emits no FAQPage', (slug) => {
    const types = jsonLd(html(`blog/${slug}`)).map((entry) => entry['@type']);
    expect(types).not.toContain('FAQPage');
  });

  it.each(POSTS.map((p) => p.slug))('%s is a real prerendered page with one h1', (slug) => {
    const source = html(`blog/${slug}`);
    const headings = [...source.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)];
    expect(headings).toHaveLength(1);
    expect(source).toContain('rel="canonical"');
  });

  it.each(POSTS.map((p) => p.slug))('%s links to its tool', (slug) => {
    const post = POSTS.find((p) => p.slug === slug)!;
    expect(html(`blog/${slug}`)).toContain(`href="${post.tool.path}/"`);
  });

  it('links back from each tool page to its post', () => {
    for (const post of POSTS) {
      if (post.tool.path === '/tools') continue;
      const source = html(post.tool.path.slice(1));
      expect(source, post.tool.path).toContain(`href="/blog/${post.slug}/"`);
    }
  });

  it('lists every post on the index', () => {
    const source = html('blog');
    for (const post of POSTS) expect(source, post.slug).toContain(`href="/blog/${post.slug}/"`);
  });

  it('puts the Blog link in the static HTML of every page, not on hydration', () => {
    for (const page of ['', 'tools', 'privacy', 'blog', 'tools/split-file', 'blog/how-to-open-a-001-file']) {
      expect(html(page), page || '/').toContain('href="/blog/"');
    }
  });

  it('marks the Blog link current on blog pages and nowhere else', () => {
    // React emits aria-current before href, so the tag is found first and its
    // attributes checked separately rather than assuming an order.
    const navLink = (page: string) =>
      (html(page).match(/<a\b[^>]*href="\/blog\/"[^>]*>/) ?? [''])[0];
    const onBlog = /aria-current="(page|true)"/.test(navLink('blog'));
    const onPost = /aria-current="(page|true)"/.test(navLink('blog/how-to-open-a-001-file'));
    const onTools = /aria-current=/.test(navLink('tools'));
    expect(onBlog).toBe(true);
    expect(onPost).toBe(true);
    expect(onTools).toBe(false);
  });
});

/* ------------------------------------------------------------------ */

/**
 * If a post ever emitted FAQPage, the placement check on the whole site would
 * be reporting a mismatch — this states that it does not, by asserting the
 * opposite and requiring the assertion to fail.
 */
describe.skipIf(!built)('control: a post must not claim FAQPage', () => {
  it.fails('finds FAQPage on a post', () => {
    const types = jsonLd(html('blog/how-to-open-a-001-file')).map((entry) => entry['@type']);
    expect(types).toContain('FAQPage');
  });
});

/**
 * The header link has to be in the served HTML rather than attached on
 * hydration, or a crawler never sees it and the section is orphaned.
 */
describe.skipIf(!built)('control: the header link must really be in the static output', () => {
  it.fails('finds no Blog link in the prerendered HTML', () => {
    expect(html('tools/checksum')).not.toContain('href="/blog/"');
  });
});
