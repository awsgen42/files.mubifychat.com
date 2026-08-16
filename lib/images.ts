'use client';

/**
 * Re-encoding images in the browser, and the five things that quietly go wrong
 * when you do.
 *
 * A canvas round-trip is the only way to resize or re-encode without a
 * dependency, and it discards everything that is not pixels. That is fine for
 * the pixels and wrong for almost everything else: orientation, transparency,
 * and — past a size the platform will not tell you about — the pixels too.
 */

/* ------------------------------------------------------------------ */
/* 1. EXIF orientation                                                 */
/* ------------------------------------------------------------------ */

/**
 * The orientation tag from a JPEG's EXIF block, or 1 if there isn't one.
 *
 * Phone cameras almost never rotate the sensor data. They record it as it came
 * off the sensor and set a tag saying which way up it should be shown. Every
 * viewer honours that tag; a canvas does not, and re-encoding drops the tag —
 * so a photo that has looked upright everywhere for years comes out of a naive
 * compressor on its side, and the tag that would have fixed it is gone.
 *
 * Parsed by hand rather than with a library: it is one tag in the first IFD,
 * and every bail-out here returns 1, which is the identity transform.
 */
export function readExifOrientation(buffer: ArrayBuffer): number {
  const view = new DataView(buffer);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return 1; // not a JPEG

  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    const marker = view.getUint16(offset);
    // Markers all start FF; anything else means we have lost our place.
    if ((marker & 0xff00) !== 0xff00) return 1;
    // Start of scan: the compressed data begins, so there is no EXIF to find.
    if (marker === 0xffda) return 1;

    const segmentLength = view.getUint16(offset + 2);

    if (marker === 0xffe1) {
      const app1 = offset + 4;
      // "Exif\0\0"
      if (app1 + 6 > view.byteLength) return 1;
      if (view.getUint32(app1) !== 0x45786966 || view.getUint16(app1 + 4) !== 0) return 1;

      const tiff = app1 + 6;
      if (tiff + 8 > view.byteLength) return 1;
      // The TIFF header declares its own byte order, and it is genuinely both
      // in the wild: "II" on most phones, "MM" on some cameras.
      const little = view.getUint16(tiff) === 0x4949;
      if (view.getUint16(tiff + 2, little) !== 0x002a) return 1;

      const ifd0 = tiff + view.getUint32(tiff + 4, little);
      if (ifd0 + 2 > view.byteLength) return 1;
      const entries = view.getUint16(ifd0, little);

      for (let i = 0; i < entries; i++) {
        const entry = ifd0 + 2 + i * 12;
        if (entry + 12 > view.byteLength) break;
        if (view.getUint16(entry, little) === 0x0112) {
          const value = view.getUint16(entry + 8, little);
          return value >= 1 && value <= 8 ? value : 1;
        }
      }
      return 1;
    }

    offset += 2 + segmentLength;
  }
  return 1;
}

/** Orientations 5–8 are quarter turns, so the displayed image is on its side. */
export function swapsDimensions(orientation: number): boolean {
  return orientation >= 5 && orientation <= 8;
}

export type Matrix = [a: number, b: number, c: number, d: number, e: number, f: number];

/**
 * The canvas transform that puts an image the right way up.
 *
 * `drawWidth`/`drawHeight` are the size the image is drawn at *before* the
 * rotation — for a quarter turn those are the canvas's height and width, the
 * other way round. Returned rather than applied so the mapping can be tested
 * without a canvas.
 */
