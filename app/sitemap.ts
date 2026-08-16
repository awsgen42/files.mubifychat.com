import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { MetadataRoute } from 'next';
import { DEFAULT_META, EXCLUDED_ROUTES, MIN_URLS, ROUTE_META, SITE_URL } from '@/lib/routes';

/**
 * The sitemap, emitted by `next build` itself.
 *
 * It was a post-build script until /sitemap.xml turned out to be a 404 in
 * production while every local check passed. The script only ran as one step
 * inside `npm run build`; a deploy that ran `next build` produced a complete,
 * working site with no sitemap in it and exit code 0. Nothing could notice,
 * because nothing that ran knew the file was supposed to exist.
 *
 * As a route it is part of the export. Any command that builds the site at all
 * builds this too, and there is no longer a step to leave out.
 *
 * Routes are read from the app directory rather than only from the table, so a
 * new page cannot be silently left out of the index — the worst outcome here is
 * failing to index something, not indexing it at the wrong priority.
 */
export const dynamic = 'force-static';

const APP_DIR = 'app';

/** Every route the app directory defines, in the served trailing-slash form. */
function builtRoutes(): string[] {
  const found: string[] = [];

  const walk = (dir: string, prefix: string) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) {
        // Route groups are organisational and contribute nothing to the URL;
        // private folders are not routes at all.
        if (entry.startsWith('_')) continue;
        const segment = entry.startsWith('(') && entry.endsWith(')') ? '' : `${entry}/`;
        walk(path, `${prefix}${segment}`);
      } else if (/^page\.(tsx|ts|jsx|js)$/.test(entry)) {
        found.push(`/${prefix}`);
      }
    }
  };

  walk(APP_DIR, '');
  return found.filter((url) => !EXCLUDED_ROUTES.has(url)).sort();
}

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = builtRoutes();

  for (const url of routes) {
    if (!(url in ROUTE_META)) {
      console.warn(`sitemap: ${url} has no entry in ROUTE_META; using ${DEFAULT_META.priority}/${DEFAULT_META.changefreq}`);
    }
  }

  // A table entry with no page behind it is a stale row pointing at a 404.
  const missing = Object.keys(ROUTE_META).filter((url) => !routes.includes(url));
  if (missing.length > 0) {
    throw new Error(
      `sitemap: these are listed in ROUTE_META but no page defines them: ${missing.join(', ')}. ` +
        'Remove them from the table or fix the route.',
    );
  }

  if (routes.length < MIN_URLS) {
    throw new Error(
      `sitemap: only ${routes.length} URLs, expected at least ${MIN_URLS}. ` +
        'Refusing to build a sitemap that would drop pages out of the index.',
    );
  }

  return routes.map((url) => {
    const meta = ROUTE_META[url] ?? DEFAULT_META;
    return {
      url: `${SITE_URL}${url}`,
      changeFrequency: meta.changefreq,
      priority: meta.priority,
    };
  });
}
