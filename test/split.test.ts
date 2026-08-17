import { describe, expect, it } from 'vitest';
import {
  classifyFirstPart,
  orderParts,
  orderProblemMessage,
  outputNameFor,
  parsePartName,
  partCount,
  partName,
  partRanges,
  partitionDropped,
} from '../lib/split';

describe('cutting the file up', () => {
  it('counts parts without a fencepost error', () => {
    expect(partCount(100, 25)).toBe(4);
    // One byte over is a fifth part, not a rounding error.
    expect(partCount(101, 25)).toBe(5);
    expect(partCount(25, 25)).toBe(1);
    expect(partCount(0, 25)).toBe(0);
  });

  it('produces contiguous ranges that cover the file exactly', () => {
    const ranges = partRanges(250, 100);
    expect(ranges).toEqual([
      { index: 1, start: 0, end: 100 },
      { index: 2, start: 100, end: 200 },
      { index: 3, start: 200, end: 250 },
    ]);
    // No gap and no overlap, which is the property that matters.
    for (let i = 1; i < ranges.length; i++) expect(ranges[i].start).toBe(ranges[i - 1].end);
    expect(ranges[ranges.length - 1].end).toBe(250);
  });

  it('names parts the way HJSplit and 7-Zip do', () => {
    expect(partName('holiday.mp4', 1)).toBe('holiday.mp4.001');
    expect(partName('holiday.mp4', 12)).toBe('holiday.mp4.012');
    // Beyond 999 it widens rather than wrapping onto an existing name.
    expect(partName('a.bin', 1000)).toBe('a.bin.1000');
  });
});

describe('reading a part name back', () => {
  it('recovers the original name and the index', () => {
    expect(parsePartName('holiday.mp4.007')).toEqual({ base: 'holiday.mp4', index: 7 });
    expect(parsePartName('archive.tar.gz.011')).toEqual({ base: 'archive.tar.gz', index: 11 });
  });

  it('refuses anything that is not a numbered part', () => {
    for (const name of ['holiday.mp4', 'notes.txt', '.001', 'file.1']) {
      expect(parsePartName(name), name).toBeNull();
    }
  });

  it('derives the output name from the parts', () => {
    expect(outputNameFor(['holiday.mp4.003', 'holiday.mp4.001'])).toBe('holiday.mp4');
    expect(outputNameFor(['nothing-useful'])).toBe('joined-file');
  });
});

