'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { formatBytes } from '@/lib/format';
import { compressImage, percentSaved, type CompressResult, type OutputFormat } from '@/lib/images';
import { buildZip, safeEntryName } from '@/lib/zip';
import { AlertIcon, DownloadIcon, LockIcon, UploadIcon } from './Icons';
import { Button, Card, Pill, cx } from './ui';

const FORMATS: readonly { id: OutputFormat; label: string }[] = [
  { id: 'keep', label: 'Keep original' },
  { id: 'image/jpeg', label: 'JPEG' },
  { id: 'image/webp', label: 'WebP' },
];

const SIZES: readonly { value: number | null; label: string }[] = [
  { value: null, label: 'Original' },
  { value: 2560, label: '2560px' },
  { value: 1920, label: '1920px' },
  { value: 1280, label: '1280px' },
  { value: 800, label: '800px' },
];

export function ImageCompressTool() {
  const [quality, setQuality] = useState(0.8);
  const [maxDimension, setMaxDimension] = useState<number | null>(1920);
  const [format, setFormat] = useState<OutputFormat>('keep');
  const [results, setResults] = useState<CompressResult[]>([]);
  const [queued, setQueued] = useState(0);
  const [done, setDone] = useState(0);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const runId = useRef(0);
  const files = useRef<File[]>([]);

  const busy = queued > 0 && done < queued;

  const process = useCallback(
    async (list: File[], options: { quality: number; maxDimension: number | null; format: OutputFormat }) => {
      const id = ++runId.current;
      setQueued(list.length);
      setDone(0);
      setResults([]);

      const collected: CompressResult[] = [];
      // One at a time, deliberately. A decoded image is width x height x 4
      // bytes of RGBA regardless of how small the file was, so a dozen phone
      // photos decoded together is hundreds of megabytes; decoded in turn it
      // is one photo's worth.
      for (const file of list) {
        if (runId.current !== id) return;
        const result = await compressImage(file, options);
        if (runId.current !== id) return;
        collected.push(result);
        setResults([...collected]);
        setDone(collected.length);
      }
    },
    [],
  );

  const pick = (picked: FileList | null) => {
    const list = Array.from(picked ?? []).filter((f) => f.type.startsWith('image/'));
    if (list.length === 0) return;
    files.current = list;
    void process(list, { quality, maxDimension, format });
  };

  // Re-running on a settings change is what makes the controls feel like
  // controls rather than a form you submit.
  const reprocess = (next: Partial<{ quality: number; maxDimension: number | null; format: OutputFormat }>) => {
    const options = { quality, maxDimension, format, ...next };
    if (files.current.length > 0) void process(files.current, options);
  };

  const savedTotal = results.reduce((total, r) => total + (r.originalBytes - r.encodedBytes), 0);
  const originalTotal = results.reduce((total, r) => total + r.originalBytes, 0);

  return (
    <>
      <Card
        className={cx(
          'border-2 border-dashed transition-colors',
          dragging && 'border-solid border-accent bg-accent-soft',
        )}
      >
        <div
          onDragEnter={(event) => {
            event.preventDefault();
            // Counted, not toggled: dragleave fires whenever the pointer
            // crosses into a child, so a boolean flickers off over the button.
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
            {results.length > 0 ? 'Your images' : 'Choose images to compress'}
          </h2>

          <div className="mt-3 min-h-[13.5rem] sm:min-h-32">
            {results.length > 0 || busy ? (
              <>
                <p className="min-h-10 text-sm">
                  <span className="font-medium">
                    {done} of {queued} image{queued === 1 ? '' : 's'}
                  </span>
                  {originalTotal > 0 && !busy && (
                    <span className="text-muted-foreground">
                      {' '}
                      · {formatBytes(originalTotal)} → {formatBytes(originalTotal - savedTotal)}
                      {savedTotal > 0 && ` · ${percentSaved(originalTotal, originalTotal - savedTotal)}% smaller`}
                    </span>
                  )}
                </p>
                <div
                  className="mt-3 h-2 overflow-hidden rounded-full border border-border-contrast bg-surface-muted"
                  role="progressbar"
                  aria-valuenow={queued > 0 ? Math.round((done / queued) * 100) : 0}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Compression progress"
                >
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-accent to-accent/70 transition-[width] duration-200"
                    style={{ width: `${queued > 0 ? Math.round((done / queued) * 100) : 0}%` }}
                  />
                </div>
                <p className="mt-1.5 min-h-8 text-xs text-muted-foreground tabular-nums sm:min-h-5">
                  {busy ? 'Working — one image at a time, so memory stays flat.' : 'Done, on this device.'}
                </p>
                <Button
                  variant="secondary"
                  className="mt-2 w-full sm:w-auto"
                  onClick={() => inputRef.current?.click()}
                >
                  <UploadIcon />
                  Choose different images
                </Button>
              </>
            ) : (
              <>
                <Button
                  className="min-h-12 w-full text-base sm:w-auto sm:px-6"
                  onClick={() => inputRef.current?.click()}
                >
                  <UploadIcon />
                  Choose images
                </Button>
                <p className="mt-3 text-sm text-muted-foreground">…or drop them anywhere in this box.</p>
              </>
            )}
          </div>

          <p className="mt-1 flex items-start gap-2 text-xs text-muted-foreground">
            <LockIcon width={14} height={14} className="mt-0.5 shrink-0" />
            <span>Your images never leave this browser. Nothing is uploaded.</span>
          </p>

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(event) => {
              pick(event.target.files);
              event.target.value = '';
            }}
          />
        </div>
      </Card>

      <Card>
        <h2 className="text-base font-semibold">Settings</h2>
        <div className="mt-4 grid gap-4">
          <label className="block">
            <span className="flex items-baseline justify-between text-sm font-medium">
              Quality
              <span className="text-xs text-muted-foreground tabular-nums">
                {Math.round(quality * 100)}%
              </span>
            </span>
            <input
              type="range"
              min={30}
              max={100}
              step={5}
              value={Math.round(quality * 100)}
              onChange={(event) => {
                const next = Number(event.target.value) / 100;
                setQuality(next);
                reprocess({ quality: next });
              }}
              className="mt-2 w-full accent-[var(--accent)]"
            />
          </label>

          <fieldset>
            <legend className="text-sm font-medium">Longest edge</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {SIZES.map((size) => (
                <Button
                  key={size.label}
                  variant={maxDimension === size.value ? 'primary' : 'secondary'}
                  className="px-3 py-2 text-xs"
                  aria-pressed={maxDimension === size.value}
                  onClick={() => {
                    setMaxDimension(size.value);
                    reprocess({ maxDimension: size.value });
                  }}
                >
                  {size.label}
                </Button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium">Format</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {FORMATS.map((option) => (
                <Button
                  key={option.id}
                  variant={format === option.id ? 'primary' : 'secondary'}
                  className="px-3 py-2 text-xs"
                  aria-pressed={format === option.id}
                  onClick={() => {
                    setFormat(option.id);
                    reprocess({ format: option.id });
                  }}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </fieldset>
        </div>
      </Card>

      <Card>
        <div className="flex min-h-10 items-center justify-between gap-3">
          <h2 className="shrink-0 text-base font-semibold">Results</h2>
          {results.length > 1 && !busy && <DownloadAll results={results} />}
        </div>
        {/* A fixed height that scrolls inside itself, rather than a card that
            grows with the number of images.

            The list is the one thing here whose size cannot be reserved: it is
            as long as however many images were added. Letting it grow pushed
            everything below it down the page — 0.11 of layout shift on a
            390px screen, all of it after the user had already started working.
            A panel that is always this tall shifts nothing, at the cost of
            some empty space when there are only one or two results. */}
        <div className="mt-4 h-80 overflow-y-auto">
          {results.length === 0 ? (
            <p className="glass-input flex h-full items-center justify-center border-dashed p-6 text-center text-sm text-muted-foreground">
              Each image will appear here with its old and new size.
            </p>
          ) : (
            <ul className="grid gap-3">
              {results.map((result) => (
                <ResultRow key={result.name + result.originalBytes} result={result} />
              ))}
            </ul>
          )}
        </div>
      </Card>
    </>
  );
}

function ResultRow({ result }: { result: CompressResult }) {
  const saved = percentSaved(result.originalBytes, result.encodedBytes);
  const href = useObjectUrl(result.blob);

  return (
    <li className="rounded-xl border border-border-contrast bg-surface-muted p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{result.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
            {formatBytes(result.originalBytes)} → {formatBytes(result.encodedBytes)}
            {result.width > 0 && ` · ${result.width}×${result.height}`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {result.outcome === 'smaller' && saved > 0 && <Pill tone="success">{saved}% smaller</Pill>}
          {result.outcome === 'larger' && <Pill tone="muted">Original kept</Pill>}
          {result.outcome === 'blank' && <Pill tone="muted">Too large</Pill>}
          {result.outcome === 'failed' && <Pill tone="muted">Unreadable</Pill>}
          <a
            href={href}
            download={downloadName(result)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground shadow-lg shadow-accent/25 transition-all duration-200 hover:shadow-accent/40 hover:brightness-110 active:scale-[0.98]"
          >
            <DownloadIcon width={14} height={14} />
            Download
          </a>
        </div>
      </div>

      {/* All of them, not the first one that applies. A transparent PNG
          converted to JPEG can easily also come out larger, and showing only
          "it got bigger" hides the fact that the transparency was filled in —
          which is the more surprising of the two. */}
      {notices(result).map((notice) => (
        <p key={notice} className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
          <AlertIcon width={14} height={14} className="mt-0.5 shrink-0" />
          <span>{notice}</span>
        </p>
      ))}
    </li>
  );
}

/** Everything worth saying about one result, in the order it matters. */
function notices(result: CompressResult): string[] {
  const out: string[] = [];
  if (result.error) out.push(result.error);
  if (result.flattened) {
    out.push(
      'This image had transparency, which JPEG cannot store — the see-through areas were filled with white.',
    );
  }
  if (result.cappedByCanvasLimit) {
    out.push('This image was larger than your browser can process in one canvas, so it was scaled down to fit.');
  }
  if (result.outcome === 'larger') {
    out.push(
      'Re-encoding made this one bigger. The original is offered instead unless you picked a specific format.',
    );
  }
  return out;
}

function DownloadAll({ results }: { results: readonly CompressResult[] }) {
  const [zip, setZip] = useState<Blob | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const taken = new Set<string>();
      const entries = [];
      for (const result of results) {
        entries.push({
          name: safeEntryName(downloadName(result), taken),
          bytes: new Uint8Array(await result.blob.arrayBuffer()),
        });
      }
      if (!cancelled) setZip(buildZip(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [results]);

  const href = useObjectUrl(zip);
  if (!zip) return null;

  return (
    <a
      href={href}
      download="compressed-images.zip"
      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground shadow-lg shadow-accent/25 transition-all duration-200 hover:shadow-accent/40 hover:brightness-110 active:scale-[0.98]"
    >
      <DownloadIcon width={14} height={14} />
      Download all ({results.length})
    </a>
  );
}

/** One object URL per blob, released when it is replaced or the row goes. */
function useObjectUrl(blob: Blob | null): string {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!blob) return;
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  return url;
}

function downloadName(result: CompressResult): string {
  const stem = result.name.replace(/\.[^.]+$/, '');
  const extension =
    result.type === 'image/jpeg' ? 'jpg' : result.type === 'image/webp' ? 'webp' : result.type === 'image/png' ? 'png' : (result.name.split('.').pop() ?? 'img');
  return `${stem}.${extension}`;
}
