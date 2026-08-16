/**
 * The sidecar manifest: one small text file written next to the parts.
 *
 * HARD CONSTRAINT, and the reason this file exists at all rather than a few
 * bytes of header: nothing goes inside the parts. They stay a raw byte split,
 * so `cat parts.* > file`, 7-Zip and HJSplit all keep working and the
 * round-trip digest is the digest of the original with nothing added. A
 * manifest that cost one byte of that would have cost the only thing this tool
 * has that a desktop joiner does not.
 *
 * Which means the manifest can only ever be a convenience. Everything it says
 * is checkable from the parts themselves; it exists so the check happens
 * before the join instead of after, and so the person at the other end — who
 * may not have been told anything — has the filename, the size and the two
 * commands in front of them.
 *
 * Human-readable first because that is who opens a .txt file. The JSON at the
 * bottom is what this tool reads back.
 */

/** Sorts immediately after the numbered parts, and cannot be read as one. */
export const MANIFEST_SUFFIX = '.join.txt';

export const JOIN_URL = 'https://www.mubifiles.com/tools/split-file/';

export interface ManifestPart {
  name: string;
  bytes: number;
}

export interface Manifest {
  original: string;
  bytes: number;
  sha256: string | null;
  parts: ManifestPart[];
}

export function manifestName(original: string): string {
  return `${original}${MANIFEST_SUFFIX}`;
}

export function isManifestName(name: string): boolean {
  return name.toLowerCase().endsWith(MANIFEST_SUFFIX);
}

/**
 * The shell commands, spelled out.
 *
 * The explicit `a+b+c` form is what people recognise, but at twenty-four parts
 * it is a line nobody will retype. Past a handful the Linux form becomes a
 * glob, which is safe precisely because the names are zero-padded to a fixed
 * width — the shell expands them in lexical order and lexical agrees with
 * numeric there. Windows gets the explicit list however long it is: `copy /b`
 * with a wildcard orders by directory order, not by name, and a command that
 * usually works is worse than a long one that always does.
 */
export function joinCommands(m: Manifest): { unix: string; windows: string } {
  const names = m.parts.map((p) => p.name);
  const widths = new Set(names.map((n) => n.slice(n.lastIndexOf('.') + 1).length));
  const fixedWidth = widths.size === 1 ? [...widths][0] : 0;
  const glob = fixedWidth > 0 ? `${m.original}.${'?'.repeat(fixedWidth)}` : null;
  const unix =
    names.length <= 6 || !glob
      ? `cat ${names.join(' ')} > ${m.original}`
      : `cat ${glob} > ${m.original}`;
  return { unix, windows: `copy /b ${names.join('+')} ${m.original}` };
}

const RULE = '--- machine-readable, for the tool ---';

export function buildManifest(m: Manifest): string {
  const commands = joinCommands(m);
  const lines = [
    `${m.original} was split into ${m.parts.length} parts`,
    '='.repeat(`${m.original} was split into ${m.parts.length} parts`.length),
    '',
    'This file is not one of the parts, and is not needed to put them back',
    'together. It is here so you can check you have all of them.',
    '',
    `Original file : ${m.original}`,
    `Size          : ${m.bytes.toLocaleString('en-US')} bytes`,
    `SHA-256       : ${m.sha256 ?? '(not computed)'}`,
    `Parts         : ${m.parts.length}`,
    '',
    'Put them back together',
    '----------------------',
    `In a browser, with nothing to install: ${JOIN_URL}`,
    'Drop this file in along with the parts and it checks them for you.',
    '',
    'Or on the command line, with no website at all:',
    `  Linux / macOS   ${commands.unix}`,
    `  Windows         ${commands.windows}`,
    '',
    'The parts',
    '---------',
    ...m.parts.map((p) => `  ${p.name}  ${p.bytes.toLocaleString('en-US')} bytes`),
    '',
    RULE,
    JSON.stringify(
      {
        tool: 'mubifiles/split-file',
        version: 1,
        original: m.original,
        bytes: m.bytes,
        sha256: m.sha256,
        parts: m.parts,
      },
      null,
      2,
    ),
    '',
  ];
  return lines.join('\n');
}

