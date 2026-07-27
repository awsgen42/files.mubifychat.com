/** Filename and content-type handling for uploads and downloads. */

const UNSAFE_FILENAME_CHARS = /[\u0000-\u001f\u007f"\\/:*?<>|]/g;

/**
 * Produces a filename that is safe to echo back in a Content-Disposition
 * header and to write to disk. Path separators and control characters are the
 * dangerous part; everything else is preserved so names stay recognisable.
 */
export function sanitizeFilename(input: unknown): string {
  const raw = typeof input === 'string' ? input : '';
  const flattened = raw.replace(/[\r\n]/g, ' ').replace(UNSAFE_FILENAME_CHARS, '_').trim();
  const withoutDots = flattened.replace(/^\.+/, '');
  const trimmed = withoutDots.slice(0, 200).trim();
  return trimmed.length > 0 ? trimmed : 'file';
}

/**
 * Uploaded content is never trusted to be inert, so everything is stored and
 * served as an opaque byte stream and forced to download rather than render.
 * This is what stops an uploaded .html or .svg from executing on our origin.
 */
export const DOWNLOAD_CONTENT_TYPE = 'application/octet-stream';

/** Only used for display in the UI; never used as a response Content-Type. */
export function normalizeContentType(input: unknown): string {
  if (typeof input !== 'string') return DOWNLOAD_CONTENT_TYPE;
  const value = input.split(';')[0].trim().toLowerCase();
  return /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(value) ? value : DOWNLOAD_CONTENT_TYPE;
}

/** RFC 5987 encoded attachment disposition, with an ASCII fallback. */
export function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}
