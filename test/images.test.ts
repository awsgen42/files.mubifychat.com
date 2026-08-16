import { describe, expect, it } from 'vitest';
import {
  MAX_CANVAS_PIXELS,
  applyMatrix,
  chooseOutcome,
  fitToCanvasLimit,
  hasTransparency,
  isBlank,
  orientationMatrix,
  percentSaved,
  readExifOrientation,
  swapsDimensions,
  targetSize,
} from '../lib/images';

/**
 * Builds a JPEG that contains nothing but an EXIF orientation tag.
 *
 * Synthetic rather than a fixture file so both byte orders can be tested —
 * "II" is what phones write and "MM" is what several cameras write, and a
 * parser that assumes one is wrong for the other in a way no single sample
 * image would reveal.
 */
function jpegWithOrientation(value: number, little = true): ArrayBuffer {
  const tiff = new Uint8Array(2 + 2 + 4 + 2 + 12 + 4);
  const view = new DataView(tiff.buffer);
  view.setUint16(0, little ? 0x4949 : 0x4d4d);
  view.setUint16(2, 0x002a, little);
  view.setUint32(4, 8, little); // IFD0 starts right after the header
  view.setUint16(8, 1, little); // one entry
  view.setUint16(10, 0x0112, little); // Orientation
  view.setUint16(12, 3, little); // SHORT
  view.setUint32(14, 1, little); // count
  view.setUint16(18, value, little); // the value, in the first half of the field
  view.setUint32(22, 0, little); // no next IFD

  const exifHeader = new TextEncoder().encode('Exif\0\0');
  const segment = new Uint8Array(2 + exifHeader.length + tiff.length);
  new DataView(segment.buffer).setUint16(0, segment.length);
  segment.set(exifHeader, 2);
  segment.set(tiff, 2 + exifHeader.length);

  const out = new Uint8Array(4 + segment.length);
  new DataView(out.buffer).setUint16(0, 0xffd8); // SOI
  new DataView(out.buffer).setUint16(2, 0xffe1); // APP1
  out.set(segment, 4);
  return out.buffer;
}

describe('EXIF orientation', () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8])('reads orientation %i, little-endian', (value) => {
    expect(readExifOrientation(jpegWithOrientation(value))).toBe(value);
  });

  it.each([1, 3, 6, 8])('reads orientation %i, big-endian', (value) => {
    expect(readExifOrientation(jpegWithOrientation(value, false))).toBe(value);
  });

  it('returns 1 for anything it cannot read, rather than guessing', () => {
    expect(readExifOrientation(new Uint8Array([1, 2, 3, 4]).buffer)).toBe(1); // not a JPEG
    expect(readExifOrientation(new Uint8Array(0).buffer)).toBe(1); // empty
    expect(readExifOrientation(new Uint8Array([0xff, 0xd8]).buffer)).toBe(1); // JPEG, no EXIF
    expect(readExifOrientation(jpegWithOrientation(99))).toBe(1); // out of range
  });

  it('knows which orientations turn the image on its side', () => {
    expect([1, 2, 3, 4].map(swapsDimensions)).toEqual([false, false, false, false]);
    expect([5, 6, 7, 8].map(swapsDimensions)).toEqual([true, true, true, true]);
  });
});

describe('orientation transforms', () => {
  // Where the four corners of the drawn image end up on the canvas. Checking
  // the matrix by its effect rather than its numbers: the numbers are easy to
  // transcribe wrongly and impossible to read.
  const corners = (orientation: number, w: number, h: number) => {
    const m = orientationMatrix(orientation, w, h);
    return {
      topLeft: applyMatrix(m, 0, 0),
      topRight: applyMatrix(m, w, 0),
      bottomLeft: applyMatrix(m, 0, h),
    };
  };

  it('leaves an upright image alone', () => {
    expect(corners(1, 100, 50).topLeft).toEqual([0, 0]);
    expect(corners(1, 100, 50).topRight).toEqual([100, 0]);
  });

  it('rotates 90 clockwise for orientation 6', () => {
    // The stored top-left must land at the top-right of the canvas, which is
    // exactly what a phone photo taken in portrait needs.
    const c = corners(6, 100, 50);
    expect(c.topLeft).toEqual([50, 0]);
    expect(c.topRight).toEqual([50, 100]);
    expect(c.bottomLeft).toEqual([0, 0]);
  });

  it('rotates 90 anticlockwise for orientation 8', () => {
    const c = corners(8, 100, 50);
    expect(c.topLeft).toEqual([0, 100]);
    expect(c.bottomLeft).toEqual([50, 100]);
  });

  it('turns the image over for orientation 3', () => {
    const c = corners(3, 100, 50);
    expect(c.topLeft).toEqual([100, 50]);
    expect(c.topRight).toEqual([0, 50]);
  });

  it('mirrors without rotating for orientation 2', () => {
    const c = corners(2, 100, 50);
    expect(c.topLeft).toEqual([100, 0]);
    expect(c.topRight).toEqual([0, 0]);
  });
});

