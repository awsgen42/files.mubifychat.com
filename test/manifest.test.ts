import { describe, expect, it } from 'vitest';
import {
  buildManifest,
  checkManifest,
  isManifestName,
  joinCommands,
  manifestName,
  mismatchMessage,
  parseManifest,
  type Manifest,
} from '../lib/manifest';

const SAMPLE: Manifest = {
  original: 'holiday.mp4',
  bytes: 314_572_800,
  sha256: 'c4255503e1da1cf183273999ea8e9e393f71587fe9e75425b8bfaa4d11c6cb7e',
  parts: [
    { name: 'holiday.mp4.001', bytes: 104_857_600 },
    { name: 'holiday.mp4.002', bytes: 104_857_600 },
    { name: 'holiday.mp4.003', bytes: 104_857_600 },
  ],
};

const present = (m: Manifest) => m.parts.map((p) => ({ ...p }));

describe('the sidecar itself', () => {
  it('is named so it sorts next to the parts and cannot be read as one', () => {
    expect(manifestName('holiday.mp4')).toBe('holiday.mp4.join.txt');
    // Lexically after every part, because '0' < 'j'.
    const sorted = [...SAMPLE.parts.map((p) => p.name), manifestName('holiday.mp4')].sort();
    expect(sorted[sorted.length - 1]).toBe('holiday.mp4.join.txt');
    expect(isManifestName('holiday.mp4.join.txt')).toBe(true);
    expect(isManifestName('holiday.mp4.001')).toBe(false);
  });

  it('says the important things before the JSON', () => {
    const text = buildManifest(SAMPLE);
    const human = text.slice(0, text.indexOf('machine-readable'));
    expect(human).toContain('holiday.mp4');
    expect(human).toContain('314,572,800 bytes');
    expect(human).toContain(SAMPLE.sha256);
    expect(human).toContain('https://www.mubifiles.com/tools/split-file/');
    expect(human).toContain('cat holiday.mp4.001 holiday.mp4.002 holiday.mp4.003 > holiday.mp4');
    expect(human).toContain('copy /b holiday.mp4.001+holiday.mp4.002+holiday.mp4.003 holiday.mp4');
    // Short enough that someone reads it.
    expect(text.split('\n').length).toBeLessThan(60);
  });

  it('globs the unix command once the explicit list stops being usable', () => {
    const many: Manifest = {
      ...SAMPLE,
      parts: Array.from({ length: 24 }, (_, i) => ({
        name: `holiday.mp4.${String(i + 1).padStart(3, '0')}`,
        bytes: 100,
      })),
    };
    const commands = joinCommands(many);
    // Safe only because the width is fixed, which is why it is conditional.
    expect(commands.unix).toBe('cat holiday.mp4.??? > holiday.mp4');
    // Windows keeps the explicit list however long: `copy /b` with a wildcard
    // orders by directory order, not by name.
    expect(commands.windows).toContain('holiday.mp4.001+holiday.mp4.002');
    expect(commands.windows).toContain('holiday.mp4.024 holiday.mp4');
  });

  it('reads back exactly what it wrote', () => {
    expect(parseManifest(buildManifest(SAMPLE))).toEqual(SAMPLE);
  });

  it('refuses to half-understand something that is not one of ours', () => {
    expect(parseManifest('just a text file')).toBeNull();
    expect(parseManifest(buildManifest(SAMPLE).replace('mubifiles/split-file', 'someone-else'))).toBeNull();
    expect(parseManifest(buildManifest(SAMPLE).replace(/"bytes": 314572800/, '"bytes": "big"'))).toBeNull();
    // Truncated mid-JSON, as a copy interrupted halfway would be.
    const cut = buildManifest(SAMPLE);
    expect(parseManifest(cut.slice(0, cut.length - 40))).toBeNull();
  });
});

describe('checking the parts against the manifest', () => {
  it('passes the set it describes', () => {
    expect(checkManifest(SAMPLE, present(SAMPLE))).toEqual([]);
  });

  it('names a part that is the right name and the wrong size', () => {
    const truncated = present(SAMPLE);
    truncated[1].bytes = 104_857_599;
    const problems = checkManifest(SAMPLE, truncated);
    expect(problems).toEqual([
      { kind: 'size', name: 'holiday.mp4.002', expected: 104_857_600, found: 104_857_599 },
    ]);
    // The message has to say which file and both numbers, or it is not actionable.
    expect(mismatchMessage(problems[0])).toContain('holiday.mp4.002');
    expect(mismatchMessage(problems[0])).toContain('104,857,600');
    expect(mismatchMessage(problems[0])).toContain('104,857,599');
  });

  it('names a part that is listed but absent', () => {
    const problems = checkManifest(SAMPLE, present(SAMPLE).slice(0, 2));
    expect(problems).toEqual([{ kind: 'missing', names: ['holiday.mp4.003'] }]);
  });

  it('names a part that is present but not listed', () => {
    const problems = checkManifest(SAMPLE, [...present(SAMPLE), { name: 'other.zip.001', bytes: 5 }]);
    expect(problems).toEqual([{ kind: 'unexpected', names: ['other.zip.001'] }]);
  });
});

/**
 * The manifest must never become load-bearing. If a size check could be
 * satisfied by the total alone, a transfer that truncated one part and padded
 * another would pass — which is the whole reason sizes are checked per part.
 */
describe('control: a total-size check cannot notice a shifted boundary', () => {
  it.fails('accepts parts whose total is right and whose boundaries are wrong', () => {
    const shifted = present(SAMPLE);
    shifted[0].bytes += 4096;
    shifted[1].bytes -= 4096;
    const total = (list: { bytes: number }[]) => list.reduce((s, p) => s + p.bytes, 0);
    expect(total(shifted)).toBe(total(SAMPLE.parts)); // the weak check passes
    expect(checkManifest(SAMPLE, shifted)).toEqual([]); // the real one does not
  });
});
