'use client';

import { Sha256 } from './sha256';

/**
 * Direct device-to-device transfer over a WebRTC DataChannel.
 *
 * The file never reaches R2 on this path — it goes straight from one device to
 * the other across the local network. That makes it fast and free, and it is
 * why this is a second mode rather than the default: it needs both devices
 * online at the same moment, where the cloud path lets the sender upload and
 * walk away.
 *
 * Everything below is transport. The session document carries the two SDPs and
 * nothing else; see shared/signal.ts.
 */

/**
 * Chunk size, and the ceiling on how much may sit unsent before the loop waits.
 *
 * 256 KB is large enough that per-message overhead disappears and small enough
 * to stay well inside every implementation's message limit. The high-water mark
 * is what keeps a 1 GB file from becoming 1 GB of queued ArrayBuffers: the send
 * loop reads the next slice off disk only once the buffer has drained, so
 * memory is bounded by the buffer rather than by the file.
 */
export const LAN_CHUNK_BYTES = 256 * 1024;
export const LAN_HIGH_WATER_BYTES = 8 * 1024 * 1024;
export const LAN_LOW_WATER_BYTES = 1 * 1024 * 1024;

/**
 * How much arrives before it is handed to a Blob.
 *
 * Received chunks are JS-heap arrays until they become a Blob, at which point
 * the browser owns the storage and can spill it to disk. Flushing every 32 MB
 * keeps the heap flat across a transfer of any size.
 */
const RECEIVE_FLUSH_BYTES = 32 * 1024 * 1024;

/**
 * With no STUN server there is nothing to wait for beyond the host candidates
 * the OS already knows, so gathering finishes in milliseconds. The timeout is
 * a stuck-state guard, not a normal path: whatever has been gathered by then
 * is sent, which on a LAN is everything that matters.
 */
export const ICE_GATHER_TIMEOUT_MS = 3_000;

/**
 * How long to wait for the channel after both sides have exchanged SDPs.
 *
 * When it expires, the two devices are not on a network that lets them talk —
 * different networks, or an access point with client isolation on. That is a
 * normal outcome, not an error to hide, and the caller turns it into an offer
 * to use the cloud path instead.
 */
export const CHANNEL_OPEN_TIMEOUT_MS = 20_000;

export class LanUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LanUnavailableError';
  }
}

/**
 * No ICE servers, deliberately.
 *
 * STUN would discover the device's public address and let the connection leave
 * the local network — turning "direct on your own Wi-Fi" into "peer-to-peer
 * across the internet", which is a different feature with different privacy
 * properties and a different failure surface. With an empty list the only
 * candidates are host ones, so this either works on the local network or does
 * not work at all, which is exactly the promise being made.
 *
 * A host candidate is not necessarily an address. Chrome, on a page that has
 * never called getUserMedia — which this app never does — replaces it with a
 * random <uuid>.local name and relies on mDNS to resolve it, so the SDP we
 * store carries no address at all. Measured, not assumed: see the note on
 * /privacy, which says the same thing and is equally careful to claim it only
 * for the browser it was checked in.
 *
 * The practical consequence is that a direct transfer needs mDNS to work
 * between the two devices. On a normal LAN it does. In a container it does
 * not, which is why the end-to-end test launches Chrome with
 * --disable-features=WebRtcHideLocalIpsWithMdns — a test-environment
 * workaround, and one that makes any SDP captured under it unrepresentative.
 */
export function createPeerConnection(): RTCPeerConnection {
  return new RTCPeerConnection({ iceServers: [] });
}

export function isLanSupported(): boolean {
  return typeof RTCPeerConnection !== 'undefined';
}

/**
 * Waits for gathering to finish instead of trickling candidates.
 *
 * Trickle would need a signalling message per candidate, and signalling here
 * is a poll every few seconds — so trickling would be slower than waiting, not
 * faster, and would multiply the number of session items. One complete SDP is
 * both simpler and, on this transport, quicker.
 */
export function whenGathered(pc: RTCPeerConnection, timeoutMs = ICE_GATHER_TIMEOUT_MS): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      pc.removeEventListener('icegatheringstatechange', onChange);
      clearTimeout(timer);
      resolve();
    };
    const onChange = () => {
      if (pc.iceGatheringState === 'complete') done();
    };
    const timer = setTimeout(done, timeoutMs);
    pc.addEventListener('icegatheringstatechange', onChange);
  });
}

export function whenOpen(channel: RTCDataChannel, timeoutMs = CHANNEL_OPEN_TIMEOUT_MS): Promise<void> {
  if (channel.readyState === 'open') return Promise.resolve();
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      channel.removeEventListener('open', onOpen);
      channel.removeEventListener('close', onClose);
      channel.removeEventListener('error', onClose);
      clearTimeout(timer);
    };
    const onOpen = () => {
      cleanup();
      resolve();
    };
    const onClose = () => {
      cleanup();
      reject(new LanUnavailableError('The direct connection could not be opened.'));
    };
    const timer = setTimeout(onClose, timeoutMs);
    channel.addEventListener('open', onOpen);
    channel.addEventListener('close', onClose);
    channel.addEventListener('error', onClose);
  });
}