describe('canvas size limits', () => {
  it('leaves anything within the cap alone', () => {
    expect(fitToCanvasLimit(4000, 3000)).toEqual({ width: 4000, height: 3000 });
  });

  it('scales past the cap down to fit, keeping the aspect ratio', () => {
    const fitted = fitToCanvasLimit(8000, 6000);
    expect(fitted.width * fitted.height).toBeLessThanOrEqual(MAX_CANVAS_PIXELS);
    expect(fitted.width / fitted.height).toBeCloseTo(8000 / 6000, 2);
  });

  it('never enlarges a small image to meet a large maximum edge', () => {
    expect(targetSize(900, 600, 4000)).toEqual({ width: 900, height: 600 });
  });

  it('caps the longest edge whichever way round the image is', () => {
    expect(targetSize(4000, 3000, 1000)).toEqual({ width: 1000, height: 750 });
    expect(targetSize(3000, 4000, 1000)).toEqual({ width: 750, height: 1000 });
  });

  it('applies the canvas cap even when no maximum edge was asked for', () => {
    const t = targetSize(6000, 4000, null);
    expect(t.width * t.height).toBeLessThanOrEqual(MAX_CANVAS_PIXELS);
  });
});

describe('pixel inspection', () => {
  const pixels = (...values: number[]) => new Uint8ClampedArray(values);

  it('spots a single non-opaque pixel', () => {
    expect(hasTransparency(pixels(1, 2, 3, 255, 4, 5, 6, 255))).toBe(false);
    expect(hasTransparency(pixels(1, 2, 3, 255, 4, 5, 6, 254))).toBe(true);
  });

  it('calls an all-zero buffer blank and anything else not', () => {
    expect(isBlank(pixels(0, 0, 0, 0, 0, 0, 0, 0))).toBe(true);
    // A black opaque pixel is a real image, not a failed canvas.
    expect(isBlank(pixels(0, 0, 0, 255))).toBe(false);
    expect(isBlank(pixels(0, 0, 0, 0, 1, 0, 0, 0))).toBe(false);
  });
});

describe('was it actually worth it', () => {
  it('keeps the original when re-encoding made it bigger', () => {
    expect(chooseOutcome(1000, 900)).toBe('smaller');
    expect(chooseOutcome(1000, 1100)).toBe('larger');
    // Equal is not a win either — there is nothing to gain by swapping.
    expect(chooseOutcome(1000, 1000)).toBe('larger');
  });

  it('reports the saving as a percentage', () => {
    expect(percentSaved(1000, 250)).toBe(75);
    expect(percentSaved(1000, 1000)).toBe(0);
    expect(percentSaved(0, 0)).toBe(0);
  });
});

/**
 * The control.
 *
 * A size-only check is the obvious way to decide whether compression worked,
 * and it is exactly what a blank canvas defeats: an empty 4000x3000 image
 * encodes to a few kilobytes, which a size check reads as a spectacular win.
 * This asserts that reasoning and is expected to fail, so the suite stays
 * green only while `isBlank` is what makes the decision.
 */
describe('control: a size check cannot tell a blank image from a good one', () => {
  const blankOutput = new Uint8ClampedArray(4000 * 10 * 4); // all zero

  it.fails('treats a tiny output from a large input as a successful compression', () => {
    const outcomeBySizeAlone = chooseOutcome(2_000_000, 3_000);
    expect(outcomeBySizeAlone).toBe('smaller');
    // ...and the pixels say otherwise, which is the whole point.
    expect(isBlank(blankOutput)).toBe(false);
  });
});
