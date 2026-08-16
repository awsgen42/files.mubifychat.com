'use client';

/**
 * Pulling still frames out of a video, in the browser.
 *
 * The method is an HTMLVideoElement, a seek, and canvas.drawImage. That is the
 * whole toolkit, and it is the right one: it uses the decoders the browser
 * already ships, costs nothing to download, and works wherever the video does.
 * ffmpeg.wasm would be frame-accurate and would also put ~25 MB of WebAssembly
 * in front of someone who wanted a few JPEGs — which would destroy the only
 * reason to use this rather than a site that runs ffmpeg on a server.
 *
 * The cost of that choice is that seeking is approximate and asynchronous, and
 * the platform will happily hand back the previous frame, or a black one, with
 * no error at all. Most of this file is about not believing it.
 */

/* ------------------------------------------------------------------ */
/* What can be asked for                                               */
/* ------------------------------------------------------------------ */

/** Frames per second, as a video tool's users think about it. */
export const FPS_CHOICES = [1, 2, 4, 6, 12, 24, 30] as const;

/**
 * The most frames one run will produce.
 *
 * Not a technical limit — it is the point past which the result stops being
 * useful. 600 JPEGs is already a folder nobody will look through one by one,
 * and every frame beyond it costs a seek, a decode and an encode.
 */
export const MAX_FRAMES = 600;

/**
 * Above this many frames the previews are skipped by default. Painting several
 * hundred thumbnails takes longer than producing the archive they came from,
 * and the archive is what the user actually wanted.
 */
export const PREVIEW_THRESHOLD = 60;

export interface Range {
  start: number;
  end: number;
}

/** The frame timestamps a request produces, before any of them are extracted. */
export function frameTimes(range: Range, fps: number, cap = MAX_FRAMES): number[] {
  const span = Math.max(0, range.end - range.start);
  const step = 1 / fps;
  const times: number[] = [];
  // Strictly inside the range: a frame exactly at `end` is past the last one
  // on a clip whose duration is the end, and seeking there lands on nothing.
  for (let t = range.start; t < range.end - 1e-6 && times.length < cap; t += step) {
    times.push(Number(t.toFixed(4)));
  }
  if (times.length === 0 && span > 0) times.push(range.start);
  return times;
}

/** How many frames a request would produce, for showing before it starts. */
export function frameCount(range: Range, fps: number, cap = MAX_FRAMES): number {
  return frameTimes(range, fps, cap).length;
}

/** Whether the request was truncated by the cap rather than by the range. */
export function isCapped(range: Range, fps: number, cap = MAX_FRAMES): boolean {
  const uncapped = Math.max(0, range.end - range.start) * fps;
  return uncapped > cap;
}

export function clampRange(range: Range, duration: number): Range {
  const start = Math.min(Math.max(0, range.start), Math.max(0, duration - 0.05));
  const end = Math.min(Math.max(start + 0.05, range.end), duration);
  return { start, end };
}

/* ------------------------------------------------------------------ */
/* 3. Rotation                                                         */
/* ------------------------------------------------------------------ */

/**
 * The size a frame should be drawn at.
 *
 * Browsers apply a video's rotation matrix when they decode it, so
 * videoWidth/videoHeight are display dimensions and drawImage produces an
 * upright frame — but that is a claim worth checking rather than assuming,
 * which is what the end-to-end test does with a real rotated file. This is
 * where a correction would go if a browser ever needed one; today it is the
 * identity, and the test is what says so.
 */
export function displaySize(video: { videoWidth: number; videoHeight: number }): {
  width: number;
  height: number;
} {
  return { width: video.videoWidth, height: video.videoHeight };
}

/** Scales to a requested output width, never enlarging. */
export function outputSize(
  width: number,
  height: number,
  maxWidth: number | null,
): { width: number; height: number } {
  if (maxWidth === null || width <= maxWidth || width === 0) return { width, height };
  const scale = maxWidth / width;
  return { width: maxWidth, height: Math.max(1, Math.round(height * scale)) };
}

/* ------------------------------------------------------------------ */
/* 1 & 2. Not believing the platform                                   */
/* ------------------------------------------------------------------ */

/**
 * A cheap fingerprint of what was drawn, used for two different lies.
 *
 * Sampling rather than hashing every pixel: this runs once per frame and only
 * has to distinguish "a different picture" from "the same picture again".
 */
export function signature(pixels: Uint8ClampedArray, samples = 512): string {
  const step = Math.max(4, Math.floor(pixels.length / samples / 4) * 4);
  let hash = 0;
  for (let i = 0; i < pixels.length; i += step) {
    // Luminance-ish, quantised: robust to the odd compression wobble between
    // two decodes of the same frame, sensitive to an actually different one.
    const v = (pixels[i] * 3 + pixels[i + 1] * 6 + pixels[i + 2]) >> 7;
    hash = (hash * 31 + v) | 0;
  }
  return hash.toString(36);
}