export function orientationMatrix(orientation: number, drawWidth: number, drawHeight: number): Matrix {
  switch (orientation) {
    case 2:
      return [-1, 0, 0, 1, drawWidth, 0]; // mirrored
    case 3:
      return [-1, 0, 0, -1, drawWidth, drawHeight]; // 180°
    case 4:
      return [1, 0, 0, -1, 0, drawHeight]; // flipped vertically
    case 5:
      return [0, 1, 1, 0, 0, 0]; // transposed
    case 6:
      return [0, 1, -1, 0, drawHeight, 0]; // 90° clockwise
    case 7:
      return [0, -1, -1, 0, drawHeight, drawWidth]; // transverse
    case 8:
      return [0, -1, 1, 0, 0, drawWidth]; // 90° anticlockwise
    default:
      return [1, 0, 0, 1, 0, 0];
  }
}

/** Where a point lands under a matrix — the testable form of the above. */
export function applyMatrix([a, b, c, d, e, f]: Matrix, x: number, y: number): [number, number] {
  return [a * x + c * y + e, b * x + d * y + f];
}

/* ------------------------------------------------------------------ */
/* 1b. Who applies the orientation — us, or the decoder?               */
/* ------------------------------------------------------------------ */

/**
 * A 2x1 red JPEG tagged with orientation 6, so a decoder that honours EXIF
 * hands back a 1x2 bitmap and one that does not hands back 2x1.
 *
 * This exists because the obvious approach does not work. The plan was to ask
 * for `imageOrientation: 'none'`, get raw pixels, and apply the rotation
 * ourselves — but Chromium applies the EXIF orientation regardless of that
 * option, so the transform ran a second time and a portrait photo came out
 * landscape and mirrored. Measured, not assumed: the tool's own end-to-end
 * test caught it.
 *
 * Rather than hardcode which engines do what — a list that goes stale and
 * cannot be checked from here — the question is asked at runtime, once.
 */
const ORIENTATION_PROBE =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4QAiRXhpZgAATU0AKgAAAAgAAQESAAMAAAABAAYAAAAAAAD/2wBDAFA3PEY8MlBGQUZaVVBfeMiCeG5uePWvuZHI////////////////////////////////////////////////////2wBDAVVaWnhpeOuCguv/////////////////////////////////////////////////////////////////////////wAARCAABAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwCKiiiszsP/2Q==';

let decoderAppliesOrientation: Promise<boolean> | null = null;

/**
 * Whether the platform's decoder has already rotated the pixels by the time we
 * see them. Cached: the answer cannot change within a page.
 */
export function decoderHandlesExif(): Promise<boolean> {
  decoderAppliesOrientation ??= (async () => {
    try {
      const blob = await (await fetch(ORIENTATION_PROBE)).blob();
      const bitmap = await createImageBitmap(blob, { imageOrientation: 'none' });
      // 2x1 stored, orientation 6 -> 1x2 if the decoder honoured the tag.
      const applied = bitmap.height > bitmap.width;
      bitmap.close();
      return applied;
    } catch {
      // If the probe cannot run, assume the decoder did nothing and rotate
      // ourselves: an image that is wrongly rotated is better than one that is
      // wrongly rotated *and* mirrored, which is what double-applying gives.
      return false;
    }
  })();
  return decoderAppliesOrientation;
}

/* ------------------------------------------------------------------ */
/* 3. Canvas size limits                                               */
/* ------------------------------------------------------------------ */

/**
 * The largest canvas we will ask for, in pixels of area.
 *
 * Safari on iOS caps canvas area and, past the cap, hands back a canvas that
 * is *blank* rather than throwing. A tool that trusts it produces a plausible
 * file of the right size containing nothing — the worst possible failure,
 * because it looks like success. 16,777,216 is the documented iOS ceiling;
 * staying under it is cheaper than detecting the platform.
 */
export const MAX_CANVAS_PIXELS = 16_777_216;

/** Scales a size down until it fits the area cap, keeping the aspect ratio. */
export function fitToCanvasLimit(width: number, height: number): { width: number; height: number } {
  const area = width * height;
  if (area <= MAX_CANVAS_PIXELS) return { width, height };
  const scale = Math.sqrt(MAX_CANVAS_PIXELS / area);
  return { width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)) };
}

