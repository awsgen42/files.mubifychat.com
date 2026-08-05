import { describe, expect, it } from 'vitest';
import {
  MULTIPART_THRESHOLD_BYTES,
  UPLOAD_PART_BYTES,
  isValidPartManifest,
  partCount,
  partRange,
  usesMultipart,
} from '../shared/upload';

/**
 * R2 validates part sizes at complete() time, and its rule is stricter than
 * S3's: every part but the last must be exactly equal and at least 5 MiB, and
 * the last must be no larger. These tests pin the geometry that satisfies it,
 * because a violation only surfaces at the very end of a long upload.
 */
const MIN_R2_PART = 5 * 1024 * 1024;

describe('part geometry', () => {
  it('uses a part size R2 will accept', () => {
    expect(UPLOAD_PART_BYTES).toBeGreaterThanOrEqual(MIN_R2_PART);
  });

  it('sends small files in one request instead of paying for multipart', () => {
    expect(usesMultipart(0)).toBe(false);
    expect(usesMultipart(1024)).toBe(false);
    expect(usesMultipart(MULTIPART_THRESHOLD_BYTES)).toBe(false);
    expect(usesMultipart(MULTIPART_THRESHOLD_BYTES + 1)).toBe(true);
  });

  it('covers the file exactly, with no gap and no overlap', () => {
    for (const size of [
      UPLOAD_PART_BYTES + 1,
      UPLOAD_PART_BYTES * 2,
      UPLOAD_PART_BYTES * 4 - 1,
      100 * 1024 * 1024,
      500 * 1024 * 1024,
      2 * 1024 * 1024 * 1024,
    ]) {
      const total = partCount(size);
      let covered = 0;
      let previousEnd = 0;
      for (let n = 1; n <= total; n++) {
        const { start, end } = partRange(n, size);
        expect(start).toBe(previousEnd);
        covered += end - start;
        previousEnd = end;
      }
      expect(covered).toBe(size);
      expect(previousEnd).toBe(size);
    }
  });

  it('makes every part but the last exactly equal, and the last no larger', () => {
    for (const size of [UPLOAD_PART_BYTES * 3 + 17, 100 * 1024 * 1024, 137_000_000]) {
      const total = partCount(size);
      const sizes = Array.from({ length: total }, (_, i) => {
        const { start, end } = partRange(i + 1, size);
        return end - start;
      });
      for (const length of sizes.slice(0, -1)) expect(length).toBe(UPLOAD_PART_BYTES);
      expect(sizes[sizes.length - 1]).toBeLessThanOrEqual(UPLOAD_PART_BYTES);
      expect(sizes[sizes.length - 1]).toBeGreaterThan(0);
    }
  });

  it('keeps a 100 MB file to four parts', () => {
    expect(partCount(100 * 1024 * 1024)).toBe(4);
  });
});

describe('part manifest validation', () => {
  const manifest = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ partNumber: i + 1, etag: `"etag-${i + 1}"` }));

  it('accepts a complete manifest in any order', () => {
    expect(isValidPartManifest(manifest(4), 4)).toBe(true);
    expect(isValidPartManifest([...manifest(4)].reverse(), 4)).toBe(true);
  });

  it('rejects a manifest that is short, long, or duplicated', () => {
    expect(isValidPartManifest(manifest(3), 4)).toBe(false);
    expect(isValidPartManifest(manifest(5), 4)).toBe(false);
    const duplicated = [...manifest(3), { partNumber: 3, etag: '"again"' }];
    expect(isValidPartManifest(duplicated, 4)).toBe(false);
  });

  it('rejects part numbers outside the upload', () => {
    expect(isValidPartManifest([{ partNumber: 0, etag: '"a"' }], 1)).toBe(false);
    expect(isValidPartManifest([{ partNumber: 2, etag: '"a"' }], 1)).toBe(false);
    expect(isValidPartManifest([{ partNumber: 1.5, etag: '"a"' }], 2)).toBe(false);
  });

  it('rejects malformed entries rather than passing them to R2', () => {
    expect(isValidPartManifest(null, 1)).toBe(false);
    expect(isValidPartManifest('parts', 1)).toBe(false);
    expect(isValidPartManifest([null], 1)).toBe(false);
    expect(isValidPartManifest([{ partNumber: 1 }], 1)).toBe(false);
    expect(isValidPartManifest([{ partNumber: 1, etag: '' }], 1)).toBe(false);
  });

  it('preserves an etag exactly, quotes included', () => {
    // R2 compares the etag byte for byte. Anything that trims the quotes or
    // changes case fails at complete() with an error that blames the manifest
    // rather than the normalisation that broke it.
    const quoted = [{ partNumber: 1, etag: '"AbC123"' }];
    expect(isValidPartManifest(quoted, 1)).toBe(true);
    expect(quoted[0].etag).toBe('"AbC123"');
  });
});