/**
 * Whether the canvas is black — which is what drawImage produces when it is
 * called before a frame has been decoded.
 *
 * Not an error, not an exception: a silently black canvas that encodes to a
 * perfectly valid small JPEG. A size check calls that a success, which is why
 * the pixels are looked at instead.
 *
 * A real fade-to-black frame reads the same way, so one black frame among many
 * is reported rather than treated as a failure; it is every frame being black
 * that means the decode never happened.
 */
export function isBlack(pixels: Uint8ClampedArray, threshold = 8): boolean {
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i] > threshold || pixels[i + 1] > threshold || pixels[i + 2] > threshold) return false;
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* Loading, and saying so when it cannot be loaded                     */
/* ------------------------------------------------------------------ */

export interface VideoInfo {
  duration: number;
  width: number;
  height: number;
}

/**
 * A readable name for what someone handed us, for the message when it will not
 * decode. The extension is used rather than the MIME type because that is what
 * the user sees on their own file, and browsers often report nothing useful
 * for the containers that fail.
 */
export function formatName(file: File): string {
  const extension = (file.name.split('.').pop() ?? '').toLowerCase();
  const names: Record<string, string> = {
    avi: 'AVI',
    wmv: 'WMV',
    flv: 'FLV',
    mkv: 'Matroska (MKV)',
    mpg: 'MPEG',
    mpeg: 'MPEG',
    m2ts: 'AVCHD (M2TS)',
    ts: 'MPEG transport stream',
    '3gp': '3GP',
    rm: 'RealMedia',
    vob: 'DVD VOB',
    mov: 'QuickTime (MOV)',
    mp4: 'MP4',
    webm: 'WebM',
  };
  return names[extension] ?? (extension ? extension.toUpperCase() : 'this file');
}

/**
 * Containers this browser will not open, whatever is inside them. Checked
 * before the file is loaded so the answer is immediate rather than arriving
 * after a wait, which for a large video is the difference between an
 * explanation and a hang.
 */
export function isKnownUnsupported(file: File): boolean {
  const extension = (file.name.split('.').pop() ?? '').toLowerCase();
  return ['avi', 'wmv', 'flv', 'rm', 'vob', 'mpg', 'mpeg', 'm2ts', 'ts', 'divx', 'asf'].includes(extension);
}

export class UndecodableError extends Error {
  constructor(
    readonly format: string,
    message: string,
  ) {
    super(message);
    this.name = 'UndecodableError';
  }
}

export function undecodableMessage(format: string): string {
  return (
    `Your browser cannot decode ${format}. This tool uses the video support built into the browser ` +
    `itself, which is what lets it work without uploading your file — and that support does not ` +
    `include this format. MP4 (H.264), WebM and most MOV files work. Converting to MP4 first will ` +
    `let this tool read it.`
  );
}

/* ------------------------------------------------------------------ */
/* The extraction itself                                               */
/* ------------------------------------------------------------------ */

export interface ExtractOptions {
  fps: number;
  range: Range;
  /** null keeps the video's own width. */
  maxWidth: number | null;
  quality: number;
  /** Object URLs are only minted when the previews will actually be shown. */
  withPreviews: boolean;
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

export interface Frame {
  index: number;
  time: number;
  blob: Blob;
  /** Only present when previews were asked for. */
  url?: string;
  black: boolean;
  /** The drawn picture matched the frame before it. */
  duplicate: boolean;
}

export interface ExtractResult {
  frames: Frame[];
  width: number;
  height: number;
  duration: number;
  blackCount: number;
  duplicateCount: number;
}

/** How long to wait for metadata before calling a file undecodable. */
const METADATA_TIMEOUT_MS = 15_000;
/** How long one seek may take before the run is abandoned. */
const SEEK_TIMEOUT_MS = 10_000;
/** Redraws attempted when the frame came back stale or black. */
const REDRAW_ATTEMPTS = 3;
/**
 * How long to wait for the compositor to say it presented a frame.
 *
 * Bounded because requestVideoFrameCallback does not always fire at all: a
 * paused video that is off-screen or not being composited may never present
 * one, and waiting for it forever hangs the extraction on the first frame.
 * Measured, not assumed — an unbounded wait is exactly what the end-to-end
 * test caught. What actually guarantees the frame is the pixel check below;
 * this is the fast path, not the proof.
 */
const PRESENT_TIMEOUT_MS = 250;

type FrameCallbackVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: () => void) => number;
};

/**
 * Loads the file far enough to know whether it can be decoded at all.
 *
 * Muted before anything else: seeking a video element with audio will play it,
 * and a page that starts making noise because someone dropped a file on it is
 * inexcusable.
 */
