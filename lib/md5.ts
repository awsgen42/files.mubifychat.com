/**
 * Incremental MD5.
 *
 * Same reason as SHA-1: a large amount of published software still ships an
 * MD5 line next to the download, and checking one against the file you got is
 * a legitimate thing to want. MD5 is thoroughly broken against a deliberate
 * attacker — collisions are trivial to produce — so the page is explicit that
 * it detects a corrupted download and not a tampered one.
 *
 * Everything about MD5 runs the opposite way round from the SHA family: the
 * message words are read little-endian, the trailing length is written
 * little-endian, and the digest is the state written little-endian. The shared
 * block engine handles the last two from the `littleEndian` flag; the first is
 * here, in the getUint32 calls.
 *
 * WebCrypto has no MD5, so the reference in test/hashes.test.ts is Node's
 * createHash. That is an independent implementation, which is the property
 * that matters.
 */

import { BlockHash, rotl } from './blockhash';

/** floor(abs(sin(i + 1)) * 2^32), the constants from RFC 1321. */
// prettier-ignore
const K = new Uint32Array([
  0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
  0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
  0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
  0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
  0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c, 0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
  0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
  0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
  0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391,
]);

// prettier-ignore
const SHIFTS = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];

export class Md5 extends BlockHash {
  protected readonly littleEndian = true;
  protected readonly state = new Uint32Array([0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476]);
  private readonly words = new Uint32Array(16);

  protected compress(view: DataView, offset: number): void {
    const m = this.words;
    for (let i = 0; i < 16; i++) m[i] = view.getUint32(offset + i * 4, true);

    let [a, b, c, d] = this.state;
    for (let i = 0; i < 64; i++) {
      let f: number;
      let g: number;
      if (i < 16) {
        f = (b & c) | (~b & d);
        g = i;
      } else if (i < 32) {
        f = (d & b) | (~d & c);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        f = b ^ c ^ d;
        g = (3 * i + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        g = (7 * i) % 16;
      }
      const rotated = (f + a + K[i] + m[g]) | 0;
      a = d;
      d = c;
      c = b;
      b = (b + rotl(rotated, SHIFTS[i])) | 0;
    }

    const s = this.state;
    s[0] = (s[0] + a) | 0;
    s[1] = (s[1] + b) | 0;
    s[2] = (s[2] + c) | 0;
    s[3] = (s[3] + d) | 0;
  }
}

export function md5Hex(input: Uint8Array): string {
  return new Md5().update(input).digest();
}
