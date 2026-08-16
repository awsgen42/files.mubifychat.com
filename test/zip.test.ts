import { describe, expect, it } from 'vitest';
import { crc32, safeEntryName } from '../lib/zip';

const bytes = (text: string) => new TextEncoder().encode(text) as Uint8Array<ArrayBuffer>;

describe('crc32', () => {
  it('matches the published vectors', () => {
    // The check value every CRC-32 implementation is measured against.
    expect(crc32(bytes('123456789')).toString(16)).toBe('cbf43926');
    expect(crc32(bytes(''))).toBe(0);
    expect(crc32(bytes('a')).toString(16)).toBe('e8b7be43');
    expect(crc32(bytes('abc')).toString(16)).toBe('352441c2');
  });

  it('stays unsigned for inputs that set the top bit', () => {
    // A signed result here writes a negative number into the header and every
    // unzip tool rejects the archive.
    for (const value of ['', 'a', 'abc', '123456789', 'the quick brown fox']) {
      expect(crc32(bytes(value))).toBeGreaterThanOrEqual(0);
      expect(crc32(bytes(value))).toBeLessThanOrEqual(0xffffffff);
    }
  });
});

describe('entry names', () => {
  it('strips path separators so nothing escapes the extraction folder', () => {
    const taken = new Set<string>();
    expect(safeEntryName('../../etc/passwd', taken)).toBe('.._.._etc_passwd'.replace(/^\.+/, ''));
    expect(safeEntryName('a\\b.jpg', new Set())).toBe('a_b.jpg');
  });

  it('numbers duplicates rather than losing one of them', () => {
    const taken = new Set<string>();
    expect(safeEntryName('photo.jpg', taken)).toBe('photo.jpg');
    expect(safeEntryName('photo.jpg', taken)).toBe('photo (2).jpg');
    expect(safeEntryName('photo.jpg', taken)).toBe('photo (3).jpg');
  });

  it('keeps the extension when numbering', () => {
    const taken = new Set(['a.tar.gz']);
    expect(safeEntryName('a.tar.gz', taken)).toBe('a.tar (2).gz');
  });

  it('falls back to a name for input that reduces to nothing', () => {
    expect(safeEntryName('...', new Set())).toBe('file');
  });
});
