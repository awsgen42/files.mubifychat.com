import type { ParticipantRole, SessionStatus, SessionView, ShareItem } from '../shared/types';
import type { Config, Env } from './env';
import { generateCode, hashToken, randomId, randomToken, timingSafeEqual } from './ids';

/** Item as persisted. None of these fields are ever sent to clients. */
export interface StoredItem extends ShareItem {
  key?: string;
  /**
   * Set while a multipart upload is in flight, cleared once it completes.
   * Held server-side rather than accepted from the client so one participant
   * cannot drive — or abort — another's upload. Its presence is also what
   * tells the cleanup paths there are parts to abort: parts of an incomplete
   * upload are invisible to R2's list(), so nothing else can find them.
   */
  uploadId?: string;
  partSize?: number;
}

export interface StoredParticipant {
  role: ParticipantRole;
  joinedAt: number;
  tokenHash: string;
}

export interface StoredSession {
  /** Stable id used as the R2 prefix, so a recycled code can't reach old files. */
  id: string;
  code: string;
  status: SessionStatus;
  oneShot: boolean;
  createdAt: number;
  lastActivity: number;
  hardExpiresAt: number;
  version: number;
  bytesUsed: number;
  participants: StoredParticipant[];
  items: StoredItem[];
}

const KEY_PREFIX = 'session:';
const ID_INDEX_PREFIX = 'sid:';
/** KV rejects TTLs below 60 seconds. */
const MIN_KV_TTL = 60;

export function sessionKey(code: string): string {
  return `${KEY_PREFIX}${code}`;
}

/**
 * Reverse index from the R2 key prefix back to a live session. R2 objects are
 * stored under `sessions/<id>/`, but KV is keyed by code, so the cleanup job
 * needs this to tell an orphaned object from a live one.
 */
export function sessionIdKey(sessionId: string): string {
  return `${ID_INDEX_PREFIX}${sessionId}`;
}

export function sessionIdFromObjectKey(key: string): string {
  return key.split('/')[1] ?? '';
}

export function objectKey(session: StoredSession, itemId: string): string {
  return `sessions/${session.id}/${itemId}`;
}

/**
 * Seconds the session should survive in KV: the sliding idle window, capped by
 * whatever remains of the 24h hard limit.
 */
export function ttlSeconds(session: StoredSession, config: Config, now: number): number {
  const untilHardExpiry = Math.ceil((session.hardExpiresAt - now) / 1000);
  return Math.max(MIN_KV_TTL, Math.min(config.idleTtlSeconds, untilHardExpiry));
}

export function idleExpiresAt(session: StoredSession, config: Config): number {
  return Math.min(session.lastActivity + config.idleTtlSeconds * 1000, session.hardExpiresAt);
}

export function isExpired(session: StoredSession, config: Config, now: number): boolean {
  return session.status === 'closed' || now >= idleExpiresAt(session, config);
}

export async function loadSession(env: Env, code: string): Promise<StoredSession | null> {
  const raw = await env.SESSIONS.get(sessionKey(code), 'json');
  return (raw as StoredSession | null) ?? null;
}

export async function saveSession(env: Env, session: StoredSession, config: Config, now: number): Promise<void> {
  const expirationTtl = ttlSeconds(session, config, now);
  await Promise.all([
    env.SESSIONS.put(sessionKey(session.code), JSON.stringify(session), { expirationTtl }),
    env.SESSIONS.put(sessionIdKey(session.id), session.code, { expirationTtl }),
  ]);
}

export async function deleteSession(env: Env, session: StoredSession): Promise<void> {
  await Promise.all([
    env.SESSIONS.delete(sessionKey(session.code)),
    env.SESSIONS.delete(sessionIdKey(session.id)),
  ]);
}

/** Any send or fetch slides the expiry window forward. */
export function touch(session: StoredSession, now: number): void {
  session.lastActivity = now;
  session.version += 1;
}

export interface NewSession {
  session: StoredSession;
  token: string;
}

/**
 * Creates a session under an unused code. Collisions are vanishingly rare but
 * cheap to retry, and silently reusing a live code would cross two sessions'
 * files over.
 */
export async function createSession(
  env: Env,
  config: Config,
  now: number,
  oneShot: boolean,
): Promise<NewSession | null> {
  const token = randomToken();
  const tokenHash = await hashToken(token);

  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateCode();
    if (await env.SESSIONS.get(sessionKey(code), 'text')) continue;

    const session: StoredSession = {
      id: randomId(16),
      code,
      status: 'waiting',
      oneShot,
      createdAt: now,
      lastActivity: now,
      hardExpiresAt: now + config.maxTtlSeconds * 1000,
      version: 1,
      bytesUsed: 0,
      participants: [{ role: 'host', joinedAt: now, tokenHash }],
      items: [],
    };
    await saveSession(env, session, config, now);
    return { session, token };
  }
  return null;
}

/** Adds the guest participant and flips the session to `active`. */
export async function joinSession(session: StoredSession, now: number): Promise<string> {
  const token = randomToken();
  session.participants = [
    ...session.participants.filter((p) => p.role !== 'guest'),
    { role: 'guest', joinedAt: now, tokenHash: await hashToken(token) },
  ];
  session.status = 'active';
  touch(session, now);
  return token;
}

export async function authenticate(session: StoredSession, token: string | null): Promise<ParticipantRole | null> {
  if (!token) return null;
  const tokenHash = await hashToken(token);
  for (const participant of session.participants) {
    if (timingSafeEqual(participant.tokenHash, tokenHash)) return participant.role;
  }
  return null;
}

export function toView(session: StoredSession, config: Config, you: ParticipantRole): SessionView {
  return {
    code: session.code,
    status: session.status,
    oneShot: session.oneShot,
    expiresAt: idleExpiresAt(session, config),
    hardExpiresAt: session.hardExpiresAt,
    version: session.version,
    you,
    participants: session.participants.map((p) => ({ role: p.role, joinedAt: p.joinedAt })),
    // Strips every server-only field. Leaking uploadId would hand the other
    // participant everything needed to interfere with an upload in progress.
    items: session.items.map(({ key: _key, uploadId: _uploadId, partSize: _partSize, ...item }) => item),
    limits: {
      maxFileBytes: config.maxFileBytes,
      maxSessionBytes: config.maxSessionBytes,
      maxItems: config.maxItems,
      maxTextChars: config.maxTextChars,
    },
  };
}
