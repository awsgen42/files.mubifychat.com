import { describe, expect, it } from 'vitest';
import {
  MAX_FRAMES,
  clampRange,
  formatName,
  frameCount,
  frameTimes,
  isBlack,
  isCapped,
  isKnownUnsupported,
  outputSize,
  signature,
  undecodableMessage,
} from '../lib/frames';

const file = (name: string): File => new File([new Uint8Array(4)], name, { type: '' });

describe('what a request produces', () => {
  it('is stated in frames per second, not seconds per frame', () => {
    expect(frameCount({ start: 0, end: 10 }, 1)).toBe(10);
    expect(frameCount({ start: 0, end: 10 }, 2)).toBe(20);
    expect(frameCount({ start: 0, end: 40 }, 12)).toBe(480);
  });

  it('spaces the timestamps evenly and stays inside the range', () => {
    expect(frameTimes({ start: 0, end: 1 }, 4)).toEqual([0, 0.25, 0.5, 0.75]);
    // Never a frame at `end`: on a clip whose duration is the end there is
    // nothing there to seek to.
    expect(frameTimes({ start: 2, end: 3 }, 2)).toEqual([2, 2.5]);
  });

  it('honours a trim range rather than always starting at zero', () => {
    expect(frameTimes({ start: 5, end: 6 }, 2)).toEqual([5, 5.5]);
  });

  it('caps a request rather than refusing it, and says it capped', () => {
    // 30 FPS across ten minutes is 18,000 frames; the answer is the first 600,
    // not an error and not a dead tab.
    expect(frameCount({ start: 0, end: 600 }, 30)).toBe(MAX_FRAMES);
    expect(isCapped({ start: 0, end: 600 }, 30)).toBe(true);
    expect(isCapped({ start: 0, end: 10 }, 2)).toBe(false);
  });

  it('never produces an empty set for a real range', () => {
    expect(frameTimes({ start: 0, end: 0.1 }, 1).length).toBeGreaterThan(0);
  });

  it('keeps a range inside the clip', () => {
    expect(clampRange({ start: -5, end: 999 }, 10)).toEqual({ start: 0, end: 10 });
    expect(clampRange({ start: 8, end: 2 }, 10).end).toBeGreaterThan(clampRange({ start: 8, end: 2 }, 10).start);
  });
});

describe('output size', () => {
  it('scales to a requested width and keeps the shape', () => {
    expect(outputSize(1920, 1080, 640)).toEqual({ width: 640, height: 360 });
  });

  it('never enlarges', () => {
    expect(outputSize(320, 240, 1920)).toEqual({ width: 320, height: 240 });
  });

  it('leaves it alone when no width was asked for', () => {
    expect(outputSize(3840, 2160, null)).toEqual({ width: 3840, height: 2160 });
  });
});

describe('reading the pixels rather than trusting the platform', () => {
  const black = new Uint8ClampedArray(64 * 4);
  const nearlyBlack = new Uint8ClampedArray(64 * 4);
  nearlyBlack[0] = 40;

  it('spots the all-black canvas drawImage leaves behind', () => {
    expect(isBlack(black)).toBe(true);
    expect(isBlack(nearlyBlack)).toBe(false);
  });

  it('tells two different pictures apart', () => {
    const a = new Uint8ClampedArray(256 * 4).fill(30);
    const b = new Uint8ClampedArray(256 * 4).fill(200);
    expect(signature(a)).not.toBe(signature(b));
    expect(signature(a)).toBe(signature(a.slice()));
  });
});

describe('formats, as a stated boundary', () => {
  it('names what it was given', () => {
    expect(formatName(file('holiday.AVI'))).toBe('AVI');
    expect(formatName(file('clip.mov'))).toBe('QuickTime (MOV)');
    expect(formatName(file('x.wmv'))).toBe('WMV');
  });

  it('rejects the containers no browser opens, before any waiting', () => {
    for (const name of ['a.avi', 'a.wmv', 'a.flv', 'a.mpg', 'a.vob', 'a.ts']) {
      expect(isKnownUnsupported(file(name)), name).toBe(true);
    }
    for (const name of ['a.mp4', 'a.webm', 'a.mov']) {
      expect(isKnownUnsupported(file(name)), name).toBe(false);
    }
  });

  it('explains the limit rather than blaming the file', () => {
    const message = undecodableMessage('AVI');
    expect(message).toContain('AVI');
    // Says why it cannot, says what does work, says what to do.
    expect(message).toMatch(/cannot decode/i);
    expect(message).toContain('WebM');
    expect(message).toMatch(/converting to mp4/i);
    // And does not pretend it is the user's mistake.
    expect(message).not.toMatch(/invalid|corrupt|unsupported file/i);
  });
});

/**
 * The control.
 *
 * A size check is the obvious way to decide a frame came out, and it is what
 * a black frame defeats: an all-black 1280x720 JPEG is a valid file of a few
 * kilobytes. This asserts that reasoning is sufficient and is expected to
 * fail, so the suite stays green only while the pixels are what decide.
 */
describe('control: a size check cannot tell a black frame from a real one', () => {
  it.fails('accepts a frame on the strength of its byte count', () => {
    const blackFrame = new Uint8ClampedArray(1280 * 720 * 4); // all zero
    const plausibleByteCount = 4_000;
    expect(plausibleByteCount).toBeGreaterThan(0);
    // ...and the pixels say otherwise, which is the whole point.
    expect(isBlack(blackFrame)).toBe(false);
  });
});
