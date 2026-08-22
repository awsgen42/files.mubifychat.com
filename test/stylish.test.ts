import { describe, expect, it } from 'vitest';
import { ALPHABET, STYLES, STYLE_GROUPS, applyStyle, metrics, stylesInGroup } from '../lib/stylish';

const NAME = 'Alex X9';

/**
 * The fixture. Every style's output for one input, written out in full — if a
 * table entry changes, this says which one and to what, rather than a test
 * merely going red somewhere.
 */
const FIXTURE: Record<string, string> = {
  fullwidth: 'Ａｌｅｘ Ｘ９',
  circled: 'Ⓐⓛⓔⓧ Ⓧ⑨',
  'small-caps': 'ᴀʟᴇx X9',
  'math-bold': '𝐀𝐥𝐞𝐱 𝐗𝟗',
  'math-italic': '𝐴𝑙𝑒𝑥 𝑋9',
  'math-bold-italic': '𝑨𝒍𝒆𝒙 𝑿9',
  'math-sans': '𝖠𝗅𝖾𝗑 𝖷𝟫',
  'math-sans-bold': '𝗔𝗹𝗲𝘅 𝗫𝟵',
  'math-mono': '𝙰𝚕𝚎𝚡 𝚇𝟿',
  'math-script': '𝒜𝓁ℯ𝓍 𝒳9',
  'math-bold-script': '𝓐𝓵𝓮𝔁 𝓧9',
  'math-fraktur': '𝔄𝔩𝔢𝔵 𝔛9',
  'math-double': '𝔸𝕝𝕖𝕩 𝕏𝟡',
  strikethrough: 'A̶l̶e̶x̶ X̶9̶',
  underline: 'A̲l̲e̲x̲ X̲9̲',
};

describe('the style tables', () => {
  it('has a fixture for every style and no orphans', () => {
    expect(STYLES.map((s) => s.id).sort()).toEqual(Object.keys(FIXTURE).sort());
  });

  it.each(STYLES.map((s) => s.id))('%s matches its fixture', (id) => {
    expect(applyStyle(NAME, id)).toBe(FIXTURE[id]);
  });

  it('maps every character to exactly one code point', () => {
    for (const style of STYLES.filter((s) => s.row)) {
      const source = [...ALPHABET];
      const target = [...style.row!];
      expect(target.length, style.id).toBe(source.length);
    }
  });

  /**
   * The failure this whole approach exists to prevent. Mathematical
   * Alphanumeric Symbols has unassigned slots where Letterlike Symbols already
   * held the letter; counting from the start of the block lands in them.
   */
  it('emits no replacement character, control character or unassigned slot', () => {
    for (const style of STYLES) {
      const out = applyStyle(ALPHABET, style.id);
      expect(out, style.id).not.toContain('�');
      for (const ch of out) {
        const cp = ch.codePointAt(0)!;
        expect(cp, `${style.id} produced U+${cp.toString(16)}`).not.toBe(0xfffd);
        // Unassigned code points in this plane surface as unpaired surrogates
        // or as category Cn; neither should ever appear.
        expect(cp >= 0xd800 && cp <= 0xdfff, `${style.id} unpaired surrogate`).toBe(false);
      }
    }
  });

  it('round-trips back to ASCII through Unicode normalisation, where the style is reversible', () => {
    // NFKC is what a name filter that "cleans" text will apply. Every style
    // built from compatibility characters collapses back to the original.
    const reversible = ['fullwidth', 'circled', 'math-bold', 'math-italic', 'math-bold-italic',
      'math-sans', 'math-sans-bold', 'math-mono', 'math-script', 'math-bold-script',
      'math-fraktur', 'math-double'];
    for (const id of reversible) {
      expect(applyStyle(ALPHABET, id).normalize('NFKC'), id).toBe(ALPHABET);
    }
  });

  it('does not claim small caps is reversible, because it is not', () => {
    // These are real letters with no compatibility mapping, so normalising
    // leaves them alone. Listing them as reversible above would be a lie.
    expect(applyStyle('abc', 'small-caps').normalize('NFKC')).not.toBe('abc');
  });
});

describe('applying a style', () => {
  it('returns an empty string for empty input', () => {
    for (const style of STYLES) expect(applyStyle('', style.id), style.id).toBe('');
  });

  it('leaves spaces, punctuation and emoji alone', () => {
    expect(applyStyle('a b-c!', 'math-bold')).toBe('𝐚 𝐛-𝐜!');
    expect(applyStyle('a🙂b', 'math-bold')).toBe('𝐚🙂𝐛');
  });

  it('passes an unmapped character through unchanged rather than dropping it', () => {
    // Unicode has never encoded a small capital X.
    expect(applyStyle('XYZ', 'small-caps')).toBe('Xʏᴢ');
    expect(applyStyle('X9', 'small-caps')).toBe('X9');
  });

  it('skips spaces when adding combining marks', () => {
    // A stroke over a space renders as a stray dash in most fonts.
    expect(applyStyle('a b', 'strikethrough')).toBe('a̶ b̶');
  });

  it('returns the input untouched for a style that does not exist', () => {
    expect(applyStyle('Alex', 'no-such-style')).toBe('Alex');
  });
});

describe('the length numbers, which are the point of the page', () => {
  it('counts characters, UTF-16 units and bytes separately', () => {
    expect(metrics('Alex')).toEqual({ characters: 4, utf16Units: 4, utf8Bytes: 4 });
    // One character per letter, two UTF-16 units each.
    expect(metrics(applyStyle('Alex', 'math-bold'))).toEqual({
      characters: 4,
      utf16Units: 8,
      utf8Bytes: 16,
    });
    // Combining marks double the character count itself.
    expect(metrics(applyStyle('Alex', 'strikethrough'))).toEqual({
      characters: 8,
      utf16Units: 8,
      utf8Bytes: 12,
    });
  });

  it('keeps the safe group the same length as the input', () => {
    for (const style of stylesInGroup('safe')) {
      expect(metrics(applyStyle('Alex', style.id)).characters, style.id).toBe(4);
      expect(metrics(applyStyle('Alex', style.id)).utf16Units, style.id).toBe(4);
    }
  });

  it('puts every style in a group that exists', () => {
    const ids = new Set(STYLE_GROUPS.map((g) => g.id));
    for (const style of STYLES) expect(ids.has(style.group), style.id).toBe(true);
    for (const group of STYLE_GROUPS) expect(stylesInGroup(group.id).length, group.id).toBeGreaterThan(0);
  });
});

/**
 * The bug a hand-written table ships: counting from the first character of the
 * Mathematical Alphanumeric block puts U+1D455 — an unassigned slot — where
 * italic h belongs, because the letter was already encoded as U+210E.
 */
describe('control: naive code point arithmetic lands in the holes', () => {
  it.fails('produces an assigned character for every letter', () => {
    const naive = (ch: string) => String.fromCodePoint(0x1d434 + (ch.charCodeAt(0) - 65) + 26);
    const italicH = naive('h'.toUpperCase());
    expect(italicH.codePointAt(0)).toBe(0x210e);
  });
});
