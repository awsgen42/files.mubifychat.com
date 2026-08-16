import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The header link, asserted against the prerendered HTML.
 *
 * Everything here reads the export rather than the JSX, because the claim
 * being made is about what a crawler receives — a link attached on hydration
 * would satisfy any test that rendered the component and none of these.
 */
const built = existsSync('out');
const PAGES = [
  'out/index.html',
  'out/privacy/index.html',
  'out/terms/index.html',
  'out/report/index.html',
  'out/snapdrop-alternative/index.html',
  'out/send-files-between-different-networks/index.html',
  'out/tools/index.html',
  'out/tools/checksum/index.html',
  'out/tools/qr/index.html',
  'out/tools/image-compress/index.html',
];

const header = (file: string): string => {
  const html = readFileSync(file, 'utf8');
  return html.slice(html.indexOf('<header'), html.indexOf('</header>') + '</header>'.length);
};

describe.skipIf(!built).each(PAGES)('%s header', (page) => {
  it('carries a real anchor to /tools/ in the static HTML', () => {
    // The trailing slash matters: that is the URL that serves a 200, and a
    // link to the unslashed form would point at a redirect.
    expect(header(page)).toMatch(/<a[^>]+href="\/tools\/"/);
  });

  it('gives the link an accessible name', () => {
    expect(header(page)).toMatch(/<a[^>]+href="\/tools\/"[^>]*>Tools<\/a>/);
  });

  it('keeps the link quiet rather than primary', () => {
    const anchor = header(page).match(/<a[^>]+href="\/tools\/"[^>]*>/)?.[0] ?? '';
    // Ghost weight: no accent fill, no shadow. On `/` the primary action is
    // starting a session and the header must not compete with it.
    expect(anchor).not.toMatch(/bg-accent(?!-soft)/);
    expect(anchor).not.toMatch(/shadow-lg/);
  });

  it('gives it a 44px touch target and a focus ring', () => {
    const anchor = header(page).match(/<a[^>]+href="\/tools\/"[^>]*>/)?.[0] ?? '';
    expect(anchor).toContain('min-h-11');
    expect(anchor).toContain('focus-visible:ring-2');
  });
});

describe.skipIf(!built)('active state', () => {
  const anchor = (page: string) => header(page).match(/<a[^>]+href="\/tools\/"[^>]*>/)?.[0] ?? '';

  it('marks the link current inside the tools section', () => {
    expect(anchor('out/tools/index.html')).toContain('aria-current="page"');
    // A tool page is within the section but is not itself /tools/.
    expect(anchor('out/tools/checksum/index.html')).toContain('aria-current="true"');
    expect(anchor('out/tools/qr/index.html')).toContain('aria-current="true"');
  });

  it('applies the accent treatment there, and nowhere else', () => {
    expect(anchor('out/tools/index.html')).toContain('bg-accent-soft');
    for (const page of ['out/index.html', 'out/privacy/index.html', 'out/report/index.html']) {
      expect(anchor(page), page).not.toContain('bg-accent-soft');
      expect(anchor(page), page).not.toContain('aria-current');
    }
  });
});

describe.skipIf(!built)('the footer link is kept', () => {
  it('still points at /tools/ from the footer of every page', () => {
    for (const page of PAGES) {
      const html = readFileSync(page, 'utf8');
      const footer = html.slice(html.indexOf('<footer'), html.indexOf('</footer>'));
      expect(footer, page).toMatch(/href="\/tools\/"/);
    }
  });
});

/**
 * Controls.
 *
 * Both assert something false. They exist because the tests above would pass
 * just as happily against a link injected on hydration, or against a link that
 * lit up its active state everywhere — so each failure is what carries the
 * evidence, not the green tick beside it.
 */
describe.skipIf(!built)('control: the link must really be in the static output', () => {
  it.fails('is absent from the prerendered HTML', () => {
    expect(readFileSync('out/index.html', 'utf8')).not.toContain('href="/tools/"');
  });
});

describe.skipIf(!built)('control: the active state must be conditional', () => {
  it.fails('is applied on the home page', () => {
    const anchor = header('out/index.html').match(/<a[^>]+href="\/tools\/"[^>]*>/)?.[0] ?? '';
    expect(anchor).toContain('bg-accent-soft');
  });
});
