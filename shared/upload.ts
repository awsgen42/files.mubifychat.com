/**
 * Multipart upload geometry, shared by the Worker that enforces it and the
 * client that slices the file.
 *
 * R2 validates part sizes at complete() time and the rule is stricter than
 * S3's: every part except the last must be *exactly* the same size and at
 * least 5 MiB, and the last must be no larger than that. A single fixed part
 * size satisfies all of it by construction, which is why the size is a
 * constant here rather than something derived per file.
 */

/**
 * 25 MB. Comfortably under Cloudflare's request-body cap on the proxy path,
 * and far above R2's 5 MiB floor. Each part is one Class A operation, so
 * smaller parts would cost more without buying anything.
 */
export const UPLOAD_PART_BYTES = 25 * 1024 * 1024;

/**
 * Files at or below one part skip multipart entirely and use the single-PUT
 * path. Resume has nothing to recover for a file that fits in one request, and
 * create + complete would double the request count of the common case.
 */
export const MULTIPART_THRESHOLD_BYTES = UPLOAD_PART_BYTES;

export function usesMultipart(size: number): boolean {
  return size > MULTIPART_THRESHOLD_BYTES;
}

export function partCount(size: number, partSize: number = UPLOAD_PART_BYTES): number {
  return Math.max(1, Math.ceil(size / partSize));
}

/** Byte range of a part, 1-indexed as R2 numbers them. */
export function partRange(
  partNumber: number,
  size: number,
  partSize: number = UPLOAD_PART_BYTES,
): { start: number; end: number } {
  const start = (partNumber - 1) * partSize;
  return { start, end: Math.min(start + partSize, size) };
}

/**
 * A part as reported back by R2. The etag is carried verbatim from
 * `R2UploadedPart.etag` all the way to `complete()` — R2 compares it exactly,
 * so trimming quotes or changing case makes complete() fail in a way that
 * points nowhere near the real cause.
 */
export interface UploadedPart {
  partNumber: number;
  etag: string;
}

/** Rejects anything that is not a well-formed, in-range, deduplicated manifest. */
export function isValidPartManifest(value: unknown, expected: number): value is UploadedPart[] {
  if (!Array.isArray(value) || value.length !== expected) return false;
  const seen = new Set<number>();
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) return false;
    const { partNumber, etag } = entry as Partial<UploadedPart>;
    if (!Number.isInteger(partNumber) || partNumber! < 1 || partNumber! > expected) return false;
    if (typeof etag !== 'string' || etag.length === 0) return false;
    if (seen.has(partNumber!)) return false;
    seen.add(partNumber!);
  }
  return true;
}
