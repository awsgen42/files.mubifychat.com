import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compareDigest, extractDigest } from '../lib/hashes';

const KNOWN = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

describe('comparing against a published hash', () => {
  it('matches an exact digest', () => {
    expect(compareDigest(KNOWN, KNOWN, 64)).toBe('match');
  });

  it('is not fooled by case or surrounding whitespace', () => {
    expect(compareDigest(KNOWN, `  ${KNOWN.toUpperCase()}\n`, 64)).toBe('match');
  });

  it('picks the hash out of a checksums file line', () => {
    // What people actually paste.
    expect(compareDigest(KNOWN, `${KNOWN}  ubuntu-24.04.iso`, 64)).toBe('match');
    expect(compareDigest(KNOWN, `SHA256 (x.iso) = ${KNOWN}`, 64)).toBe('match');
  });

  it('accepts a hash printed in spaced groups', () => {
    const spaced = (KNOWN.match(/.{1,8}/g) ?? []).join(' ');
    expect(compareDigest(KNOWN, spaced, 64)).toBe('match');
  });

  it('reports a mismatch when one character differs', () => {
    const off = `${KNOWN.slice(0, 63)}6`;
    expect(off).not.toBe(KNOWN);
    expect(compareDigest(KNOWN, off, 64)).toBe('mismatch');
  });

  it('says nothing at all when nothing was pasted', () => {
    expect(compareDigest(KNOWN, '', 64)).toBe('empty');
    expect(compareDigest(KNOWN, '   ', 64)).toBe('empty');
  });

  it('distinguishes an unusable paste from a wrong file', () => {
    // Pasting a SHA-1 into a SHA-256 comparison is a mistake about the
    // algorithm, not evidence that the download is bad. Saying "no match"
    // there would answer a question nobody asked.
    expect(compareDigest(KNOWN, 'da39a3ee5e6b4b0d3255bfef95601890afd80709', 64)).toBe('unrecognised');
    expect(compareDigest(KNOWN, 'not a hash at all', 64)).toBe('unrecognised');
    expect(compareDigest(KNOWN, KNOWN.slice(0, 63), 64)).toBe('unrecognised');
  });

  it('finds the right digest length among several', () => {
    const sha1 = 'da39a3ee5e6b4b0d3255bfef95601890afd80709';
    expect(extractDigest(`md5 d41d8cd98f00b204e9800998ecf8427e sha1 ${sha1}`, 40)).toBe(sha1);
    expect(extractDigest(`md5 d41d8cd98f00b204e9800998ecf8427e sha1 ${sha1}`, 32)).toBe(
      'd41d8cd98f00b204e9800998ecf8427e',
    );
  });
});

/**
 * The control.
 *
 * A suite that is green with nothing proving it can go red is not evidence of
 * anything. This asserts something false — that a deliberately wrong hash
 * reports a match — and is marked as expected to fail, so the suite only stays
 * green while the comparison keeps rejecting a wrong hash. If compareDigest
 * ever started returning 'match' for a mismatch, this test would begin to
 * *pass*, and vitest would fail the run for it.
 */
describe('control: the comparison must be able to say no', () => {
  it.fails('reports a match for a deliberately wrong expected hash', () => {
    const wrong = 'f'.repeat(64);
    expect(wrong).not.toBe(KNOWN);
    expect(compareDigest(KNOWN, wrong, 64)).toBe('match');
  });
});

/**
 * Under the generator this stops being a reminder to update a file by hand and
 * becomes the check that the generator is doing its job: if it silently
 * emitted a short list, the missing routes show up here.
 */
describe('sitemap covers every built route', () => {
  const OUT = 'out';
  const NOT_INDEXABLE = new Set(['/404/', '/_not-found/']);

  const built = (): string[] => {
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((entry) => {
        const path = join(dir, entry);
        return statSync(path).isDirectory() ? walk(path) : [path];
      });
    return walk(OUT)
      .map((path) => relative(OUT, path).split(sep).join('/'))
      .filter((rel) => rel === 'index.html' || rel.endsWith('/index.html'))
      .map((rel) => (rel === 'index.html' ? '/' : `/${rel.slice(0, -'index.html'.length)}`))
      .filter((url) => !NOT_INDEXABLE.has(url));
  };

  it.skipIf(!existsSync(OUT))('lists every page the export produced', () => {
    const sitemap = readFileSync(join(OUT, 'sitemap.xml'), 'utf8');
    const listed = [...sitemap.matchAll(/<loc>https:\/\/www\.mubifiles\.com([^<]*)<\/loc>/g)].map(
      (m) => m[1],
    );
    expect(listed.length).toBeGreaterThanOrEqual(6);
    for (const url of built()) expect(listed, `${url} is missing from sitemap.xml`).toContain(url);
  });

  it.skipIf(!existsSync(OUT))('lists nothing that is not a built page', () => {
    const sitemap = readFileSync(join(OUT, 'sitemap.xml'), 'utf8');
    const listed = [...sitemap.matchAll(/<loc>https:\/\/www\.mubifiles\.com([^<]*)<\/loc>/g)].map(
      (m) => m[1],
    );
    const pages = new Set(built());
    for (const url of listed) expect(pages, `${url} is listed but did not build`).toContain(url);
  });

  it('is generated, with no second copy in public/ to disagree with it', () => {
    // Next copies public/ into out/, so a file in both places has a winner
    // decided by step order rather than by intent.
    expect(existsSync(join('public', 'sitemap.xml'))).toBe(false);
  });
});
