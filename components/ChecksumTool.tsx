'use client';

import { useCallback, useRef, useState } from 'react';
import { formatBytes } from '@/lib/format';
import { ALGORITHMS, compareDigest, hashFile, type AlgorithmId, type CompareResult } from '@/lib/hashes';
import { AlertIcon, CheckIcon, CopyIcon, FileIcon, UploadIcon } from './Icons';
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
      <Card
        className={cx(
          'transition-colors',
          dragging && 'border-accent bg-accent-soft outline-2 outline-dashed outline-accent outline-offset-4',
        )}
      >
        <div
          onDragEnter={(event) => {
            event.preventDefault();
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
          <h2 className="text-base font-semibold">Choose a file</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Drop it anywhere in this box, or pick it below. It is read on this device and never
            uploaded.
          </p>

          {/* Column below sm so the filename always has its own row. Wrapping
              it beside the button meant the row was one line before a file was
              chosen and two after, which moved everything below it. */}
          <div className="mt-4 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <Button className="sm:shrink-0" onClick={() => inputRef.current?.click()}>
              <UploadIcon />
              Choose a file
            </Button>
            {/* Same height and same text size in both states. */}
            <div className="flex min-h-10 min-w-0 flex-1 items-center gap-2 text-sm">
              {file ? (
                <>
                  <FileIcon width={16} height={16} className="shrink-0 text-muted-foreground" />
                  <span className="truncate font-medium">{file.name}</span>
                  <span className="shrink-0 text-muted-foreground tabular-nums">
                    {formatBytes(file.size)}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">No file chosen yet.</span>
              )}
            </div>
          </div>

          <input
            ref={inputRef}
            type="file"
            hidden
            onChange={(event) => {
              pick(event.target.files);
              event.target.value = '';
            }}
          />

          {/* Always in the layout, only visibly filled while working — a bar
              that appears on pick would shove the results down the page. */}
          <div
            className="mt-4 h-2 overflow-hidden rounded-full border border-border-contrast bg-surface-muted"
            role="progressbar"
            aria-valuenow={Math.round(progress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Hashing progress"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent to-accent/70 transition-[width] duration-200"
              style={{ width: busy || digests ? `${Math.round(progress * 100)}%` : '0%' }}
            />
          </div>
          {/* Two lines of room below sm, one above: the done message wraps on
              a phone, and reserving a single line let it push the page down by
              the second one. */}
          <p className="mt-1.5 min-h-8 text-xs text-muted-foreground tabular-nums sm:min-h-5">
            {error ? (
              <span className="flex items-center gap-1.5 text-danger">
                <AlertIcon width={14} height={14} />
                {error}
              </span>
            ) : busy ? (
              `Reading… ${Math.round(progress * 100)}%`
            ) : digests ? (
              'Done — everything below was computed on this device.'
            ) : (
              ''
            )}
          </p>
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

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-sm font-medium">{label}</dt>
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
      </div>
      {/* break-all rather than truncate: a checksum you cannot see all of is
          not much use.

          The placeholder is a run of dots exactly as long as the digest it is
          standing in for, in the same monospace face, so it wraps to the same
          number of lines at every width. A single em-dash was one line where a
          SHA-256 is two on a phone, and the box growing by a line when the
          hash arrived pushed the rest of the page down. Reserving the space
          properly is the fix; measuring a height would only be right at the
          width it was measured at. */}
      <dd
        className={cx(
          'glass-input mt-1.5 break-all p-3 font-mono text-[13px] leading-relaxed',
          !value && 'select-none text-muted-foreground/30',
        )}
      >
        {value ?? '·'.repeat(hexLength)}
      </dd>
      <p className="mt-1.5 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}
