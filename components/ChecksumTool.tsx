'use client';

import { useCallback, useRef, useState } from 'react';
import { formatBytes } from '@/lib/format';
import { ALGORITHMS, compareDigest, hashFile, type AlgorithmId, type CompareResult } from '@/lib/hashes';
import { AlertIcon, CheckIcon, CopyIcon, FileIcon, LockIcon, UploadIcon } from './Icons';
import { Button, Card, Pill, cx } from './ui';

const ALL: readonly AlgorithmId[] = ALGORITHMS.map((a) => a.id);

interface Digests {
  name: string;
  size: number;
  values: Record<string, string>;
}

export function ChecksumTool() {
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const [digests, setDigests] = useState<Digests | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [expected, setExpected] = useState('');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const runId = useRef(0);

  const busy = file !== null && digests === null && error === null;

  const run = useCallback(async (picked: File) => {
    const id = ++runId.current;
    setFile({ name: picked.name, size: picked.size });
    setDigests(null);
    setError(null);
    setProgress(0);

    try {
      const values = await hashFile(picked, ALL, {
        onProgress: (read) => {
          if (runId.current === id) setProgress(picked.size > 0 ? read / picked.size : 1);
        },
      });
      if (runId.current !== id) return;
      setDigests({ name: picked.name, size: picked.size, values });
    } catch (err) {
      if (runId.current !== id) return;
      setError(err instanceof Error ? err.message : 'That file could not be read.');
    }
  }, []);

  const pick = (files: FileList | null) => {
    const picked = files?.[0];
    if (picked) void run(picked);
  };

  return (
    <>
      {/* The dropzone. One card, dashed at rest, that becomes the file's own
          panel once there is a file — the same card, the same width, nothing
          new appearing below it. */}
      <Card
        className={cx(
          'border-2 border-dashed transition-colors',
          dragging && 'border-solid border-accent bg-accent-soft',
        )}
      >
        <div
          // The whole card is a drop target; the button below is the control.
          onDragEnter={(event) => {
            event.preventDefault();
            // Counted, not toggled. dragleave fires every time the pointer
            // crosses into a child element, so a boolean flickers off as soon
            // as the pointer reaches the button or the text inside the card.
            dragDepth.current += 1;
            setDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => {
            dragDepth.current -= 1;
            if (dragDepth.current <= 0) setDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            dragDepth.current = 0;
            setDragging(false);
            pick(event.dataTransfer.files);
          }}
        >
          <h2 className="text-base font-semibold">
            {file ? 'Your file' : 'Choose a file to hash'}
          </h2>

          {/* Fixed block: the two states are laid out to the same height, so
              picking a file swaps the contents without moving anything. */}
          <div className="mt-3 min-h-32 sm:min-h-28">
            {file ? (
              <>
                <div className="flex min-h-10 min-w-0 items-center gap-2 text-sm">
                  <FileIcon width={16} height={16} className="shrink-0 text-muted-foreground" />
                  <span className="truncate font-medium">{file.name}</span>
                  <span className="shrink-0 text-muted-foreground tabular-nums">
                    {formatBytes(file.size)}
                  </span>
                </div>

                <div
                  className="mt-3 h-2 overflow-hidden rounded-full border border-border-contrast bg-surface-muted"
                  role="progressbar"
                  aria-valuenow={Math.round(progress * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Hashing progress"
                >
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-accent to-accent/70 transition-[width] duration-200"
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  />
                </div>

                <p className="mt-1.5 min-h-8 text-xs text-muted-foreground tabular-nums sm:min-h-5">
                  {error ? (
                    <span className="flex items-center gap-1.5 text-danger">
                      <AlertIcon width={14} height={14} />
                      {error}
                    </span>
                  ) : busy ? (
                    `Reading… ${Math.round(progress * 100)}%`
                  ) : (
                    'Done — everything below was computed on this device.'
                  )}
                </p>

                <Button
                  variant="secondary"
                  className="mt-2 w-full sm:w-auto"
                  onClick={() => inputRef.current?.click()}
                >
                  <UploadIcon />
                  Choose a different file
                </Button>
              </>
            ) : (
              <>
                {/* A real button, not a clickable div: it is in the tab order
                    on its own, announces itself as a button, and responds to
                    Enter and Space without any of that being reimplemented. */}
                <Button
                  className="min-h-12 w-full text-base sm:w-auto sm:px-6"
                  onClick={() => inputRef.current?.click()}
                >
                  <UploadIcon />
                  Choose a file
                </Button>
                {/* Stated, not implied by a hover state — on a phone there is
                    no hover, so an affordance that only appears on one does
                    not exist. */}
                <p className="mt-3 text-sm text-muted-foreground">…or drop a file anywhere in this box.</p>
              </>
            )}
          </div>

          {/* The differentiator, and the reason someone would use this rather
              than the first result that uploads their file. It stays on screen
              in both states. */}
          <p className="mt-1 flex items-start gap-2 text-xs text-muted-foreground">
            <LockIcon width={14} height={14} className="mt-0.5 shrink-0" />
            <span>Your file never leaves this browser. Nothing is uploaded.</span>
          </p>

          <input
            ref={inputRef}
            type="file"
            hidden
            onChange={(event) => {
              pick(event.target.files);
              event.target.value = '';
            }}
          />
        </div>
      </Card>

      <Card>
        <h2 className="text-base font-semibold">Checksums</h2>
        {/* Rows render before there is a file, with placeholders, so the card
            is its final height from first paint. This is the same reason the
            home page renders the real StartScreen rather than a spinner. */}
        <dl className="mt-4 grid gap-4">
          {ALGORITHMS.map((algorithm) => (
            <DigestRow
              key={algorithm.id}
              label={algorithm.label}
              note={algorithm.note}
              hexLength={algorithm.hexLength}
              value={digests?.values[algorithm.id]}
            />
          ))}
        </dl>
      </Card>

      <Card>
        <h2 className="text-base font-semibold">Compare against the published hash</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste what the publisher gave you. A whole line from a checksums file is fine — the hash
          is picked out of it.
        </p>
        <textarea
          value={expected}
          onChange={(event) => setExpected(event.target.value)}
          rows={2}
          spellCheck={false}
          placeholder="e.g. 9f86d081884c7d65… or the whole SHA256SUMS line"
          aria-label="Expected hash"
          className="glass-input mt-3 w-full resize-y p-3 font-mono text-[13px] outline-none placeholder:text-muted-foreground/60"
        />
        <div className="mt-3 min-h-16 grid gap-2">
          {ALGORITHMS.map((algorithm) => {
            const actual = digests?.values[algorithm.id];
            const result: CompareResult = actual
              ? compareDigest(actual, expected, algorithm.hexLength)
              : 'empty';
            if (result === 'empty' || result === 'unrecognised') return null;
            return (
              <p key={algorithm.id} className="flex items-center gap-2 text-sm">
                <Pill tone={result === 'match' ? 'success' : 'muted'}>
                  {result === 'match' ? <CheckIcon width={14} height={14} /> : <AlertIcon width={14} height={14} />}
                  {result === 'match' ? 'Match' : 'No match'}
                </Pill>
                <span className="text-muted-foreground">
                  {result === 'match'
                    ? `Identical to the ${algorithm.label} you pasted.`
                    : `The ${algorithm.label} of this file is not what you pasted.`}
                </span>
              </p>
            );
          })}
          {expected.trim() !== '' && digests === null && (
            <p className="text-sm text-muted-foreground">Choose a file and this will fill in.</p>
          )}
          {expected.trim() !== '' &&
            digests !== null &&
            ALGORITHMS.every(
              (a) => compareDigest(digests.values[a.id], expected, a.hexLength) === 'unrecognised',
            ) && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertIcon width={14} height={14} className="shrink-0" />
                That does not look like a SHA-256, SHA-1 or MD5 hash — check you copied all of it.
              </p>
            )}
        </div>
      </Card>
    </>
  );
}

function DigestRow({
  label,
  note,
  hexLength,
  value,
}: {
  label: string;
  note: string;
  hexLength: number;
  value: string | undefined;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be denied; the digest is selectable on screen.
    }
  };

  // Exactly <dt> and <dd> as the children of this group: a <dl> may only
  // contain dt/dd pairs, optionally wrapped one level in a <div>. Anything
  // else in the wrapper — a nested layout div, a stray <p> — breaks the
  // association between term and description for a screen reader.
  return (
    <div>
      <dt className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium">{label}</span>
        <Button
          variant="ghost"
          className="shrink-0 px-2 py-1 text-xs"
          onClick={copy}
          disabled={!value}
          aria-label={`Copy the ${label} digest`}
        >
          {copied ? <CheckIcon width={14} height={14} /> : <CopyIcon width={14} height={14} />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </dt>
      <dd className="mt-1.5">
        {/* break-all rather than truncate: a checksum you cannot see all of is
            not much use.

            Empty, the box holds a digest-length string with visibility:hidden.
            It occupies exactly the space the real digest will, wrapping to the
            same number of lines at every width, while being neither drawn nor
            announced — where a faint placeholder was both, and failed contrast
            at 1.5:1 for text nobody was meant to read. Measuring a height
            instead would only be right at the width it was measured at. */}
        <div className="glass-input break-all p-3 font-mono text-[13px] leading-relaxed">
          {value ?? <span className="invisible">{'0'.repeat(hexLength)}</span>}
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">{note}</p>
      </dd>
    </div>
  );
}