export interface LanOffer {
  pc: RTCPeerConnection;
  channel: RTCDataChannel;
  sdp: string;
}

export async function createOffer(): Promise<LanOffer> {
  const pc = createPeerConnection();
  const channel = pc.createDataChannel('mubifiles', { ordered: true });
  channel.binaryType = 'arraybuffer';
  channel.bufferedAmountLowThreshold = LAN_LOW_WATER_BYTES;

  await pc.setLocalDescription(await pc.createOffer());
  await whenGathered(pc);
  return { pc, channel, sdp: pc.localDescription?.sdp ?? '' };
}

export interface LanAnswer {
  pc: RTCPeerConnection;
  /** Resolves when the offerer's channel arrives. */
  channel: Promise<RTCDataChannel>;
  sdp: string;
}

export async function answerOffer(offerSdp: string): Promise<LanAnswer> {
  const pc = createPeerConnection();

  const channel = new Promise<RTCDataChannel>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new LanUnavailableError('The direct connection could not be opened.')),
      CHANNEL_OPEN_TIMEOUT_MS,
    );
    pc.addEventListener('datachannel', (event) => {
      clearTimeout(timer);
      event.channel.binaryType = 'arraybuffer';
      event.channel.bufferedAmountLowThreshold = LAN_LOW_WATER_BYTES;
      resolve(event.channel);
    });
  });

  await pc.setRemoteDescription({ type: 'offer', sdp: offerSdp });
  await pc.setLocalDescription(await pc.createAnswer());
  await whenGathered(pc);
  return { pc, channel, sdp: pc.localDescription?.sdp ?? '' };
}

/**
 * The largest message this connection will carry.
 *
 * Chrome reports 256 KB and Firefox reports far more, but the value is
 * negotiated and an implementation is free to report less — sending over it
 * closes the channel rather than erroring, which would look like a network
 * fault. So the chunk size is the intended 256 KB clamped to whatever the
 * transport admits to.
 */
export function chunkSizeFor(pc: RTCPeerConnection): number {
  const max = pc.sctp?.maxMessageSize;
  return typeof max === 'number' && max > 0 ? Math.min(LAN_CHUNK_BYTES, max) : LAN_CHUNK_BYTES;
}

/* ------------------------------------------------------------------ */
/* Wire protocol                                                       */
/* ------------------------------------------------------------------ */

/**
 * Control messages are JSON strings, file bytes are binary frames. The two are
 * told apart by `typeof data === 'string'`, which is the one distinction a
 * DataChannel makes for free.
 */
type Control =
  | { t: 'begin'; name: string; size: number; contentType: string }
  | { t: 'end'; sha256: string }
  | { t: 'ack'; ok: true }
  | { t: 'ack'; ok: false; reason: string };

function drain(channel: RTCDataChannel): Promise<void> {
  if (channel.bufferedAmount <= LAN_HIGH_WATER_BYTES) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      channel.removeEventListener('bufferedamountlow', onLow);
      channel.removeEventListener('close', onClose);
    };
    const onLow = () => {
      cleanup();
      resolve();
    };
    const onClose = () => {
      cleanup();
      reject(new LanUnavailableError('The direct connection closed mid-transfer.'));
    };
    channel.addEventListener('bufferedamountlow', onLow);
    channel.addEventListener('close', onClose);
  });
}

export interface SendOptions {
  chunkSize?: number;
  onProgress?: (loaded: number) => void;
  signal?: AbortSignal;
}

/**
 * Sends one file, then waits for the receiver to say the hash matched.
 *
 * The hash is computed as the file is read, so nothing is held beyond the
 * chunk in flight — the same reason it is not a single crypto.subtle.digest.
 * Waiting for the acknowledgement matters: without it a corrupted transfer
 * would be reported as a success on the sending device and a failure only on
 * the other one.
 */
export async function sendFile(channel: RTCDataChannel, file: File, options: SendOptions = {}): Promise<void> {
  const { chunkSize = LAN_CHUNK_BYTES, onProgress, signal } = options;
  const acknowledged = nextAck(channel);

  send(channel, { t: 'begin', name: file.name, size: file.size, contentType: file.type });

  const hash = new Sha256();
  for (let offset = 0; offset < file.size; offset += chunkSize) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (channel.readyState !== 'open') {
      throw new LanUnavailableError('The direct connection closed mid-transfer.');
    }
    await drain(channel);

    const slice = new Uint8Array(await file.slice(offset, offset + chunkSize).arrayBuffer());
    hash.update(slice);
    // Copied into the send buffer synchronously, so reusing the slice after
    // this returns would be safe — it is not reused, but that is why the loop
    // can read the next chunk without waiting for this one to leave.
    channel.send(slice);
    onProgress?.(Math.min(file.size, offset + slice.length));
  }

  send(channel, { t: 'end', sha256: hash.digest() });

  const ack = await acknowledged;
  if (!ack.ok) throw new Error(ack.reason);
}