/**
 * The output size for a given longest-edge limit, after orientation and after
 * the canvas cap. Never enlarges: asking for 4000px from a 900px image should
 * give back 900px, not an upscaled blur.
 */
export function targetSize(
  displayWidth: number,
  displayHeight: number,
  maxDimension: number | null,
): { width: number; height: number } {
  let width = displayWidth;
  let height = displayHeight;
  const longest = Math.max(width, height);
  if (maxDimension !== null && longest > maxDimension) {
    const scale = maxDimension / longest;
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));
  }
  return fitToCanvasLimit(width, height);
}

/* ------------------------------------------------------------------ */
/* 2. Alpha, and 3 again: proving the canvas actually drew something   */
/* ------------------------------------------------------------------ */

/** Whether any pixel is not fully opaque. */
export function hasTransparency(pixels: Uint8ClampedArray): boolean {
  for (let i = 3; i < pixels.length; i += 4) {
    if (pixels[i] !== 255) return true;
  }
  return false;
}

/**
 * Whether the canvas came back empty.
 *
 * A canvas that exceeded the platform's limit reads back as every pixel
 * rgba(0,0,0,0) — transparent black, which is also what an untouched canvas
 * looks like. Checking the output *file size* does not catch this: a blank
 * 4000x3000 PNG is a perfectly valid file of a few kilobytes, and a size-based
 * check calls it a spectacular compression win.
 *
 * A genuinely fully-transparent source would be reported as blank too. That is
 * the right trade: there is nothing to compress in one, and being told so is
 * better than being handed an empty file.
 */
export function isBlank(pixels: Uint8ClampedArray): boolean {
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i] !== 0 || pixels[i + 1] !== 0 || pixels[i + 2] !== 0 || pixels[i + 3] !== 0) {
      return false;
    }
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* 5. When "compressed" is bigger                                      */
/* ------------------------------------------------------------------ */

export type Outcome = 'smaller' | 'larger' | 'blank' | 'failed';

/**
 * Re-encoding does not always help. An already-optimised PNG, or a JPEG that
 * was saved at low quality and is being re-encoded at a higher one, comes out
 * bigger — and handing someone a larger file while calling it compression is
 * simply wrong. The original is kept and offered instead.
 */
export function chooseOutcome(originalBytes: number, encodedBytes: number): Outcome {
  return encodedBytes < originalBytes ? 'smaller' : 'larger';
}

export function percentSaved(originalBytes: number, encodedBytes: number): number {
  if (originalBytes <= 0) return 0;
  return Math.round((1 - encodedBytes / originalBytes) * 100);
}

/* ------------------------------------------------------------------ */
/* The pipeline                                                        */
/* ------------------------------------------------------------------ */

export type OutputFormat = 'keep' | 'image/jpeg' | 'image/webp';

export interface CompressOptions {
  quality: number;
  maxDimension: number | null;
  format: OutputFormat;
}

export interface CompressResult {
  name: string;
  originalBytes: number;
  encodedBytes: number;
  outcome: Outcome;
  /** What the user should actually download — the original when it was smaller. */
  blob: Blob;
  type: string;
  width: number;
  height: number;
  /** Set when the source had transparency and the output format cannot keep it. */
  flattened: boolean;
  /** Set when the canvas cap forced a smaller output than was asked for. */
  cappedByCanvasLimit: boolean;
  orientation: number;
  error?: string;
}

function outputType(format: OutputFormat, sourceType: string): string {
  if (format !== 'keep') return format;
  // PNG re-encoded as PNG is usually pointless but is what "keep" means; GIF
  // and anything exotic become PNG, which canvas can actually write.
  return sourceType === 'image/jpeg' || sourceType === 'image/webp' || sourceType === 'image/png'
    ? sourceType
    : 'image/png';
}

