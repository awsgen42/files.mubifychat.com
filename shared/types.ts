/**
 * Types shared between the Next.js client and the Cloudflare Worker API.
 * Keep this file free of runtime dependencies so both build targets can use it.
 */

import type { UploadedPart } from './upload';

export type { UploadedPart };

export type SessionStatus = 'waiting' | 'active' | 'closed';

/**
 * `signal` is not something a user sent — it is one end of a WebRTC handshake,
 * riding along in the session document so a direct transfer needs no separate
 * signalling service. It is filtered out of everything user-facing: the item
 * list, the item count, and the per-session item budget.
 */
export type ItemKind = 'text' | 'file' | 'signal';

/** A file item is only downloadable once its upload has been confirmed. */
export type ItemState = 'pending' | 'ready' | 'consumed';

export type ParticipantRole = 'host' | 'guest';

/** Which half of a WebRTC handshake a signal item carries. */
export type SignalRole = 'offer' | 'answer';

export interface ShareItem {
  id: string;
  kind: ItemKind;
  state: ItemState;
  /** Which participant sent it, so the UI can render "you" vs "them". */
  from: ParticipantRole;
  createdAt: number;
  /** Present for text items. */
  text?: string;
  /** Present for file items. */
  name?: string;
  size?: number;
  contentType?: string;
  /**
   * Signal items only: which half of the handshake this is. Distinct from
   * `from`, which says which participant posted it — an offer and an answer
   * are always posted by opposite participants.
   */
  role?: SignalRole;
  /** Signal items only: the session description, capped at MAX_SDP_BYTES. */
  sdp?: string;
  /** Number of completed downloads, used by one-shot mode. */
  downloads: number;
}

export interface Participant {
  role: ParticipantRole;
  joinedAt: number;
}

/** Session state as exposed to a client. Never includes participant tokens. */
export interface SessionView {
  code: string;
  status: SessionStatus;
  /** One-shot sessions expire each item after a single download. */
  oneShot: boolean;
  /** Sliding inactivity deadline, epoch ms. */
  expiresAt: number;
  /** 24h hard cap, epoch ms. */
  hardExpiresAt: number;
  participants: Participant[];
  items: ShareItem[];
  /** Bumps on every mutation so the client can cheaply detect changes. */
  version: number;
  /** The role of the requesting client. */
  you: ParticipantRole;
  limits: SessionLimits;
}

export interface SessionLimits {
  maxFileBytes: number;
  maxSessionBytes: number;
  maxItems: number;
  maxTextChars: number;
}

export interface CreateSessionResponse {
  code: string;
  token: string;
  session: SessionView;
}

export interface JoinSessionResponse {
  code: string;
  token: string;
  session: SessionView;
}

/**
 * How the client should upload the file body.
 * `presign` sends the bytes browser → R2 directly.
 * `proxy` streams them through the Worker in a single request.
 * `multipart` streams them through the Worker one part at a time, which is
 * what makes a failed upload resumable.
 *
 * `url` is always a working single-PUT endpoint, even in multipart mode. A
 * client that predates multipart ignores the mode and PUTs to it as before,
 * so the UI and the Worker can be deployed in either order without breaking
 * a session that is already open.
 */
export interface UploadTarget {
  mode: 'presign' | 'proxy' | 'multipart';
  url: string;
  headers: Record<string, string>;
  /** Multipart only: where to PUT part N, and how big each part must be. */
  partsUrl?: string;
  partSize?: number;
}

export interface CreateFileItemResponse {
  item: ShareItem;
  upload: UploadTarget;
  session: SessionView;
}

/**
 * Sent with the completion request for a multipart upload. The parts are
 * collected by the client as each one lands, so an interrupted upload can be
 * finished without re-sending what already arrived.
 */
export interface CompleteUploadRequest {
  parts?: UploadedPart[];
}

export interface ApiErrorBody {
  error: string;
  message: string;
}