export interface LanReceivedFile {
  name: string;
  size: number;
  contentType: string;
  sha256: string;
  blob: Blob;
}

export interface ReceiveHandlers {
  onBegin?: (info: { name: string; size: number; contentType: string }) => void;
  onProgress?: (loaded: number) => void;
  onFile: (file: LanReceivedFile) => void;
  onError?: (error: Error) => void;
}

/**
 * Reassembles files as they arrive and verifies each against the sender's
 * hash before handing it over.
 *
 * A DataChannel is ordered and reliable, so the check is not there to catch
 * dropped packets; it is there to catch the ways a transfer can be wrong that
 * the transport cannot see — a truncated send, a file changed on disk while it
 * was being read, a bug at either end. Verifying is cheap next to the transfer
 * and is the difference between delivering a corrupt file and saying so.
 *
 * Returns a teardown function.
 */
export function receiveFiles(channel: RTCDataChannel, handlers: ReceiveHandlers): () => void {
  let current: { name: string; size: number; contentType: string } | null = null;
  let hash = new Sha256();
  let blobs: Blob[] = [];
  let pending: Uint8Array[] = [];
  let pendingBytes = 0;
  let received = 0;

  const reset = () => {
    current = null;
    hash = new Sha256();
    blobs = [];
    pending = [];
    pendingBytes = 0;
    received = 0;
  };

  const flush = () => {
    if (pending.length === 0) return;
    blobs.push(new Blob(pending as BlobPart[]));
    pending = [];
    pendingBytes = 0;
  };

  const onMessage = (event: MessageEvent) => {
    try {
      if (typeof event.data === 'string') {
        const message = JSON.parse(event.data) as Control;

        if (message.t === 'begin') {
          reset();
          current = { name: message.name, size: message.size, contentType: message.contentType };
          handlers.onBegin?.(current);
          return;
        }

        if (message.t === 'end') {
          if (!current) return;
          flush();
          const digest = hash.digest();
          // Size is checked too: a truncation that happened to be a prefix
          // would fail the hash anyway, but reporting "1.1 GB of 1.2 GB" is a
          // better explanation than "checksum mismatch".
          if (received !== current.size) {
            send(channel, {
              t: 'ack',
              ok: false,
              reason: `Only ${received} of ${current.size} bytes arrived.`,
            });
            handlers.onError?.(new Error('The transfer ended early — the file is incomplete.'));
          } else if (digest !== message.sha256) {
            send(channel, { t: 'ack', ok: false, reason: 'The file did not match its checksum.' });
            handlers.onError?.(new Error('The file arrived corrupted and was discarded.'));
          } else {
            handlers.onFile({
              ...current,
              sha256: digest,
              blob: new Blob(blobs as BlobPart[], { type: current.contentType || 'application/octet-stream' }),
            });
            send(channel, { t: 'ack', ok: true });
          }
          reset();
        }
        return;
      }

      if (!current) return;
      const chunk = new Uint8Array(event.data as ArrayBuffer);
      hash.update(chunk);
      pending.push(chunk);
      pendingBytes += chunk.length;
      received += chunk.length;
      if (pendingBytes >= RECEIVE_FLUSH_BYTES) flush();
      handlers.onProgress?.(received);
    } catch (err) {
      handlers.onError?.(err instanceof Error ? err : new Error('The direct transfer failed.'));
    }
  };

  channel.addEventListener('message', onMessage);
  return () => channel.removeEventListener('message', onMessage);
}

function send(channel: RTCDataChannel, message: Control): void {
  if (channel.readyState === 'open') channel.send(JSON.stringify(message));
}

/** The next acknowledgement the receiver sends, whichever way it goes. */
function nextAck(channel: RTCDataChannel): Promise<{ ok: true } | { ok: false; reason: string }> {
  return new Promise((resolve, reject) => {
    const onMessage = (event: MessageEvent) => {
      if (typeof event.data !== 'string') return;
      const message = JSON.parse(event.data) as Control;
      if (message.t !== 'ack') return;
      cleanup();
      resolve(message.ok ? { ok: true } : { ok: false, reason: message.reason });
    };
    const onClose = () => {
      cleanup();
      reject(new LanUnavailableError('The direct connection closed before the transfer was confirmed.'));
    };
    const cleanup = () => {
      channel.removeEventListener('message', onMessage);
      channel.removeEventListener('close', onClose);
    };
    channel.addEventListener('message', onMessage);
    channel.addEventListener('close', onClose);
  });
}