/**
 * Reads back what buildManifest wrote, and refuses anything it is not sure
 * about. A manifest that parses into something half-understood would produce
 * mismatch messages about fields that were never there.
 */
export function parseManifest(text: string): Manifest | null {
  const at = text.indexOf(RULE);
  if (at === -1) return null;
  try {
    const data = JSON.parse(text.slice(at + RULE.length)) as Partial<Manifest> & { tool?: string };
    if (data.tool !== 'mubifiles/split-file') return null;
    if (typeof data.original !== 'string' || typeof data.bytes !== 'number') return null;
    if (!Array.isArray(data.parts) || data.parts.length === 0) return null;
    for (const part of data.parts) {
      if (typeof part?.name !== 'string' || typeof part?.bytes !== 'number') return null;
    }
    return {
      original: data.original,
      bytes: data.bytes,
      sha256: typeof data.sha256 === 'string' ? data.sha256 : null,
      parts: data.parts.map((p) => ({ name: p.name, bytes: p.bytes })),
    };
  } catch {
    return null;
  }
}

export type ManifestMismatch =
  | { kind: 'count'; expected: number; found: number }
  | { kind: 'missing'; names: string[] }
  | { kind: 'unexpected'; names: string[] }
  | { kind: 'size'; name: string; expected: number; found: number };

/**
 * Compares the manifest against the parts actually in hand, before any bytes
 * move. Sizes are checked because that is the failure the manifest is uniquely
 * able to catch early: a part truncated by a failed transfer has the right
 * name, arrives in the right position, and produces a join that is silently
 * short.
 */
export function checkManifest(m: Manifest, present: readonly ManifestPart[]): ManifestMismatch[] {
  const found = new Map(present.map((p) => [p.name, p.bytes]));
  const problems: ManifestMismatch[] = [];

  const missing = m.parts.filter((p) => !found.has(p.name)).map((p) => p.name);
  if (missing.length > 0) problems.push({ kind: 'missing', names: missing });

  const expected = new Set(m.parts.map((p) => p.name));
  const extra = present.filter((p) => !expected.has(p.name)).map((p) => p.name);
  if (extra.length > 0) problems.push({ kind: 'unexpected', names: extra });

  if (missing.length === 0 && extra.length === 0 && m.parts.length !== present.length) {
    problems.push({ kind: 'count', expected: m.parts.length, found: present.length });
  }

  for (const part of m.parts) {
    const size = found.get(part.name);
    if (size !== undefined && size !== part.bytes) {
      problems.push({ kind: 'size', name: part.name, expected: part.bytes, found: size });
    }
  }

  return problems;
}

export function mismatchMessage(problem: ManifestMismatch): string {
  switch (problem.kind) {
    case 'count':
      return `The manifest lists ${problem.expected} parts but ${problem.found} were chosen.`;
    case 'missing':
      return `${problem.names.slice(0, 4).join(', ')}${problem.names.length > 4 ? `, and ${problem.names.length - 4} more` : ''} ${problem.names.length === 1 ? 'is' : 'are'} listed in the manifest but ${problem.names.length === 1 ? 'was' : 'were'} not chosen.`;
    case 'unexpected':
      return `${problem.names.slice(0, 4).join(', ')} ${problem.names.length === 1 ? 'is' : 'are'} not in the manifest — ${problem.names.length === 1 ? 'it does' : 'they do'} not belong to this file.`;
    case 'size':
      return `${problem.name} should be ${problem.expected.toLocaleString('en-US')} bytes but is ${problem.found.toLocaleString('en-US')}. It was truncated in transfer; joining it would produce a corrupt file.`;
  }
}