export function loadVideo(file: File): Promise<{ video: HTMLVideoElement; info: VideoInfo; release: () => void }> {
  if (isKnownUnsupported(file)) {
    const format = formatName(file);
    return Promise.reject(new UndecodableError(format, undecodableMessage(format)));
  }

  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.muted = true;
    video.volume = 0;
    video.playsInline = true;
    video.preload = 'auto';
    // In the document but out of sight. A video element that is not in the
    // document is not composited, and a browser has no reason to present
    // frames for something nobody can see — which makes every "has a frame
    // arrived" signal unreliable. One pixel, off-screen, costs nothing.
    video.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
    video.setAttribute('aria-hidden', 'true');
    document.body.appendChild(video);

    const url = URL.createObjectURL(file);
    const release = () => {
      video.removeAttribute('src');
      video.load();
      video.remove();
      URL.revokeObjectURL(url);
    };

    const fail = () => {
      clearTimeout(timer);
      release();
      const format = formatName(file);
      reject(new UndecodableError(format, undecodableMessage(format)));
    };
    const timer = setTimeout(fail, METADATA_TIMEOUT_MS);

    video.addEventListener('error', fail, { once: true });
    video.addEventListener(
      'loadedmetadata',
      () => {
        clearTimeout(timer);
        // Metadata can load for a file whose picture never will — an audio
        // stream in a video container, or a codec the container declares and
        // the browser cannot decode. No dimensions means no frames.
        if (!video.videoWidth || !video.videoHeight || !Number.isFinite(video.duration)) {
          fail();
          return;
        }
        const { width, height } = displaySize(video);
        resolve({ video, info: { duration: video.duration, width, height }, release });
      },
      { once: true },
    );

    video.src = url;
  });
}

/** Resolves once the element reports the seek finished, or gives up. */
function whenSeeked(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = () => {
      clearTimeout(timer);
      video.removeEventListener('seeked', done);
      resolve();
    };
    const timer = setTimeout(() => {
      video.removeEventListener('seeked', done);
      reject(new Error('Seeking timed out.'));
    }, SEEK_TIMEOUT_MS);
    video.addEventListener('seeked', done);
    video.currentTime = time;
  });
}

/**
 * Resolves once a frame has actually been presented.
 *
 * 'seeked' is not that promise. It says the element has moved its playback
 * position, not that a decoded picture is available to draw — draw on the next
 * tick and you get the frame before, or nothing. requestVideoFrameCallback is
 * the event that means what we need; where it is missing, two animation frames
 * is the best available approximation and the pixel check below is what
 * catches it when that is not enough.
 */
function whenPresented(video: FrameCallbackVideo): Promise<void> {
  const bounded = new Promise<void>((resolve) => setTimeout(resolve, PRESENT_TIMEOUT_MS));
  if (typeof video.requestVideoFrameCallback === 'function') {
    return Promise.race([
      new Promise<void>((resolve) => video.requestVideoFrameCallback!(() => resolve())),
      bounded,
    ]);
  }
  return Promise.race([
    new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
    bounded,
  ]);
}

/**
 * Extracts one frame per timestamp, sequentially.
 *
 * Sequential is not a simplification: a decoded frame is width x height x 4
 * bytes, and holding a few hundred of them is hundreds of megabytes. Each is
 * drawn, encoded to a Blob — which the browser can spill to disk — and the
 * canvas is reused, so what is alive at any moment is one frame.
 */
export async function extractFrames(file: File, options: ExtractOptions): Promise<ExtractResult> {
  const { video, info, release } = await loadVideo(file);

  try {
    const times = frameTimes(options.range, options.fps);
    const size = outputSize(info.width, info.height, options.maxWidth);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Canvas is unavailable.');

    const frames: Frame[] = [];
    let previous = '';
    let blackCount = 0;
    let duplicateCount = 0;

    for (const [index, time] of times.entries()) {
      if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');

      await whenSeeked(video, time);

      let sig = '';
      let black = true;
      let duplicate = false;
      // Draw, look at what actually arrived, and try again if it is the frame
      // before or no frame at all. Trusting 'seeked' alone is what produces a
      // folder of identical images.
      for (let attempt = 0; attempt < REDRAW_ATTEMPTS; attempt++) {
        await whenPresented(video);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        sig = signature(pixels);
        black = isBlack(pixels);
        duplicate = index > 0 && sig === previous;
        if (!black && !duplicate) break;
      }

      if (black) blackCount++;
      // A genuinely static shot repeats legitimately, so this is counted and
      // reported rather than treated as a failure.
      if (duplicate) duplicateCount++;
      previous = sig;

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', options.quality),
      );
      if (!blob) throw new Error('This browser could not write a JPEG.');

      frames.push({
        index,
        time,
        blob,
        ...(options.withPreviews ? { url: URL.createObjectURL(blob) } : {}),
        black,
        duplicate,
      });
      options.onProgress?.(frames.length, times.length);
    }

    // Every frame black means the picture never decoded — a codec the
    // container declared and the browser cannot actually read. Reported as
    // what it is rather than handed over as several hundred black JPEGs.
    if (frames.length > 0 && blackCount === frames.length) {
      const format = formatName(file);
      throw new UndecodableError(
        format,
        `Your browser opened this ${format} file but could not decode its picture — every frame came ` +
          `out blank. This usually means the video uses a codec the browser does not support, such as ` +
          `HEVC. Converting to MP4 (H.264) will let this tool read it.`,
      );
    }

    return { frames, width: size.width, height: size.height, duration: info.duration, blackCount, duplicateCount };
  } finally {
    release();
  }
}
