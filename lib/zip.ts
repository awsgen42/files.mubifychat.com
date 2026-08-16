'use client';

/**
 * A minimal ZIP writer, for "download all".
 *
 * Stored entries only — no compression. That is not a shortcut: the payload is
 * JPEG, WebP and PNG data, all already compressed, so deflating it would spend
 * time and memory to save approximately nothing. Storing means the archive is
 * concatenation plus bookkeeping, which is why it fits in one small file with
 * no dependency.
 *
 * The alternative was firing one download per image. Browsers treat that as
 * suspicious past the first couple and either prompt or silently drop the
 * rest, which for a tool that just processed twenty photos is the wrong
 * behaviour to design around.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array<ArrayBuffer>): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export interface ZipEntry {
  name: string;
  /**
   * Explicitly backed by an ArrayBuffer rather than the default
   * ArrayBufferLike: a Uint8Array over a SharedArrayBuffer is not a valid
   * BlobPart, and the wider type would not be caught until the Blob was built.
   */
  bytes: Uint8Array<ArrayBuffer>;
}

/**
 * Names inside an archive.
 *
 * Path separators are stripped so an entry can never escape the folder it is
 * extracted into, and duplicates are numbered — two files called photo.jpg
 * from different folders is ordinary, and a ZIP with two identical names
 * extracts to one file.
 */
export function safeEntryName(name: string, taken: Set<string>): string {
  const cleaned = name.replace(/[/\\]/g, '_').replace(/^\.+/, '') || 'file';
  if (!taken.has(cleaned)) {
    taken.add(cleaned);
    return cleaned;
  }
  const dot = cleaned.lastIndexOf('.');
  const stem = dot > 0 ? cleaned.slice(0, dot) : cleaned;
  const ext = dot > 0 ? cleaned.slice(dot) : '';
  for (let n = 2; ; n++) {
    const candidate = `${stem} (${n})${ext}`;
    if (!taken.has(candidate)) {
      taken.add(candidate);
      return candidate;
    }
  }
}

/** Builds a ZIP with no compression. Little-endian throughout, as the format is. */
export function buildZip(entries: readonly ZipEntry[]): Blob {
  const encoder = new TextEncoder();
  const parts: BlobPart[] = [];
  const central: Uint8Array<ArrayBuffer>[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const crc = crc32(entry.bytes);
    const size = entry.bytes.length;

    const localBytes = new Uint8Array(30);
    const local = new DataView(localBytes.buffer);
    local.setUint32(0, 0x04034b50, true); // local file header
    local.setUint16(4, 20, true); // version needed
    local.setUint16(6, 0x0800, true); // UTF-8 names
    local.setUint16(8, 0, true); // stored
    local.setUint16(10, 0, true); // time
    local.setUint16(12, 0x21, true); // date — fixed, so the same input zips identically
    local.setUint32(14, crc, true);
    local.setUint32(18, size, true);
    local.setUint32(22, size, true);
    local.setUint16(26, nameBytes.length, true);
    local.setUint16(28, 0, true); // no extra field

    parts.push(localBytes, nameBytes, entry.bytes);

    const dirHeader = new Uint8Array(46);
    const dir = new DataView(dirHeader.buffer);
    dir.setUint32(0, 0x02014b50, true); // central directory header
    dir.setUint16(4, 20, true);
    dir.setUint16(6, 20, true);
    dir.setUint16(8, 0x0800, true);
    dir.setUint16(10, 0, true);
    dir.setUint16(12, 0, true);
    dir.setUint16(14, 0x21, true);
    dir.setUint32(16, crc, true);
    dir.setUint32(20, size, true);
    dir.setUint32(24, size, true);
    dir.setUint16(28, nameBytes.length, true);
    dir.setUint32(42, offset, true); // where the local header sits
    const dirBytes = new Uint8Array(46 + nameBytes.length);
    dirBytes.set(dirHeader, 0);
    dirBytes.set(nameBytes, 46);
    central.push(dirBytes);

    offset += 30 + nameBytes.length + size;
  }

  const centralSize = central.reduce((total, block) => total + block.length, 0);
  const endBytes = new Uint8Array(22);
  const end = new DataView(endBytes.buffer);
  end.setUint32(0, 0x06054b50, true); // end of central directory
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);

  return new Blob([...parts, ...central, endBytes], { type: 'application/zip' });
}
