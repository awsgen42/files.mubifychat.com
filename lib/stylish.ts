/**
 * Turning a name into styled Unicode, and being honest about what survives.
 *
 * The tables are generated from the Unicode Character Database rather than
 * typed, because typing them is how you ship a name containing a reserved code
 * point. Mathematical Alphanumeric Symbols is not a contiguous block: fourteen
 * of its letters were already encoded in Letterlike Symbols years earlier, so
 * the slots that would hold them are unassigned and naive code point
 * arithmetic walks straight into the holes. Every borrowed character was
 * checked against its own compatibility decomposition — U+210E PLANCK CONSTANT
 * really does decompose to <font> 0068 — before it was allowed into a table.
 *
 * The grouping is by mechanism, not by taste. Where a character comes from is
 * the thing that predicts whether it survives being pasted somewhere, and it
 * is something we can state without claiming to have tested anyone's app.
 */

/** Every character a style maps, in the order the rows are written. */
export const ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export type StyleGroup = 'safe' | 'plane1' | 'combining';

export interface StyleGroupInfo {
  id: StyleGroup;
  title: string;
  /** The mechanical reason this group behaves the way it does. */
  note: string;
}

/**
 * Three groups, ordered by how much has to go right for the text to arrive
 * intact. No claim here is about a particular app — each is a property of the
 * characters themselves, which is the part we can actually check.
 */
export const STYLE_GROUPS: readonly StyleGroupInfo[] = [
  {
    id: 'safe',
    title: 'Safest — one character in, one character out',
    note: 'Every letter becomes a single code point from a block encoded in the 1990s, inside the Basic Multilingual Plane. Your name keeps its length, and these have been in system fonts for decades. If anything works where you are pasting it, it is one of these.',
  },
  {
    id: 'plane1',
    title: 'Usually fine — but outside the common plane',
    note: 'These come from Mathematical Alphanumeric Symbols, added in 2001 and living above U+FFFF. Each letter is still one character, but two UTF-16 units — so a field counting "characters" in the JavaScript sense sees double. Anything that does not have the font shows boxes rather than letters.',
  },
  {
    id: 'combining',
    title: 'Decorations — expect these to be rejected',
    note: 'Not substitutions at all: an invisible combining mark is added after every letter, so an eight-character name becomes sixteen code points. Length limits count those. Many places strip combining marks outright, and where they do not, the rendering depends entirely on the font.',
  },
];

export interface Style {
  id: string;
  name: string;
  group: StyleGroup;
  /** What the characters actually are, stated on the page. */
  builtFrom: string;
  /** The mapped output for ALPHABET, one code point per source character. */
  row?: string;
  /** Characters ALPHABET contains that this style has no mapping for. */
  unmapped?: string;
  /** For the combining group: the mark appended after each character. */
  mark?: string;
}

