'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { formatBytes } from '@/lib/format';
import {
  FPS_CHOICES,
  MAX_FRAMES,
  PREVIEW_THRESHOLD,
  UndecodableError,
  clampRange,
  extractFrames,
  frameCount,
  isCapped,
  loadVideo,
  type Frame,
  type Range as TimeRange,
} from '@/lib/frames';
import { buildZipFromBlobs, safeEntryName } from '@/lib/zip';
import { AlertIcon, DownloadIcon, LockIcon, UploadIcon } from './Icons';
import { Button, Card, Pill, cx } from './ui';

const WIDTHS: readonly { value: number | null; label: string }[] = [
  { value: null, label: 'Original' },
  { value: 1920, label: '1920px' },
  { value: 1280, label: '1280px' },
  { value: 640, label: '640px' },
];

function seconds(value: number): string {
  const m = Math.floor(value / 60);
  const s = value - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

export function VideoFramesTool() {
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);
  const [source, setSource] = useState<{ width: number; height: number } | null>(null);
  const [range, setRange] = useState<TimeRange>({ start: 0, end: 0 });
  const [fps, setFps] = useState(2);
  const [maxWidth, setMaxWidth] = useState<number | null>(1280);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zipOnly, setZipOnly] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const runId = useRef(0);
  const madeUrls = useRef<string[]>([]);

  const planned = duration > 0 ? frameCount(range, fps) : 0;
  const capped = duration > 0 && isCapped(range, fps);
  const busy = progress !== null;
  // Above the threshold, painting the thumbnails costs more than making the
  // archive they came from — so previews switch themselves off rather than
  // the tool trying to render several hundred images.
  const previews = !zipOnly && planned <= PREVIEW_THRESHOLD;

  const releaseUrls = useCallback(() => {
    for (const url of madeUrls.current) URL.revokeObjectURL(url);
    madeUrls.current = [];
  }, []);
  useEffect(() => releaseUrls, [releaseUrls]);

  const choose = useCallback(
    async (picked: File) => {
      const id = ++runId.current;
      releaseUrls();
      setFile(picked);
      setFrames([]);
      setError(null);
      setProgress(null);
      setDuration(0);
      setSource(null);

      try {
        // Loaded up front so an undecodable file is reported before the user
        // has chosen anything or waited for anything.
        const { info, release } = await loadVideo(picked);
        release();
        if (runId.current !== id) return;
        setDuration(info.duration);
        setSource({ width: info.width, height: info.height });
        setRange({ start: 0, end: Math.min(info.duration, 10) });
      } catch (err) {
        if (runId.current !== id) return;
        setError(
          err instanceof UndecodableError ? err.message : 'That file could not be read as a video.',
        );
      }
    },
    [releaseUrls],
  );

  const pick = (list: FileList | null) => {
    const picked = list?.[0];
    if (picked) void choose(picked);
  };

  const run = async () => {
    if (!file || duration <= 0) return;
    const id = ++runId.current;
    releaseUrls();
    setFrames([]);
    setError(null);
    setProgress({ done: 0, total: planned });

    try {
      const result = await extractFrames(file, {
        fps,
        range: clampRange(range, duration),
        maxWidth,
        quality: 0.9,
        withPreviews: previews,
        onProgress: (done, total) => {
          if (runId.current === id) setProgress({ done, total });
        },
      });
      if (runId.current !== id) return;
      madeUrls.current = result.frames.map((f) => f.url).filter((u): u is string => Boolean(u));
      setFrames(result.frames);
    } catch (err) {
      if (runId.current !== id) return;
      setError(err instanceof Error ? err.message : 'Extraction failed.');
    } finally {
      if (runId.current === id) setProgress(null);
    }
  };

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
          <h2 className="text-base font-semibold">{file ? 'Your video' : 'Choose a video'}</h2>

          <div className="mt-3 min-h-[13.5rem] sm:min-h-32">
            {file ? (
              <>
                <div className="flex min-h-10 min-w-0 items-center gap-2 text-sm">
                  <span className="truncate font-medium">{file.name}</span>
                  <span className="shrink-0 text-muted-foreground tabular-nums">
                    {formatBytes(file.size)}
                  </span>
                </div>
                <p className="mt-1 min-h-10 text-xs text-muted-foreground tabular-nums">
                  {error ? (
                    <span className="flex items-start gap-1.5 text-danger">
                      <AlertIcon width={14} height={14} className="mt-0.5 shrink-0" />
                      <span>{error}</span>
                    </span>
                  ) : source ? (
                    `${source.width}×${source.height} · ${seconds(duration)} long`
                  ) : (
                    'Reading…'
                  )}
                </p>
                <Button
                  variant="secondary"
                  className="mt-2 w-full sm:w-auto"
                  onClick={() => inputRef.current?.click()}
                >
                  <UploadIcon />
                  Choose a different video
                </Button>
              </>
            ) : (
              <>
                <Button
                  className="min-h-12 w-full text-base sm:w-auto sm:px-6"
                  onClick={() => inputRef.current?.click()}
                >
                  <UploadIcon />
                  Choose a video
                </Button>
                <p className="mt-3 text-sm text-muted-foreground">…or drop one anywhere in this box.</p>
              </>
            )}
          </div>

          <p className="mt-1 flex items-start gap-2 text-xs text-muted-foreground">
            <LockIcon width={14} height={14} className="mt-0.5 shrink-0" />
            <span>Your video never leaves this browser. Nothing is uploaded, whatever its size.</span>
          </p>

          <input
            ref={inputRef}
            type="file"
            accept="video/*"
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
          <fieldset>
            <legend className="text-sm font-medium">Frames per second</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {FPS_CHOICES.map((choice) => (
                <Button
                  key={choice}
                  variant={fps === choice ? 'primary' : 'secondary'}
                  className="px-3 py-2 text-xs"
                  aria-pressed={fps === choice}
                  onClick={() => setFps(choice)}
                >
                  {choice} FPS
                </Button>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="flex items-baseline justify-between text-sm font-medium">
                Start
                <span className="text-xs text-muted-foreground tabular-nums">{seconds(range.start)}</span>
              </span>
              <input
                type="range"
                min={0}
                max={Math.max(0.1, duration)}
                step={0.1}
                value={range.start}
                disabled={duration <= 0}
                onChange={(event) => {
                  const start = Number(event.target.value);
                  setRange((r) => clampRange({ start, end: Math.max(start + 0.1, r.end) }, duration));
                }}
                className="mt-2 w-full accent-[var(--accent)] disabled:opacity-40"
              />
            </label>
            <label className="block">
              <span className="flex items-baseline justify-between text-sm font-medium">
                End
                <span className="text-xs text-muted-foreground tabular-nums">{seconds(range.end)}</span>
              </span>
              <input
                type="range"
                min={0}
                max={Math.max(0.1, duration)}
                step={0.1}
                value={range.end}
                disabled={duration <= 0}
                onChange={(event) => {
                  const end = Number(event.target.value);
                  setRange((r) => clampRange({ start: Math.min(r.start, end - 0.1), end }, duration));
                }}
                className="mt-2 w-full accent-[var(--accent)] disabled:opacity-40"
              />
            </label>
          </div>

          <fieldset>
            <legend className="text-sm font-medium">Output width</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {WIDTHS.map((option) => (
                <Button
                  key={option.label}
                  variant={maxWidth === option.value ? 'primary' : 'secondary'}
                  className="px-3 py-2 text-xs"
                  aria-pressed={maxWidth === option.value}
                  onClick={() => setMaxWidth(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </fieldset>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={zipOnly}
              onChange={(event) => setZipOnly(event.target.checked)}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            <span>
              Skip previews, ZIP only
              <span className="block text-xs text-muted-foreground">
                Turns itself on above {PREVIEW_THRESHOLD} frames — drawing them takes longer than
                making the archive.
              </span>
            </span>
          </label>

          {/* The count, before anything starts. This is the number that decides
              whether the request is sensible, so it is stated rather than
              discovered. */}
          <div className="glass-input flex min-h-16 flex-wrap items-center justify-between gap-3 p-3">
            <p className="text-sm">
              {duration > 0 ? (
                <>
                  <span className="font-medium tabular-nums">
                    {fps} FPS × {(range.end - range.start).toFixed(1)}s = {planned} frame
                    {planned === 1 ? '' : 's'}
                  </span>
                  {capped && (
                    <span className="block text-xs text-muted-foreground">
                      Capped at {MAX_FRAMES}. Narrow the range or lower the frame rate for the rest.
                    </span>
                  )}
                </>
              ) : (
                <span className="text-muted-foreground">Choose a video to see the frame count.</span>
              )}
            </p>
            {/* Fixed width: the label becomes "Extracting 7/12…" while it
                works, and a button that resizes mid-run nudges everything
                beside it. Small, but measurable — 0.0001 of layout shift. */}
            <Button
              className="min-w-[11.5rem]"
              onClick={() => void run()}
              disabled={duration <= 0 || busy || planned === 0}
            >
              {busy ? `Extracting ${progress.done}/${progress.total}…` : 'Extract frames'}
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex min-h-10 items-center justify-between gap-3">
          <h2 className="shrink-0 text-base font-semibold">Frames</h2>
          {frames.length > 1 && !busy && <DownloadAll frames={frames} name={file?.name ?? 'video'} />}
        </div>
        {/* Fixed height that scrolls inside itself: the number of frames is not
            knowable in advance, and a panel that grows with it moves every
            section below it down the page. */}
        <div className="mt-4 h-80 overflow-y-auto">
          {frames.length === 0 ? (
            <p className="glass-input flex h-full items-center justify-center border-dashed p-6 text-center text-sm text-muted-foreground">
              {busy
                ? `Extracting frame ${progress.done} of ${progress.total}…`
                : 'Extracted frames appear here.'}
            </p>
          ) : previews ? (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {frames.map((frame) => (
                <FramePreview key={frame.index} frame={frame} name={file?.name ?? 'video'} />
              ))}
            </ul>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <p className="text-sm">
                <span className="font-medium">{frames.length} frames ready.</span>
                <span className="block text-xs text-muted-foreground">
                  Previews are off, so nothing was drawn — take them as a ZIP.
                </span>
              </p>
              <DownloadAll frames={frames} name={file?.name ?? 'video'} />
            </div>
          )}
        </div>
      </Card>
    </>
  );
}

function FramePreview({ frame, name }: { frame: Frame; name: string }) {
  return (
    <li>
      <a href={frame.url} download={frameName(name, frame)} className="block">
        {/* Aspect box: the thumbnail's size is known before the image loads,
            so filling the grid cannot move anything. */}
        <span className="block aspect-video overflow-hidden rounded-lg border border-border-contrast bg-surface-muted">
          {/* eslint-disable-next-line @next/next/no-img-element -- object URL, nothing to optimise */}
          <img src={frame.url} alt={`Frame at ${frame.time.toFixed(2)} seconds`} className="h-full w-full object-contain" />
        </span>
        <span className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground tabular-nums">
          {frame.time.toFixed(2)}s
          {frame.black && <Pill tone="muted">blank</Pill>}
        </span>
      </a>
    </li>
  );
}

function DownloadAll({ frames, name }: { frames: readonly Frame[]; name: string }) {
  const [zip, setZip] = useState<Blob | null>(null);
  const [href, setHref] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const taken = new Set<string>();
      const entries = frames.map((frame) => ({
        name: safeEntryName(frameName(name, frame), taken),
        blob: frame.blob,
      }));
      const archive = await buildZipFromBlobs(entries);
      if (!cancelled) setZip(archive);
    })();
    return () => {
      cancelled = true;
    };
  }, [frames, name]);

  useEffect(() => {
    if (!zip) return;
    const url = URL.createObjectURL(zip);
    setHref(url);
    return () => URL.revokeObjectURL(url);
  }, [zip]);

  if (!zip) return null;

  return (
    <a
      href={href}
      download={`${name.replace(/\.[^.]+$/, '')}-frames.zip`}
      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground shadow-lg shadow-accent/25 transition-all duration-200 hover:shadow-accent/40 hover:brightness-110 active:scale-[0.98]"
    >
      <DownloadIcon width={14} height={14} />
      Download all ({frames.length})
    </a>
  );
}

function frameName(videoName: string, frame: Frame): string {
  const stem = videoName.replace(/\.[^.]+$/, '');
  return `${stem}-${String(frame.index + 1).padStart(4, '0')}-${frame.time.toFixed(2)}s.jpg`;
}
