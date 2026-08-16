'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatBytes } from '@/lib/format';
import {
  PART_PRESETS,
  joinParts,
  orderParts,
  orderProblemMessage,
  outputNameFor,
  partCount,
  partName,
  saveMode,
  splitFile,
  type SaveMode,
} from '@/lib/split';
import { AlertIcon, CheckIcon, DownloadIcon, LockIcon, UploadIcon } from './Icons';
import { Button, Card, Pill, cx } from './ui';

type Mode = 'split' | 'join';

/**
 * Two tabs rather than two stacked sections.
 *
 * They are alternatives, not steps: nobody splits and joins in one sitting.
 * Showing both at once would put two dropzones above the fold and push the
 * primary control of whichever one you wanted below it, which is the
 * requirement this page has to meet at 390px.
 */
export function SplitFileTool() {
  const [mode, setMode] = useState<Mode>('split');
  const [support, setSupport] = useState<SaveMode>('download');

  // Read after mount: on the server there is no window, and rendering one
  // answer then correcting it would be exactly the layout shift this avoids.
  useEffect(() => setSupport(saveMode()), []);

  return (
    <>
      <Card>
        <div role="tablist" aria-label="Split or join" className="flex gap-2">
          {(['split', 'join'] as const).map((option) => (
            <Button
              key={option}
              role="tab"
              aria-selected={mode === option}
              variant={mode === option ? 'primary' : 'secondary'}
              className="min-h-11 flex-1 sm:flex-none sm:px-6"
              onClick={() => setMode(option)}
            >
              {option === 'split' ? 'Split a file' : 'Join parts'}
            </Button>
          ))}
        </div>
        {/* Stated before a file is chosen, not after: on Firefox and Safari
            the difference is a click per part, which changes whether someone
            wants to start at all. */}
        <p className="mt-3 flex min-h-10 items-start gap-2 text-xs text-muted-foreground">
          <LockIcon width={14} height={14} className="mt-0.5 shrink-0" />
          <span>
            Nothing is uploaded, whatever the size.{' '}
            {support === 'directory'
              ? 'Your browser can write the parts straight into a folder you choose.'
              : support === 'file-picker'
                ? 'Your browser will ask where to save each part in turn.'
                : 'Your browser cannot write files directly, so parts are saved one at a time — a click for each. For a large file, a computer running Chrome or Edge is far quicker.'}
          </span>
        </p>
      </Card>

      {mode === 'split' ? <SplitPane support={support} /> : <JoinPane support={support} />}
    </>
  );
}

/* ------------------------------------------------------------------ */