describe('ordering parts', () => {
  it('agrees with a lexical sort while the padding width is fixed', () => {
    // Worth stating because the usual warning — "lexically .010 sorts before
    // .002" — is simply not true of zero-padded names, and a test that
    // pretended otherwise would be testing nothing.
    const names = Array.from({ length: 12 }, (_, i) => partName('f.bin', i + 1));
    const lexical = [...names].sort();
    const ordering = orderParts([...names].reverse());
    expect(ordering.ok).toBe(true);
    expect(ordering.ordered.map((p) => p.name)).toEqual(lexical);
  });

  it('diverges from a lexical sort where it actually matters', () => {
    // The padding width changes at a thousand parts, and lexical puts .1000
    // before .998 — a join that is the right size and silently corrupt.
    const names = ['f.bin.998', 'f.bin.999', 'f.bin.1000', 'f.bin.1001'];
    expect([...names].sort()).toEqual(['f.bin.1000', 'f.bin.1001', 'f.bin.998', 'f.bin.999']);
    const ordering = orderParts(names);
    expect(ordering.ok).toBe(true);
    expect(ordering.ordered.map((p) => p.index)).toEqual([998, 999, 1000, 1001]);
  });

  it('sorts input that arrives in no order at all', () => {
    // `input.files` is in selection order and a drop is in whatever order the
    // OS gave; neither is sorted, which is the everyday reason this exists.
    const ordering = orderParts(['f.bin.003', 'f.bin.001', 'f.bin.004', 'f.bin.002']);
    expect(ordering.ok).toBe(true);
    expect(ordering.ordered.map((p) => p.index)).toEqual([1, 2, 3, 4]);
  });

  it('refuses a gap by name, before anything is written', () => {
    const ordering = orderParts(['f.bin.001', 'f.bin.002', 'f.bin.004']);
    expect(ordering.ok).toBe(false);
    expect(ordering.problem).toEqual({ kind: 'gap', missing: [3] });
    expect(orderProblemMessage(ordering.problem!, 'f.bin')).toContain('003');
    expect(orderProblemMessage(ordering.problem!, 'f.bin')).toMatch(/nothing has been written/);
  });

  it('refuses a duplicate index', () => {
    const ordering = orderParts(['f.bin.001', 'f.bin.002', 'f.bin.002']);
    expect(ordering.ok).toBe(false);
    expect(ordering.problem).toEqual({ kind: 'duplicate', index: 2 });
  });

  it('refuses parts from two different files', () => {
    const ordering = orderParts(['a.bin.001', 'b.bin.002']);
    expect(ordering.ok).toBe(false);
    expect(ordering.problem?.kind).toBe('mixed');
  });

  it('refuses files that are not parts at all', () => {
    const ordering = orderParts(['holiday.mp4', 'notes.txt']);
    expect(ordering.ok).toBe(false);
    expect(ordering.problem?.kind).toBe('unnamed');
  });

  it('accepts a set that does not start at 001, since that is still contiguous', () => {
    // Someone joining the tail of a set is doing something deliberate; the
    // check is for holes, not for where the numbering begins.
    expect(orderParts(['f.bin.004', 'f.bin.005', 'f.bin.006']).ok).toBe(true);
  });
});

/**
 * The control.
 *
 * A size check is the obvious way to decide a set of parts is complete, and it
 * is exactly what a missing part defeats — nothing about the total says which
 * bytes are absent. This asserts that reasoning is sufficient and is expected
 * to fail, so the suite stays green only while the index check is what decides.
 */
describe('control: a size check cannot notice a missing part', () => {
  it.fails('accepts a set with a hole in it on the strength of its total size', () => {
    const withHole = ['f.bin.001', 'f.bin.002', 'f.bin.004'];
    const totalBytes = withHole.length * 25 * 1024 * 1024;
    expect(totalBytes).toBeGreaterThan(0); // a plausible-looking total
    expect(orderParts(withHole).ok).toBe(true);
  });
});

/* ------------------------------------------------------------------ */

/**
 * Byte-for-byte the first eight bytes of real files, produced with 7z, zip and
 * `zip -s` and read back with od. Every one of these was joined for real and
 * the result checked with the tool that owns the format.
 */
