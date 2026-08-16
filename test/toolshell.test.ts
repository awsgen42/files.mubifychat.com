import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The tool-page ordering, asserted against the prerendered HTML rather than
 * the JSX — what matters is the document a crawler receives and the order a
 * screen reader walks, and both come from the export.
 */
const TOOL_PAGES = ['out/tools/checksum/index.html', 'out/tools/qr/index.html'];
const built = existsSync('out');

/** Position of the first occurrence, or -1. */
const at = (html: string, needle: string | RegExp): number =>
  typeof needle === 'string' ? html.indexOf(needle) : (html.match(needle)?.index ?? -1);

/**
 * Just the <main> element.
 *
 * Scoped deliberately: the shell's header carries a theme toggle, which is a
 * real <button> earlier in the document than anything on the page. Searching
 * the whole document for "the first control" finds that instead of the tool,
 * which is exactly the mistake this scoping prevents.
 */
const main = (html: string): string =>
  html.slice(html.indexOf('<main'), html.indexOf('</main>'));

/** Where the tool starts: the first interactive control inside <main>. */
function firstControlInMain(html: string): number {
  const scoped = main(html);
  const found = [scoped.indexOf('<button'), scoped.indexOf('<input'), scoped.indexOf('<textarea')].filter(
    (i) => i >= 0,
  );
  return found.length > 0 ? Math.min(...found) : -1;
}

function headings(html: string): string[] {
  const body = html.slice(html.indexOf('<body'));
  return [...body.matchAll(/<(h[1-6])\b[^>]*>([\s\S]*?)<\/\1>/g)].map(
    (m) => `${m[1]}: ${m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()}`,
  );
}

describe.skipIf(!built).each(TOOL_PAGES)('%s', (page) => {
  const html = () => readFileSync(page, 'utf8');

  it('opens with exactly one h1', () => {
    const h1s = headings(html()).filter((h) => h.startsWith('h1:'));
    expect(h1s).toHaveLength(1);
    expect(headings(html())[0]).toMatch(/^h1:/);
  });

  it('puts the tool above the explanatory copy and the FAQ', () => {
    const source = html();
    const scoped = main(source);
    const control = firstControlInMain(source);
    const faq = scoped.indexOf('Frequently asked questions');
    const explainer = scoped.indexOf('Useful for confirming') >= 0
      ? scoped.indexOf('Useful for confirming')
      : scoped.indexOf('download it as a PNG for');

    expect(control).toBeGreaterThan(scoped.indexOf('<h1'));
    expect(control).toBeLessThan(explainer);
    expect(explainer).toBeLessThan(faq);
  });

  it('still carries the FAQ schema and the canonical', () => {
    const source = html();
    expect(source).toContain('"@type":"FAQPage"');
    expect(source).toMatch(/<link rel="canonical" href="https:\/\/www\.mubifiles\.com\/tools\/[a-z]+\/"\/>/);
  });
});

/**
 * The control.
 *
 * Asserts the opposite of the ordering rule — that the tool sits below the
 * FAQ — and is expected to fail. Without it, the ordering tests above would
 * pass just as happily against a page where nothing had been reordered at
 * all, since they would still find a button somewhere before the FAQ.
 */
describe.skipIf(!built)('control: the tool must not be below the FAQ', () => {
  it.fails('renders the tool after the FAQ in document order', () => {
    const source = readFileSync(TOOL_PAGES[0], 'utf8');
    expect(firstControlInMain(source)).toBeGreaterThan(main(source).indexOf('Frequently asked questions'));
  });
});