function SplitPane({ support }: { support: SaveMode }) {
  const [file, setFile] = useState<File | null>(null);
  const [partBytes, setPartBytes] = useState<number>(PART_PRESETS[0].bytes);
  const [withChecksum, setWithChecksum] = useState(true);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<{ parts: number; sha256?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  const parts = file ? partCount(file.size, partBytes) : 0;
  const busy = progress !== null;

  const run = async () => {
    if (!file) return;
    setError(null);
    setResult(null);

    try {
      const picker = (window as unknown as {
        showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
        showSaveFilePicker?: (o: { suggestedName: string }) => Promise<FileSystemFileHandle>;
      });

      let open: (name: string) => Promise<FileSystemWritableFileStream>;
      if (support === 'directory' && picker.showDirectoryPicker) {
        const dir = await picker.showDirectoryPicker();
        open = async (name) => (await dir.getFileHandle(name, { create: true })).createWritable();
      } else if (support === 'file-picker' && picker.showSaveFilePicker) {
        open = async (name) => (await picker.showSaveFilePicker!({ suggestedName: name })).createWritable();
      } else {
        setError(
          'This browser cannot write files directly. Splitting here would need a separate download for each part, which browsers block — use Chrome or Edge on a computer for a file this size.',
        );
        return;
      }

      setProgress({ done: 0, total: file.size });
      const outcome = await splitFile(
        file,
        { partBytes, withChecksum, onProgress: (done, total) => setProgress({ done, total }) },
        open,
      );
      setResult({ parts: outcome.parts.length, sha256: outcome.sha256 });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') setError(null);
      else setError(err instanceof Error ? err.message : 'Splitting failed.');
    } finally {
      setProgress(null);
    }
  };

  return (
    <>
      <Dropzone
        label={file ? 'Your file' : 'Choose a file to split'}
        cta="Choose a file"
        dragging={dragging}
        setDragging={setDragging}
        dragDepth={dragDepth}
        inputRef={inputRef}
        onFiles={(list) => {
          const picked = list?.[0];
          if (picked) {
            setFile(picked);
            setResult(null);
            setError(null);
          }
        }}
        detail={
          file ? (
            <>
              <span className="truncate font-medium">{file.name}</span>
              <span className="shrink-0 text-muted-foreground tabular-nums">{formatBytes(file.size)}</span>
            </>
          ) : null
        }
      />

      <Card>
        <h2 className="text-base font-semibold">Part size</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {PART_PRESETS.map((preset) => (
            <Button
              key={preset.label}
              variant={partBytes === preset.bytes ? 'primary' : 'secondary'}
              className="px-3 py-2 text-xs"
              aria-pressed={partBytes === preset.bytes}
              onClick={() => setPartBytes(preset.bytes)}
            >
              {preset.label}
              <span className="text-[10px] opacity-70">{preset.note}</span>
            </Button>
          ))}
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={withChecksum}
            onChange={(event) => setWithChecksum(event.target.checked)}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          <span>
            Also compute a SHA-256 of the original
            <span className="block text-xs text-muted-foreground">
              So whoever joins the parts can check the result on{' '}
              <Link href="/tools/checksum" className="underline underline-offset-2 hover:text-foreground">
                the checksum tool
              </Link>
              .
            </span>
          </span>
        </label>

        <div className="glass-input mt-4 flex min-h-16 flex-wrap items-center justify-between gap-3 p-3">
          <p className="text-sm">
            {file ? (
              <span className="font-medium tabular-nums">
                {formatBytes(file.size)} ÷ {formatBytes(partBytes)} = {parts} part{parts === 1 ? '' : 's'}
              </span>
            ) : (
              <span className="text-muted-foreground">Choose a file to see the part count.</span>
            )}
            {file && (
              <span className="block text-xs text-muted-foreground">
                Named {partName(file.name, 1)} … {partName(file.name, parts)}
              </span>
            )}
          </p>
          <Button className="min-w-[10rem]" onClick={() => void run()} disabled={!file || busy || parts === 0}>
            {busy ? `${Math.round((progress.done / progress.total) * 100)}%` : 'Split'}
          </Button>
        </div>

        <Outcome
          busy={busy}
          error={error}
          body={
            result && (
              <>
                <p className="flex items-center gap-2 text-sm">
                  <Pill tone="success">
                    <CheckIcon width={14} height={14} />
                    {result.parts} parts written
                  </Pill>
                </p>
                {result.sha256 && (
                  <p className="mt-2 break-all font-mono text-[13px] leading-relaxed text-muted-foreground">
                    SHA-256 of the original: {result.sha256}
                  </p>
                )}
              </>
            )
          }
        />
      </Card>
    </>
  );
}

/* ------------------------------------------------------------------ */

function JoinPane({ support }: { support: SaveMode }) {
  const [files, setFiles] = useState<File[]>([]);
  const [outputName, setOutputName] = useState('');
  const [expected, setExpected] = useState('');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<{ bytes: number; sha256?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  const ordering = useMemo(() => orderParts(files.map((f) => f.name)), [files]);
  const busy = progress !== null;

  const accept = useCallback((list: FileList | null) => {
    const picked = Array.from(list ?? []);
    if (picked.length === 0) return;
    setFiles(picked);
    setResult(null);
    setError(null);
    setOutputName(outputNameFor(picked.map((f) => f.name)));
  }, []);

  const run = async () => {
    if (!ordering.ok) return;
    setError(null);
    setResult(null);

    const byName = new Map(files.map((f) => [f.name, f]));
    const ordered = ordering.ordered.map((p) => byName.get(p.name)!);

    try {
      const picker = window as unknown as {
        showSaveFilePicker?: (o: { suggestedName: string }) => Promise<FileSystemFileHandle>;
      };
      if (!picker.showSaveFilePicker) {
        setError(
          'This browser cannot write a file directly, so a join of this kind is not possible here. Chrome or Edge on a computer can do it, or use `cat` or 7-Zip locally — the parts are plain byte ranges.',
        );
        return;
      }
      const handle = await picker.showSaveFilePicker({ suggestedName: outputName || 'joined-file' });
      const writable = await handle.createWritable();

      setProgress({ done: 0, total: ordered.reduce((s, f) => s + f.size, 0) });
      const outcome = await joinParts(
        ordered,
        { withChecksum: expected.trim() !== '', onProgress: (done, total) => setProgress({ done, total }) },
        writable,
      );
      setResult(outcome);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') setError(null);
      else setError(err instanceof Error ? err.message : 'Joining failed.');
    } finally {
      setProgress(null);
    }
  };

  const match = result?.sha256 && expected.trim() !== ''
    ? result.sha256 === (expected.trim().match(/\b[0-9a-f]{64}\b/i)?.[0] ?? '').toLowerCase()
    : null;

  return (
    <>
      <Dropzone
        label={files.length > 0 ? 'Your parts' : 'Choose the parts'}
        cta="Choose parts"
        multiple
        dragging={dragging}
        setDragging={setDragging}
        dragDepth={dragDepth}
        inputRef={inputRef}
        onFiles={accept}
        detail={
          files.length > 0 ? (
            <>
              <span className="truncate font-medium">
                {files.length} part{files.length === 1 ? '' : 's'}
              </span>
              <span className="shrink-0 text-muted-foreground tabular-nums">
                {formatBytes(files.reduce((s, f) => s + f.size, 0))}
              </span>
            </>
          ) : null
        }
      />

      <Card>
        <h2 className="text-base font-semibold">Join</h2>

        {/* The verdict on the set, before any bytes move. */}
        <div className="glass-input mt-3 min-h-16 p-3 text-sm">
          {files.length === 0 ? (
            <span className="text-muted-foreground">Choose the numbered parts of one file.</span>
          ) : ordering.ok ? (
            <span className="tabular-nums">
              <span className="font-medium">
                Parts {String(ordering.ordered[0].index).padStart(3, '0')}–
                {String(ordering.ordered[ordering.ordered.length - 1].index).padStart(3, '0')}, in order.
              </span>
              <span className="block text-xs text-muted-foreground">
                Sorted by number, so the order you picked them in does not matter.
              </span>
            </span>
          ) : (
            <span className="flex items-start gap-1.5 text-danger">
              <AlertIcon width={14} height={14} className="mt-0.5 shrink-0" />
              <span>{orderProblemMessage(ordering.problem!, outputName || 'this set')}</span>
            </span>
          )}
        </div>

        <label className="mt-4 block">
          <span className="text-sm font-medium">Save as</span>
          <input
            value={outputName}
            onChange={(event) => setOutputName(event.target.value)}
            spellCheck={false}
            placeholder="joined-file"
            className="glass-input mt-1.5 w-full p-3 text-sm outline-none placeholder:text-muted-foreground/60"
          />
        </label>

        <label className="mt-3 block">
          <span className="text-sm font-medium">Expected SHA-256 (optional)</span>
          <textarea
            value={expected}
            onChange={(event) => setExpected(event.target.value)}
            rows={2}
            spellCheck={false}
            placeholder="Paste the checksum the split produced, to verify the join"
            className="glass-input mt-1.5 w-full resize-y p-3 font-mono text-[13px] outline-none placeholder:text-muted-foreground/60"
          />
        </label>

        <div className="mt-4 flex justify-end">
          <Button className="min-w-[10rem]" onClick={() => void run()} disabled={!ordering.ok || busy}>
            {busy ? `${Math.round((progress.done / progress.total) * 100)}%` : 'Join and save'}
          </Button>
        </div>

        <Outcome
          busy={busy}
          error={error}
          body={
            result && (
              <>
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <Pill tone="success">
                    <CheckIcon width={14} height={14} />
                    {formatBytes(result.bytes)} written
                  </Pill>
                  {match === true && <Pill tone="success">Checksum matches</Pill>}
                  {match === false && <Pill tone="muted">Checksum does not match</Pill>}
                </p>
                {result.sha256 && (
                  <p className="mt-2 break-all font-mono text-[13px] leading-relaxed text-muted-foreground">
                    {result.sha256}
                  </p>
                )}
              </>
            )
          }
        />
      </Card>
    </>
  );
}

/* ------------------------------------------------------------------ */

/** Reserved outcome area, so a result appearing never moves the page. */
function Outcome({ busy, error, body }: { busy: boolean; error: string | null; body: React.ReactNode }) {
  return (
    <div className="mt-3 min-h-20">
      {error ? (
        <p className="flex items-start gap-1.5 text-sm text-danger">
          <AlertIcon width={14} height={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : busy ? (
        <p className="text-sm text-muted-foreground">Working — nothing is uploaded.</p>
      ) : (
        body
      )}
    </div>
  );
}

function Dropzone({
  label,
  cta,
  detail,
  multiple = false,
  dragging,
  setDragging,
  dragDepth,
  inputRef,
  onFiles,
}: {
  label: string;
  cta: string;
  detail: React.ReactNode;
  multiple?: boolean;
  dragging: boolean;
  setDragging: (v: boolean) => void;
  dragDepth: React.RefObject<number>;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFiles: (list: FileList | null) => void;
}) {
  return (
    <Card
      className={cx(
        'border-2 border-dashed transition-colors',
        dragging && 'border-solid border-accent bg-accent-soft',
      )}
    >
      <div
        onDragEnter={(event) => {
          event.preventDefault();
          // Counted, not toggled: dragleave fires whenever the pointer crosses
          // into a child, so a boolean flickers off over the button.
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
          onFiles(event.dataTransfer.files);
        }}
      >
        <h2 className="text-base font-semibold">{label}</h2>
        <div className="mt-3 min-h-32 sm:min-h-28">
          {detail ? (
            <>
              <div className="flex min-h-10 min-w-0 items-center gap-2 text-sm">{detail}</div>
              <Button
                variant="secondary"
                className="mt-2 w-full sm:w-auto"
                onClick={() => inputRef.current?.click()}
              >
                <UploadIcon />
                Choose again
              </Button>
            </>
          ) : (
            <>
              <Button
                className="min-h-12 w-full text-base sm:w-auto sm:px-6"
                onClick={() => inputRef.current?.click()}
              >
                <DownloadIcon />
                {cta}
              </Button>
              <p className="mt-3 text-sm text-muted-foreground">…or drop {multiple ? 'them' : 'it'} anywhere in this box.</p>
            </>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          multiple={multiple}
          hidden
          onChange={(event) => {
            onFiles(event.target.files);
            event.target.value = '';
          }}
        />
      </div>
    </Card>
  );
}