describe('saying what a set of parts actually is', () => {
  const head = (...bytes: number[]) => new Uint8Array([...bytes, 0, 0, 0, 0, 0, 0, 0, 0].slice(0, 8));
  const zipVolume = () => head(0x50, 0x4b, 0x03, 0x04, 0x0a, 0x00, 0x00, 0x00);
  const sevenZipVolume = () => head(0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c, 0x00, 0x04);
  const spannedZip = () => head(0x50, 0x4b, 0x07, 0x08, 0x50, 0x4b, 0x03, 0x04);
  const rar = () => head(0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x00);
  const plain = () => head(0x42, 0xe1, 0x79, 0xbd, 0x99, 0x9d, 0x2d, 0x8e);

  it('does not refuse a 7-Zip volume split, which joins perfectly', () => {
    // `7z a -v1m vol.7z payload.bin`, then `cat vol.7z.??? > joined.7z`:
    // 7z t passes and the extracted payload matches the original digest.
    const verdict = classifyFirstPart(sevenZipVolume());
    expect(verdict.refuse).toBe(false);
    expect(verdict.container).toBe('7-Zip');
    expect(verdict.message).toContain('open that in 7-Zip afterwards');
  });

  it('does not refuse a split ZIP, which is the commonest case there is', () => {
    const verdict = classifyFirstPart(zipVolume());
    expect(verdict.refuse).toBe(false);
    expect(verdict.container).toBe('ZIP');
    expect(verdict.message).toContain('gives you the .zip back');
  });

  it('refuses a spanned ZIP, and only a spanned ZIP', () => {
    // The one case where raw concatenation shifts every offset by four bytes:
    // 7-Zip reports a missing volume, python zipfile reports the entry corrupt.
    const verdict = classifyFirstPart(spannedZip());
    expect(verdict.refuse).toBe(true);
    expect(verdict.container).toBe('ZIP (spanned)');
    expect(verdict.message).toContain('zip -s');
  });

  it('checks the spanning marker before the ordinary local header', () => {
    // PK\x07\x08 begins with the same two bytes as PK\x03\x04; testing in the
    // wrong order would read every spanned ZIP as an ordinary one.
    expect(classifyFirstPart(spannedZip()).container).not.toBe('ZIP');
  });

  it('informs on RAR and says the ambiguity out loud', () => {
    const verdict = classifyFirstPart(rar());
    expect(verdict.refuse).toBe(false);
    expect(verdict.message).toContain('.part1.rar');
  });

  it('says nothing about a file it does not recognise', () => {
    expect(classifyFirstPart(plain())).toEqual({ refuse: false, container: null, message: null });
  });
});

/**
 * The false positive the first version of this feature would have shipped: a
 * rule that refused anything with an archive signature in part 001 blocks
 * 7-Zip's own volume split, which is a raw byte split that joins perfectly.
 */
describe('control: refusing a 7-Zip volume split would be wrong', () => {
  it.fails('refuses a .7z.001 set', () => {
    const sevenZip = new Uint8Array([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c, 0x00, 0x04]);
    expect(classifyFirstPart(sevenZip).refuse).toBe(true);
  });
});

describe('setting aside what is not a part', () => {
  const named = (...names: string[]) => names.map((name) => ({ name }));

  it('keeps the manifest, the parts and the junk apart', () => {
    const result = partitionDropped(
      named('movie.mkv.002', '.DS_Store', 'movie.mkv.join.txt', 'movie.mkv.001', 'CHECKSUMS.txt', 'Thumbs.db'),
    );
    expect(result.parts.map((p) => p.name)).toEqual(['movie.mkv.002', 'movie.mkv.001']);
    expect(result.manifest?.name).toBe('movie.mkv.join.txt');
    expect(result.setAside.map((p) => p.name)).toEqual(['.DS_Store', 'CHECKSUMS.txt', 'Thumbs.db']);
  });

  it('does not mistake the manifest for a part, which would corrupt the join', () => {
    const result = partitionDropped(named('movie.mkv.001', 'movie.mkv.join.txt'));
    expect(result.parts.map((p) => p.name)).toEqual(['movie.mkv.001']);
    expect(orderParts(result.parts.map((p) => p.name)).ok).toBe(true);
  });

  it('sets aside a second manifest rather than silently choosing one', () => {
    const result = partitionDropped(named('a.001', 'a.join.txt', 'b.join.txt'));
    expect(result.manifest?.name).toBe('a.join.txt');
    expect(result.setAside.map((p) => p.name)).toEqual(['b.join.txt']);
  });
});

/**
 * The trap, stated as a control: without the partition step the manifest is a
 * file like any other in the selection, and ordering refuses the whole set —
 * or, worse, a joiner that ignored the name would concatenate it.
 */
describe('control: without setting non-parts aside, a folder drop fails', () => {
  it.fails('orders a selection that still contains the manifest', () => {
    const dropped = ['movie.mkv.001', 'movie.mkv.002', 'movie.mkv.join.txt', '.DS_Store'];
    expect(orderParts(dropped).ok).toBe(true);
  });
});
