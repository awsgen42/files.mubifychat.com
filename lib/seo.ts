/** Shared site-level SEO constants, so URLs are never duplicated per page. */

import type { Metadata } from 'next';

export const SITE_URL = 'https://www.mubifiles.com';

/**
 * Absolute rather than relative: some crawlers (WhatsApp notably) will not
 * resolve a relative og:image against the page URL.
 */
export const OG_IMAGE = {
  url: `${SITE_URL}/og.png`,
  width: 1200,
  height: 630,
  alt: 'Mubifiles — send files and text between your devices',
} as const;

/**
 * A page's metadata, from the three things that actually differ.
 *
 * Written after three tool pages had been built by hand and compared: `path`,
 * `title` and `description` varied, and every other line was identical or
 * derived from those three. `openGraph.type` is the one near-constant —
 * 'article' on a tool or an explainer, 'website' on an index — so it is a
 * default rather than a fourth thing to remember.
 *
 * `canonical` takes the path without a trailing slash; `trailingSlash: true`
 * means Next emits the slashed form, which is what actually serves a 200.
 */
export function pageMetadata({
  path,
  title,
  description,
  type = 'article',
}: {
  path: string;
  title: string;
  description: string;
  type?: 'article' | 'website';
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type,
      url: `${SITE_URL}${path}`,
      siteName: 'Mubifiles',
      title,
      description,
      images: [OG_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [OG_IMAGE.url],
    },
  };
}

/**
 * Home → current page. Rendered on subpages only.
 *
 * The trailing slash matters: `trailingSlash: true` means that is the URL that
 * actually serves a 200, so canonical, sitemap and breadcrumb must all agree on
 * it rather than pointing at a redirect.
 */
export function buildBreadcrumbSchema(pageName: string, path: string) {
  const url = `${SITE_URL}${path}`.replace(/\/?$/, '/');
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: pageName, item: url },
    ],
  };
}

/**
 * BlogPosting for a post. No `dateModified`: it would have to be either a lie
 * or a build timestamp, and a build timestamp is the same false signal the
 * sitemap deliberately avoids. `datePublished` is written by hand once.
 */
export function buildArticleSchema(
  article: { headline: string; description: string; published: string },
  path: string,
) {
  const url = `${SITE_URL}${path}`.replace(/\/?$/, '/');
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: article.headline,
    description: article.description,
    datePublished: article.published,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    url,
    image: OG_IMAGE.url,
    author: { '@type': 'Organization', name: 'Mubifiles', url: `${SITE_URL}/` },
    publisher: { '@type': 'Organization', name: 'Mubifiles', url: `${SITE_URL}/` },
  };
}