export const STYLES: readonly Style[] = [
  {
    id: 'fullwidth',
    name: 'Fullwidth',
    group: 'safe',
    builtFrom:
      'Halfwidth and Fullwidth Forms (U+FF00), the block that exists so Latin letters can sit on a CJK grid. Every character has a plain ASCII equivalent recorded in Unicode.',
    row: 'ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ０１２３４５６７８９',
    unmapped: '',
  },
  {
    id: 'circled',
    name: 'Circled',
    group: 'safe',
    builtFrom:
      'Enclosed Alphanumerics (U+2460), encoded in 1993 for list markers and diagrams.',
    row: 'ⒶⒷⒸⒹⒺⒻⒼⒽⒾⒿⓀⓁⓂⓃⓄⓅⓆⓇⓈⓉⓊⓋⓌⓍⓎⓏⓐⓑⓒⓓⓔⓕⓖⓗⓘⓙⓚⓛⓜⓝⓞⓟⓠⓡⓢⓣⓤⓥⓦⓧⓨⓩ⓪①②③④⑤⑥⑦⑧⑨',
    unmapped: '',
  },
  {
    id: 'small-caps',
    name: 'Small caps',
    group: 'safe',
    builtFrom:
      'Phonetic blocks — these are real letters used by linguists, not decoration. Unicode has never encoded a small capital X, so X is left alone.',
    row: 'ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘꞯʀꜱᴛᴜᴠᴡXʏᴢᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘꞯʀꜱᴛᴜᴠᴡxʏᴢ0123456789',
    unmapped: 'Xx0123456789',
  },
  {
    id: 'math-bold',
    name: 'Bold',
    group: 'plane1',
    builtFrom:
      'Mathematical Alphanumeric Symbols (U+1D400). Outside the Basic Multilingual Plane, so each letter is two UTF-16 units.',
    row: '𝐀𝐁𝐂𝐃𝐄𝐅𝐆𝐇𝐈𝐉𝐊𝐋𝐌𝐍𝐎𝐏𝐐𝐑𝐒𝐓𝐔𝐕𝐖𝐗𝐘𝐙𝐚𝐛𝐜𝐝𝐞𝐟𝐠𝐡𝐢𝐣𝐤𝐥𝐦𝐧𝐨𝐩𝐪𝐫𝐬𝐭𝐮𝐯𝐰𝐱𝐲𝐳𝟎𝟏𝟐𝟑𝟒𝟓𝟔𝟕𝟖𝟗',
    unmapped: '',
  },
  {
    id: 'math-italic',
    name: 'Italic',
    group: 'plane1',
    builtFrom:
      'Mathematical Alphanumeric Symbols. Italic has no digits, so numbers stay plain.',
    row: '𝐴𝐵𝐶𝐷𝐸𝐹𝐺𝐻𝐼𝐽𝐾𝐿𝑀𝑁𝑂𝑃𝑄𝑅𝑆𝑇𝑈𝑉𝑊𝑋𝑌𝑍𝑎𝑏𝑐𝑑𝑒𝑓𝑔ℎ𝑖𝑗𝑘𝑙𝑚𝑛𝑜𝑝𝑞𝑟𝑠𝑡𝑢𝑣𝑤𝑥𝑦𝑧0123456789',
    unmapped: '0123456789',
  },
  {
    id: 'math-bold-italic',
    name: 'Bold italic',
    group: 'plane1',
    builtFrom:
      'Mathematical Alphanumeric Symbols. No digits in this range.',
    row: '𝑨𝑩𝑪𝑫𝑬𝑭𝑮𝑯𝑰𝑱𝑲𝑳𝑴𝑵𝑶𝑷𝑸𝑹𝑺𝑻𝑼𝑽𝑾𝑿𝒀𝒁𝒂𝒃𝒄𝒅𝒆𝒇𝒈𝒉𝒊𝒋𝒌𝒍𝒎𝒏𝒐𝒑𝒒𝒓𝒔𝒕𝒖𝒗𝒘𝒙𝒚𝒛0123456789',
    unmapped: '0123456789',
  },
  {
    id: 'math-sans',
    name: 'Sans-serif',
    group: 'plane1',
    builtFrom:
      'Mathematical Alphanumeric Symbols.',
    row: '𝖠𝖡𝖢𝖣𝖤𝖥𝖦𝖧𝖨𝖩𝖪𝖫𝖬𝖭𝖮𝖯𝖰𝖱𝖲𝖳𝖴𝖵𝖶𝖷𝖸𝖹𝖺𝖻𝖼𝖽𝖾𝖿𝗀𝗁𝗂𝗃𝗄𝗅𝗆𝗇𝗈𝗉𝗊𝗋𝗌𝗍𝗎𝗏𝗐𝗑𝗒𝗓𝟢𝟣𝟤𝟥𝟦𝟧𝟨𝟩𝟪𝟫',
    unmapped: '',
  },
  {
    id: 'math-sans-bold',
    name: 'Sans-serif bold',
    group: 'plane1',
    builtFrom:
      'Mathematical Alphanumeric Symbols.',
    row: '𝗔𝗕𝗖𝗗𝗘𝗙𝗚𝗛𝗜𝗝𝗞𝗟𝗠𝗡𝗢𝗣𝗤𝗥𝗦𝗧𝗨𝗩𝗪𝗫𝗬𝗭𝗮𝗯𝗰𝗱𝗲𝗳𝗴𝗵𝗶𝗷𝗸𝗹𝗺𝗻𝗼𝗽𝗾𝗿𝘀𝘁𝘂𝘃𝘄𝘅𝘆𝘇𝟬𝟭𝟮𝟯𝟰𝟱𝟲𝟳𝟴𝟵',
    unmapped: '',
  },
  {
    id: 'math-mono',
    name: 'Monospace',
    group: 'plane1',
    builtFrom:
      'Mathematical Alphanumeric Symbols.',
    row: '𝙰𝙱𝙲𝙳𝙴𝙵𝙶𝙷𝙸𝙹𝙺𝙻𝙼𝙽𝙾𝙿𝚀𝚁𝚂𝚃𝚄𝚅𝚆𝚇𝚈𝚉𝚊𝚋𝚌𝚍𝚎𝚏𝚐𝚑𝚒𝚓𝚔𝚕𝚖𝚗𝚘𝚙𝚚𝚛𝚜𝚝𝚞𝚟𝚠𝚡𝚢𝚣𝟶𝟷𝟸𝟹𝟺𝟻𝟼𝟽𝟾𝟿',
    unmapped: '',
  },
  {
    id: 'math-script',
    name: 'Script',
    group: 'plane1',
    builtFrom:
      'Mathematical Alphanumeric Symbols, with eleven letters borrowed from Letterlike Symbols where the block has holes.',
    row: '𝒜ℬ𝒞𝒟ℰℱ𝒢ℋℐ𝒥𝒦ℒℳ𝒩𝒪𝒫𝒬ℛ𝒮𝒯𝒰𝒱𝒲𝒳𝒴𝒵𝒶𝒷𝒸𝒹ℯ𝒻ℊ𝒽𝒾𝒿𝓀𝓁𝓂𝓃ℴ𝓅𝓆𝓇𝓈𝓉𝓊𝓋𝓌𝓍𝓎𝓏0123456789',
    unmapped: '0123456789',
  },
  {
    id: 'math-bold-script',
    name: 'Bold script',
    group: 'plane1',
    builtFrom:
      'Mathematical Alphanumeric Symbols. No digits in this range.',
    row: '𝓐𝓑𝓒𝓓𝓔𝓕𝓖𝓗𝓘𝓙𝓚𝓛𝓜𝓝𝓞𝓟𝓠𝓡𝓢𝓣𝓤𝓥𝓦𝓧𝓨𝓩𝓪𝓫𝓬𝓭𝓮𝓯𝓰𝓱𝓲𝓳𝓴𝓵𝓶𝓷𝓸𝓹𝓺𝓻𝓼𝓽𝓾𝓿𝔀𝔁𝔂𝔃0123456789',
    unmapped: '0123456789',
  },
  {
    id: 'math-fraktur',
    name: 'Fraktur',
    group: 'plane1',
    builtFrom:
      'Mathematical Alphanumeric Symbols, five letters borrowed from Letterlike Symbols.',
    row: '𝔄𝔅ℭ𝔇𝔈𝔉𝔊ℌℑ𝔍𝔎𝔏𝔐𝔑𝔒𝔓𝔔ℜ𝔖𝔗𝔘𝔙𝔚𝔛𝔜ℨ𝔞𝔟𝔠𝔡𝔢𝔣𝔤𝔥𝔦𝔧𝔨𝔩𝔪𝔫𝔬𝔭𝔮𝔯𝔰𝔱𝔲𝔳𝔴𝔵𝔶𝔷0123456789',
    unmapped: '0123456789',
  },
  {
    id: 'math-double',
    name: 'Double-struck',
    group: 'plane1',
    builtFrom:
      'Mathematical Alphanumeric Symbols, seven letters borrowed from Letterlike Symbols.',
    row: '𝔸𝔹ℂ𝔻𝔼𝔽𝔾ℍ𝕀𝕁𝕂𝕃𝕄ℕ𝕆ℙℚℝ𝕊𝕋𝕌𝕍𝕎𝕏𝕐ℤ𝕒𝕓𝕔𝕕𝕖𝕗𝕘𝕙𝕚𝕛𝕜𝕝𝕞𝕟𝕠𝕡𝕢𝕣𝕤𝕥𝕦𝕧𝕨𝕩𝕪𝕫𝟘𝟙𝟚𝟛𝟜𝟝𝟞𝟟𝟠𝟡',
    unmapped: '',
  },  {
    id: 'strikethrough',
    name: 'Strikethrough',
    group: 'combining',
    builtFrom:
      'U+0336 COMBINING LONG STROKE OVERLAY after every character. The letters are untouched ASCII; the line is a separate character each time.',
    mark: '̶',
  },
  {
    id: 'underline',
    name: 'Underline',
    group: 'combining',
    builtFrom:
      'U+0332 COMBINING LOW LINE after every character. Same mechanism as the strikethrough, and the same doubling of length.',
    mark: '̲',
  },
];

