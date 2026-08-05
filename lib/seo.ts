/** Shared site-level SEO constants, so URLs are never duplicated per page. */

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
