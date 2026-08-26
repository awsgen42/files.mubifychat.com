import { describe, expect, it } from 'vitest';
import {
  MEDIA_BYTES_CUTOFF,
  archiveSizeMediaMode,
  defaultMediaMode,
} from '../lib/instagram/media-mode';

const MB = 1024 * 1024;

/**
 * The synthetic fixtures in perf/, as the central directory reports them.
 *
 * `archiveBytes` is the file on disk. `mediaBytes`/`mediaCount` are message
 * attachments only — photos, videos, audio and gifs inside a conversation
 * directory. The gap between the two columns is the whole argument: an export
 * also carries posts, stories and profile media, and none of it renders in a
 * thread.
 *
 * Every one of these is synthetic. Numbers measured from a real export may
 * move the cutoff; the shape of the rule is what is being tested.
 */
const FIXTURES = {
  small: { archiveBytes: 58_437_132, mediaBytes: 57 * MB, mediaCount: 320 },
  '500mb': { archiveBytes: 538_457_772, mediaBytes: 57 * MB, mediaCount: 320 },
  '1gb': { archiveBytes: 1_074_480_820, mediaBytes: 57 * MB, mediaCount: 320 },
  '2gb': { archiveBytes: 2_150_527_164, mediaBytes: 57 * MB, mediaCount: 320 },
  'media-700mb': { archiveBytes: 757_127_766, mediaBytes: 721 * MB, mediaCount: 4200 },
} as const;

describe('the media default', () => {
  it('opens with media on when the attachments are small, however big the archive is', () => {
    for (const name of ['small', '500mb', '1gb', '2gb'] as const) {
      expect(defaultMediaMode(FIXTURES[name]).mode, name).toBe('media');
    }
  });

  it('opens text-only on the media-heavy archive', () => {
    const decision = defaultMediaMode(FIXTURES['media-700mb']);
    expect(decision.mode).toBe('text');
    expect(decision.reason).toContain('721 MB');
  });

  it('says why, every time', () => {
    for (const fixture of Object.values(FIXTURES)) {
      expect(defaultMediaMode(fixture).reason.length).toBeGreaterThan(20);
    }
  });

  it('does not divide by zero on an export with no attachments', () => {
    const decision = defaultMediaMode({ mediaBytes: 0, mediaCount: 0 });
    expect(decision.mode).toBe('text');
    expect(decision.reason).toContain('no photos');
  });

  it('catches a small number of very large videos', () => {
    // Under the byte cutoff and far under the count cutoff, but each item has
    // to be materialised whole before it can play.
    const decision = defaultMediaMode({ mediaBytes: 240 * MB, mediaCount: 6 });
    expect(decision.mode).toBe('text');
    expect(decision.reason).toContain('average');
  });

  it('catches very many small attachments under the byte cutoff', () => {
    const decision = defaultMediaMode({ mediaBytes: 200 * MB, mediaCount: 20_000 });
    expect(decision.mode).toBe('text');
    expect(decision.reason).toContain('20,000');
  });

  it('has a cutoff below the media-heavy fixture and above the ordinary ones', () => {
    expect(MEDIA_BYTES_CUTOFF).toBeLessThan(FIXTURES['media-700mb'].mediaBytes);
    expect(MEDIA_BYTES_CUTOFF).toBeGreaterThan(FIXTURES['2gb'].mediaBytes);
  });
});

/**
 * The control, in both directions.
 *
 * The briefed default keyed off the archive's size on disk. These two
 * assertions state what that rule would have to get right for it to have been
 * the correct input, and both fail — so the rule was measuring the wrong thing,
 * not merely calibrated differently. If either of these ever passes, the change
 * of input was unnecessary and should be reverted.
 */
describe('control: the archive-size default', () => {
  it.fails('turns media off for the media-heavy 722 MB archive', () => {
    // 721 MB of attachments across 4,200 items, and the archive-size rule opens
    // with all of it renderable because the file is under a gigabyte.
    expect(archiveSizeMediaMode(FIXTURES['media-700mb'].archiveBytes)).toBe('text');
  });

  it.fails('leaves media on for the 1 GB archive that holds 57 MB of attachments', () => {
    // The other direction: text-only imposed on an archive whose conversations
    // could show every attachment without trouble.
    expect(archiveSizeMediaMode(FIXTURES['1gb'].archiveBytes)).toBe('media');
  });
});
