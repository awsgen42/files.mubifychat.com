import { webcrypto } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { Sha256, lengthBitWords, sha256Hex } from '../lib/sha256';

/**
 * A hand-rolled hash is only worth trusting if it is checked against something
 * that is not itself. So: the published vectors, and WebCrypto over random
 * input at sizes that straddle every boundary in the block padding.
 */
const utf8 = (text: string) => new TextEncoder().encode(text);

/** getRandomValues refuses more than 64 KB at a time. */
function randomBytes(size: number): Uint8Array {
  const bytes = new Uint8Array(size);
  for (let at = 0; at < size; at += 65_536) {
    webcrypto.getRandomValues(bytes.subarray(at, Math.min(at + 65_536, size)));
  }
  return bytes;
}

async function reference(bytes: Uint8Array): Promise<string> {
  const digest = await webcrypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

describe('sha256', () => {
  it('matches the published vectors', () => {
    expect(sha256Hex(utf8(''))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex(utf8('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256Hex(utf8('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'))).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    );
  });

  it('agrees with WebCrypto at every padding boundary', async () => {
    // 55/56 is where the length no longer fits in the final block, 63/64/65
    // straddle a whole block, and the rest are ordinary multi-block inputs.
    for (const size of [0, 1, 55, 56, 57, 63, 64, 65, 127, 128, 129, 1000, 100_000]) {
      const bytes = randomBytes(size);
      expect(sha256Hex(bytes), `size ${size}`).toBe(await reference(bytes));
    }
  });

  it('gives the same answer however the input is split', async () => {
    // The property the whole transfer depends on: sender and receiver chunk
    // the same bytes differently and must still agree.
    const bytes = randomBytes(10_000);
    const expected = await reference(bytes);

    for (const chunkSize of [1, 7, 64, 100, 4096]) {
      const hash = new Sha256();
      for (let at = 0; at < bytes.length; at += chunkSize) {
        hash.update(bytes.subarray(at, Math.min(at + chunkSize, bytes.length)));
      }
      expect(hash.digest(), `chunks of ${chunkSize}`).toBe(expected);
    }
  });

  it('counts length in bits beyond what a 32-bit word holds', () => {
    // Above 512 MB the bit count stops fitting in the low word. Getting this
    // wrong yields a hash that is correct for small files and silently wrong
    // for exactly the large ones a direct transfer is for — so it is worth
    // testing, and worth testing here rather than by hashing 512 MB on every
    // deploy, which cost 15 seconds a run for one boundary.
    expect(lengthBitWords(0)).toEqual([0, 0]);
    expect(lengthBitWords(1)).toEqual([0, 8]);
    // The last size that fits, and the first that does not.
    expect(lengthBitWords(0x2000_0000 - 1)).toEqual([0, 0xffff_fff8]);
    expect(lengthBitWords(0x2000_0000)).toEqual([1, 0]);
    // 1 GB, the per-file limit, and 3 GB, the per-session one.
    expect(lengthBitWords(1024 ** 3)).toEqual([2, 0]);
    expect(lengthBitWords(3 * 1024 ** 3)).toEqual([6, 0]);
  });

  it('refuses to keep hashing after it has been finalised', () => {
    const hash = new Sha256().update(utf8('abc'));
    hash.digest();
    expect(() => hash.update(utf8('more'))).toThrow();
  });

  it('returns the same digest when asked twice', () => {
    const hash = new Sha256().update(utf8('abc'));
    expect(hash.digest()).toBe(hash.digest());
  });
});
