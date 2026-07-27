/**
 * Types shared between the Next.js client and the Cloudflare Worker API.
 * Keep this file free of runtime dependencies so both build targets can use it.
 */

export type SessionStatus = 'waiting' | 'active' | 'closed';

export type ItemKind = 'text' | 'file';

/** A file item is only downloadable once its upload has been confirmed. */
export type ItemState = 'pending' | 'ready' | 'consumed';

export type ParticipantRole = 'host' | 'guest';

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
 * `presign` sends the bytes browser → R2 directly (preferred).
 * `proxy` streams them through the Worker, used when R2 S3 credentials
 * are not configured for the deployment.
 */
export interface UploadTarget {
  mode: 'presign' | 'proxy';
  url: string;
  headers: Record<string, string>;
}

export interface CreateFileItemResponse {
  item: ShareItem;
  upload: UploadTarget;
  session: SessionView;
}

export interface ApiErrorBody {
  error: string;
  message: string;
}
