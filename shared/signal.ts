/**
 * WebRTC signalling, carried by the session document.
 *
 * A LAN transfer needs the two devices to exchange one SDP each before any
 * bytes can move. That exchange is the only part of a direct transfer that
 * cannot happen directly — which is exactly what the session already is: a
 * short-lived, authenticated, two-party channel both devices are polling. So
 * an offer is posted as a session item and the peer picks it up on its next
 * poll, and there is no second service to run, secure or pay for.
 *
 * Validation lives here rather than in the Worker so the client can reject a
 * malformed SDP before spending a request on it, and so the cap has one home.
 */

import type { ShareItem, SignalRole } from './types';

export type { SignalRole };

/** Items a person actually shared — everything the UI counts and lists. */
export function isUserItem(item: ShareItem): boolean {
  return item.kind !== 'signal';
}

export function isSignalItem(item: ShareItem): boolean {
  return item.kind === 'signal';
}

/**
 * Hard cap on a single SDP, in UTF-8 bytes.
 *
 * A LAN-only SDP is small: no STUN or TURN candidates, just host candidates
 * for the interfaces the device actually has. A few hundred bytes of session
 * description plus roughly 100 bytes per candidate puts a realistic worst case
 * — a machine with a dozen interfaces — near 2 KB. 8 KB is generous room above
 * that and still small enough that two of them cannot meaningfully grow the
 * session document, which is read back out of KV on every poll.
 *
 * Measured in bytes, not characters: an SDP is ASCII in practice, but nothing
 * stops a caller sending multi-byte text in the field, and a character count
 * would then cap at three times the intended size.
 */
export const MAX_SDP_BYTES = 8 * 1024;

/**
 * Bounds the whole request body, checked before it is parsed.
 *
 * Without it the SDP cap only applies after JSON.parse has already
 * materialised whatever was sent. The margin over MAX_SDP_BYTES covers JSON
 * escaping of the SDP's newlines plus the handful of other fields.
 */
export const MAX_SIGNAL_BODY_BYTES = 2 * MAX_SDP_BYTES;

export interface SignalPayload {
  role: SignalRole;
  sdp: string;
}

export function isSignalRole(value: unknown): value is SignalRole {
  return value === 'offer' || value === 'answer';
}

export function sdpByteLength(sdp: string): number {
  return new TextEncoder().encode(sdp).length;
}

export type SignalRejection = 'role' | 'empty' | 'too_large';

/**
 * Validates a signal body. Returns the payload, or which rule it broke so the
 * caller can answer with the right status — a bad role is a 400, an oversized
 * SDP is a 413.
 */
export function parseSignal(body: {
  role?: unknown;
  sdp?: unknown;
}): { ok: true; payload: SignalPayload } | { ok: false; reason: SignalRejection } {
  if (!isSignalRole(body.role)) return { ok: false, reason: 'role' };
  if (typeof body.sdp !== 'string' || body.sdp.length === 0) return { ok: false, reason: 'empty' };
  if (sdpByteLength(body.sdp) > MAX_SDP_BYTES) return { ok: false, reason: 'too_large' };
  return { ok: true, payload: { role: body.role, sdp: body.sdp } };
}
