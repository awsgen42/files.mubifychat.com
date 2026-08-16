import { createHash, webcrypto } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { lengthBitWords } from '../lib/blockhash';
import { Md5, md5Hex } from '../lib/md5';
import { Sha1, sha1Hex } from '../lib/sha1';
import { Sha256, sha256Hex } from '../lib/sha256';

/**
 * A checksum tool that returns a wrong digest is worse than no tool, so all
 * three algorithms are held to the bar SHA-256 already met: published vectors,
 * agreement with an independent implementation over random input, every
 * padding boundary, and agreement across chunk sizes — because streaming is
 * the whole point and a hash that only works when fed in one go would pass a
 * naive suite.
 */
const utf8 = (text: string) => new TextEncoder().encode(text);

function randomBytes(size: number): Uint8Array {
  const bytes = new Uint8Array(size);
  for (let at = 0; at < size; at += 65_536) {
    webcrypto.getRandomValues(bytes.subarray(at, Math.min(at + 65_536, size)));
  }
  return bytes;
}

const ALGORITHMS = [
  { name: 'sha256', node: 'sha256', create: () => new Sha256(), oneShot: sha256Hex },
  { name: 'sha1', node: 'sha1', create: () => new Sha1(), oneShot: sha1Hex },
  { name: 'md5', node: 'md5', create: () => new Md5(), oneShot: md5Hex },
] as const;

const reference = (algorithm: string, bytes: Uint8Array) =>
  createHash(algorithm).update(bytes).digest('hex');

/** RFC 1321, RFC 3174 and FIPS 180-4 worked examples. */
const VECTORS = {
  sha256: {
    '': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    abc: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq':
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
  },
  sha1: {
    '': 'da39a3ee5e6b4b0d3255bfef95601890afd80709',
    abc: 'a9993e364706816aba3e25717850c26c9cd0d89d',
    'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq':
      '84983e441c3bd26ebaae4aa1f95129e5e54670f1',
  },
  md5: {
    '': 'd41d8cd98f00b204e9800998ecf8427e',
    abc: '900150983cd24fb0d6963f7d28e17f72',
    'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq':
      '8215ef0796a20bcaaae116d3876c664a',
  },
} as const;

describe.each(ALGORITHMS)('$name', ({ name, node, create, oneShot }) => {
  it('matches the published vectors', () => {
    for (const [input, expected] of Object.entries(VECTORS[name])) {
      expect(oneShot(utf8(input)), JSON.stringify(input)).toBe(expected);
    }
  });

  // Every one is its own case so a run lists them rather than reporting a
  // count. The interesting ones are where the 8-byte length field lands:
  // at 55 it still fits in the block holding the data, at 56 it no longer
  // does and forces another block. That repeats at every multiple of 64, so
  // 119/120 and 183/184 are the same boundary one and two blocks later —
  // which is where an endianness mistake in the length word shows up while
  // remaining invisible for most other sizes.
  it.each([0, 1, 54, 55, 56, 57, 63, 64, 65, 118, 119, 120, 121, 127, 128, 129, 182, 183, 184, 185, 1000])(
    'agrees with Node at %i bytes',
    (size) => {
      const bytes = randomBytes(size);
      expect(oneShot(bytes)).toBe(reference(node, bytes));
    },
  );

  it('agrees with Node on 500 random inputs of random length', () => {
    const lengths: number[] = [];
    for (let run = 0; run < 500; run++) {
      // Uniform over 0..4095, so roughly one in sixteen lands within eight
      // bytes of a block boundary rather than avoiding them.
      const size = Math.floor(Math.random() * 4096);
      lengths.push(size);
      const bytes = randomBytes(size);
      expect(oneShot(bytes), `length ${size}`).toBe(reference(node, bytes));
    }
    expect(lengths).toHaveLength(500);
    expect(Math.max(...lengths)).toBeGreaterThan(3000);
  });

  // The property the whole feature depends on: a file arrives in chunks whose
  // size is a detail of the reader, and the digest must not care. Sizes below,
  // at and above a block are all covered.
  it.each([1, 7, 63, 64, 65, 100, 4096])('gives the same answer in chunks of %i', (chunkSize) => {
    const bytes = randomBytes(10_000);
    const expected = reference(node, bytes);
    const hash = create();
    for (let at = 0; at < bytes.length; at += chunkSize) {
      hash.update(bytes.subarray(at, Math.min(at + chunkSize, bytes.length)));
    }
    expect(hash.digest()).toBe(expected);
  });

  it('refuses to keep hashing after it has been finalised', () => {
    const hash = create().update(utf8('abc'));
    hash.digest();
    expect(() => hash.update(utf8('more'))).toThrow();
  });

  it('returns the same digest when asked twice', () => {
    const hash = create().update(utf8('abc'));
    expect(hash.digest()).toBe(hash.digest());
  });
});

describe('trailing length field', () => {
  it('counts length in bits beyond what a 32-bit word holds', () => {
    // Above 512 MB the bit count stops fitting in the low word. Getting this
    // wrong yields a hash correct for small files and silently wrong for
    // exactly the large ones this tool is for — and it is shared by all three
    // algorithms, so it is tested once, here, rather than by hashing 512 MB.
    expect(lengthBitWords(0)).toEqual([0, 0]);
    expect(lengthBitWords(1)).toEqual([0, 8]);
    // The last size that fits in the low word, and the first that does not.
    expect(lengthBitWords(0x2000_0000 - 1)).toEqual([0, 0xffff_fff8]);
    expect(lengthBitWords(0x2000_0000)).toEqual([1, 0]);
    // 1 GB, the per-file transfer limit, and 3 GB, the per-session one.
    expect(lengthBitWords(1024 ** 3)).toEqual([2, 0]);
    expect(lengthBitWords(3 * 1024 ** 3)).toEqual([6, 0]);
  });

  it('is written the right way round for each algorithm', () => {
    // MD5 writes the length little-endian and the SHA family big-endian. A
    // 56-byte input is the shortest that forces the length into a second
    // block, so it is the case where getting this wrong shows up.
    const bytes = randomBytes(56);
    expect(md5Hex(bytes)).toBe(reference('md5', bytes));
    expect(sha1Hex(bytes)).toBe(reference('sha1', bytes));
    expect(sha256Hex(bytes)).toBe(reference('sha256', bytes));
  });
});