/** Built once: the row strings are ordered to match ALPHABET exactly. */
const TABLES = new Map<string, Map<string, string>>(
  STYLES.filter((style) => style.row).map((style) => {
    const targets = [...style.row!];
    const source = [...ALPHABET];
    if (targets.length !== source.length) {
      throw new Error(`stylish: ${style.id} has ${targets.length} entries, expected ${source.length}`);
    }
    const unmapped = new Set([...(style.unmapped ?? '')]);
    return [
      style.id,
      new Map(source.filter((ch) => !unmapped.has(ch)).map((ch) => [ch, targets[source.indexOf(ch)]])),
    ];
  }),
);

/**
 * Applies a style.
 *
 * A character with no mapping is passed through unchanged rather than dropped
 * or replaced. Emitting a placeholder for it would put a box in someone's name
 * and dropping it would silently change their name — leaving it alone is the
 * only option that is never a surprise, and the page says which characters a
 * style leaves behind.
 */
export function applyStyle(input: string, styleId: string): string {
  const style = STYLES.find((s) => s.id === styleId);
  if (!style) return input;

  if (style.mark) {
    // Combining marks attach to the character before them, so the mark follows
    // each one. Spaces are skipped: a stroke through a space renders as a
    // stray dash in most fonts.
    return [...input].map((ch) => (ch === ' ' ? ch : ch + style.mark)).join('');
  }

  const table = TABLES.get(style.id);
  if (!table) return input;
  return [...input].map((ch) => table.get(ch) ?? ch).join('');
}

export interface Metrics {
  /** What a person counts. */
  characters: number;
  /** What a length limit written in JavaScript counts. */
  utf16Units: number;
  /** What a byte-counting limit sees. */
  utf8Bytes: number;
}

/**
 * The three numbers a name-length limit might be counting, because they differ
 * for exactly the styles people reach for and the difference is the reason a
 * name gets rejected.
 */
export function metrics(text: string): Metrics {
  return {
    characters: [...text].length,
    utf16Units: text.length,
    utf8Bytes: new TextEncoder().encode(text).length,
  };
}

export function stylesInGroup(group: StyleGroup): Style[] {
  return STYLES.filter((style) => style.group === group);
}
