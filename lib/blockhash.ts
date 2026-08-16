/**
 * The machinery every 64-byte-block digest here shares: buffering partial
 * chunks, padding, and writing the trailing length.
 *
 * SHA-256 was written first, standalone, for the LAN transfer path. Adding
 * SHA-1 and MD5 for the checksum tool would have meant three copies of the
 * same padding — and padding is precisely where a hash is subtly wrong for
 * unusual input sizes while looking perfect for ordinary ones. So it lives
 * once, here, and the three algorithms supply only what differs: the state,
 * the compression function, and which way round the bytes go.
 */

/**
 * The trailing length field, as two big-endian 32-bit words.
 *
 * Split out because it is the one part that only misbehaves above 512 MB —
 * where the bit count stops fitting in the low word — and proving that end to
 * end would mean hashing half a gigabyte on every deploy. Testing the
 * arithmetic directly costs nothing and covers the same boundary.
 *
 * Not setBigUint64: the byte count is an ordinary number, and converting to
 * BigInt per digest to write eight bytes buys nothing.
 */
export function lengthBitWords(totalBytes: number): [high: number, low: number] {
  const bits = totalBytes * 8;
  // `bits >>> 0` is ToUint32, i.e. modulo 2^32 — exactly the low word.
  return [Math.floor(bits / 0x1_0000_0000), bits >>> 0];
}

export const rotr = (value: number, bits: number): number => (value >>> bits) | (value << (32 - bits));
export const rotl = (value: number, bits: number): number => (value << bits) | (value >>> (32 - bits));

export abstract class BlockHash {
  /** The running state, sized by the algorithm. */
  protected abstract readonly state: Uint32Array;
  /**
   * MD5 reads its message words and writes both its length and its digest
   * little-endian; the SHA family does all three the other way.
   */
  protected abstract readonly littleEndian: boolean;

  private readonly block = new Uint8Array(64);
  protected readonly view = new DataView(this.block.buffer);
  private blockLength = 0;
  private totalBytes = 0;
  private finished = false;

  protected abstract compress(view: DataView, offset: number): void;

  update(chunk: Uint8Array): this {
    if (this.finished) throw new Error('This digest has already been finalised.');
    this.totalBytes += chunk.length;

    let offset = 0;
    // Top up a partial block left by a previous chunk first.
    if (this.blockLength > 0) {
      const take = Math.min(64 - this.blockLength, chunk.length);
      this.block.set(chunk.subarray(0, take), this.blockLength);
      this.blockLength += take;
      offset = take;
      if (this.blockLength < 64) return this;
      this.compress(this.view, 0);
      this.blockLength = 0;
    }

    // Then whole blocks straight out of the chunk, without copying.
    const view = new DataView(chunk.buffer, chunk.byteOffset, chunk.byteLength);
    while (offset + 64 <= chunk.length) {
      this.compress(view, offset);
      offset += 64;
    }

    if (offset < chunk.length) {
      this.block.set(chunk.subarray(offset), 0);
      this.blockLength = chunk.length - offset;
    }
    return this;
  }

  /** Lowercase hex. Calling it twice returns the same answer. */
  digest(): string {
    if (!this.finished) {
      this.finished = true;
      // 0x80, then zeros, then the length in bits as a 64-bit integer.
      this.block.fill(0, this.blockLength);
      this.block[this.blockLength] = 0x80;
      if (this.blockLength >= 56) {
        this.compress(this.view, 0);
        this.block.fill(0);
      }
      const [high, low] = lengthBitWords(this.totalBytes);
      if (this.littleEndian) {
        this.view.setUint32(56, low, true);
        this.view.setUint32(60, high, true);
      } else {
        this.view.setUint32(56, high);
        this.view.setUint32(60, low);
      }
      this.compress(this.view, 0);
    }

    let hex = '';
    for (const word of this.state) {
      hex += this.littleEndian
        ? // MD5's digest is its state written little-endian, so each word's
          // bytes come out reversed relative to the SHA family.
          (word & 0xff).toString(16).padStart(2, '0') +
          ((word >>> 8) & 0xff).toString(16).padStart(2, '0') +
          ((word >>> 16) & 0xff).toString(16).padStart(2, '0') +
          ((word >>> 24) & 0xff).toString(16).padStart(2, '0')
        : word.toString(16).padStart(8, '0');
    }
    return hex;
  }
}
