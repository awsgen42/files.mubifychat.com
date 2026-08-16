/**
 * Incremental SHA-1.
 *
 * Here because a great many projects still publish SHA-1 checksums alongside
 * their downloads, so a tool that cannot check one is a tool that sends people
 * elsewhere. That is the only reason: SHA-1 is broken for anything adversarial
 * — collisions have been demonstrated — and the page says so where a reader
 * choosing an algorithm will see it.
 *
 * Streaming, on the shared block engine, so a 1 GB file costs 64 bytes of
 * buffer. Checked against Node's createHash and crypto.subtle in
 * test/hashes.test.ts.
 */

import { BlockHash, rotl } from './blockhash';

export class Sha1 extends BlockHash {
  protected readonly littleEndian = false;
  protected readonly state = new Uint32Array([
    0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0,
  ]);
  private readonly schedule = new Uint32Array(80);

  protected compress(view: DataView, offset: number): void {
    const w = this.schedule;
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 80; i++) {
      w[i] = rotl(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
    }

    let [a, b, c, d, e] = this.state;
    for (let i = 0; i < 80; i++) {
      let f: number;
      let k: number;
      if (i < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (i < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }
      const temp = (rotl(a, 5) + f + e + k + w[i]) | 0;
      e = d;
      d = c;
      c = rotl(b, 30);
      b = a;
      a = temp;
    }

    const s = this.state;
    s[0] = (s[0] + a) | 0;
    s[1] = (s[1] + b) | 0;
    s[2] = (s[2] + c) | 0;
    s[3] = (s[3] + d) | 0;
    s[4] = (s[4] + e) | 0;
  }
}

export function sha1Hex(input: Uint8Array): string {
  return new Sha1().update(input).digest();
}