/**
 * Decodes, orients, resizes and re-encodes one image.
 *
 * Deliberately one image at a time, and everything released before it
 * returns: decoded bitmaps are the memory cost here, not the files, and a
 * dozen 12-megapixel photos decoded at once is around 600 MB of RGBA.
 */
export async function compressImage(file: File, options: CompressOptions): Promise<CompressResult> {
  const base: Omit<CompressResult, 'blob' | 'outcome'> = {
    name: file.name,
    originalBytes: file.size,
    encodedBytes: file.size,
    type: file.type,
    width: 0,
    height: 0,
    flattened: false,
    cappedByCanvasLimit: false,
    orientation: 1,
  };

  const buffer = await file.arrayBuffer();
  const tagged = readExifOrientation(buffer);
  // If the decoder already rotated the pixels, applying the tag again would
  // rotate them twice — which is exactly the bug this probe exists to avoid.
  const orientation = (await decoderHandlesExif()) ? 1 : tagged;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(new Blob([buffer], { type: file.type }), { imageOrientation: 'none' });
  } catch {
    return { ...base, orientation: tagged, outcome: 'failed', blob: file, error: 'That file could not be read as an image.' };
  }

  try {
    const swap = swapsDimensions(orientation);
    const displayWidth = swap ? bitmap.height : bitmap.width;
    const displayHeight = swap ? bitmap.width : bitmap.height;
    const target = targetSize(displayWidth, displayHeight, options.maxDimension);
    const cappedByCanvasLimit =
      target.width * target.height >= MAX_CANVAS_PIXELS &&
      displayWidth * displayHeight > MAX_CANVAS_PIXELS;

    const canvas = document.createElement('canvas');
    canvas.width = target.width;
    canvas.height = target.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      return { ...base, orientation: tagged, outcome: 'failed', blob: file, error: 'Canvas is unavailable.' };
    }

    const drawWidth = swap ? target.height : target.width;
    const drawHeight = swap ? target.width : target.height;
    ctx.setTransform(...orientationMatrix(orientation, drawWidth, drawHeight));
    ctx.drawImage(bitmap, 0, 0, drawWidth, drawHeight);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

    // Checked before anything is encoded: past this point a blank canvas is
    // indistinguishable from a legitimately dark image in the output file.
    if (isBlank(pixels)) {
      return {
        ...base,
        orientation: tagged,
        width: target.width,
        height: target.height,
        outcome: 'blank',
        blob: file,
        error: 'This image is too large for your browser to process. The original is offered instead.',
      };
    }

    const type = outputType(options.format, file.type);
    const transparent = hasTransparency(pixels);
    const flattened = transparent && type === 'image/jpeg';

    if (flattened) {
      // JPEG has no alpha. Left alone, the browser composites onto black,
      // which turns every transparent PNG logo into a black rectangle. White
      // is the deliberate choice, and the UI says it happened.
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'source-over';
    }

    const encoded = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, type, options.quality),
    );
    // Free the backing store before the next image is decoded.
    canvas.width = 0;
    canvas.height = 0;

    if (!encoded) {
      return { ...base, orientation: tagged, outcome: 'failed', blob: file, error: 'That format could not be written.' };
    }

    const outcome = chooseOutcome(file.size, encoded.size);
    // Falling back to the original only makes sense when the user asked to
    // compress, not to convert. Handing back a PNG to someone who explicitly
    // chose JPEG is not a saving, it is ignoring the instruction — so an
    // explicit format is always honoured and the size is simply reported.
    const keepOriginal = outcome === 'larger' && options.format === 'keep';
    return {
      ...base,
      orientation: tagged,
      width: target.width,
      height: target.height,
      encodedBytes: encoded.size,
      flattened,
      cappedByCanvasLimit,
      outcome,
      // The point of the outcome: never hand back something bigger.
      blob: keepOriginal ? file : encoded,
      type: keepOriginal ? file.type : type,
    };
  } finally {
    bitmap.close();
  }
}
