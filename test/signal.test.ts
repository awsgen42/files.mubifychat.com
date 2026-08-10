import { describe, expect, it } from 'vitest';
import {
  MAX_SDP_BYTES,
  MAX_SIGNAL_BODY_BYTES,
  isUserItem,
  parseSignal,
  sdpByteLength,
} from '../shared/signal';
import { putSignal, stripInternal, toView, userItemCount, type StoredItem, type StoredSession } from '../worker/session';
import { MAX_FILE_BYTES, MAX_SESSION_BYTES } from '../shared/limits';
import type { Config } from '../worker/env';

const config: Config = {
  idleTtlSeconds: 900,
  maxTtlSeconds: 86_400,
  maxFileBytes: MAX_FILE_BYTES,
  maxSessionBytes: MAX_SESSION_BYTES,
  maxItems: 50,
  maxTextChars: 100_000,
};

const NOW = 1_700_000_000_000;

function session(items: StoredItem[] = []): StoredSession {
  return {
    id: 'abc123',
    code: '123456',
    status: 'active',
    oneShot: false,
    createdAt: NOW,
    lastActivity: NOW,
    hardExpiresAt: NOW + config.maxTtlSeconds * 1000,
    version: 1,
    bytesUsed: 0,
    participants: [],
    items,
  };
}

function signal(overrides: Partial<StoredItem> = {}): StoredItem {
  return {
    id: 'sig1',
    kind: 'signal',
    state: 'ready',
    from: 'host',
    createdAt: NOW,
    role: 'offer',
    sdp: 'v=0\r\n',
    downloads: 0,
    ...overrides,
  };
}

describe('signal validation', () => {
  it('accepts both halves of a handshake', () => {
    for (const role of ['offer', 'answer'] as const) {
      const result = parseSignal({ role, sdp: 'v=0' });
      expect(result).toEqual({ ok: true, payload: { role, sdp: 'v=0' } });
    }
  });

  it('rejects any role that is not one of the two', () => {
    for (const role of ['candidate', '', null, undefined, 1, true, ['offer']]) {
      expect(parseSignal({ role, sdp: 'v=0' })).toEqual({ ok: false, reason: 'role' });
    }
  });

  it('rejects a missing or empty description', () => {
    for (const sdp of ['', null, undefined, 42, {}]) {
      expect(parseSignal({ role: 'offer', sdp })).toEqual({ ok: false, reason: 'empty' });
    }
  });

  it('accepts an SDP right up to the cap', () => {
    const sdp = 'a'.repeat(MAX_SDP_BYTES);
    expect(parseSignal({ role: 'offer', sdp })).toMatchObject({ ok: true });
  });

  it('rejects one byte over', () => {
    const sdp = 'a'.repeat(MAX_SDP_BYTES + 1);
    expect(parseSignal({ role: 'offer', sdp })).toEqual({ ok: false, reason: 'too_large' });
  });

  it('caps bytes rather than characters', () => {
    // Four characters, sixteen bytes. Counting characters would let a caller
    // through with three times the intended payload.
    const multiByte = '𝕄'.repeat(MAX_SDP_BYTES / 4);
    expect(sdpByteLength(multiByte)).toBe(MAX_SDP_BYTES);
    expect(multiByte.length).toBeLessThan(MAX_SDP_BYTES);

    const over = '𝕄'.repeat(MAX_SDP_BYTES / 4 + 1);
    expect(over.length).toBeLessThan(MAX_SDP_BYTES);
    expect(parseSignal({ role: 'offer', sdp: over })).toEqual({ ok: false, reason: 'too_large' });
  });

  it('leaves room for JSON escaping in the body cap', () => {
    // An SDP is all CRLF-separated lines, and every one of those becomes two
    // characters once escaped. The body bound has to sit above that or a
    // legal SDP would be refused before it was ever parsed.
    expect(MAX_SIGNAL_BODY_BYTES).toBeGreaterThanOrEqual(MAX_SDP_BYTES * 2);
  });
});

describe('signal items in the session document', () => {
  it('keeps one signal per participant per half, however many attempts are made', () => {
    const s = session();
    for (let attempt = 0; attempt < 20; attempt++) {
      putSignal(s, signal({ id: `host-offer-${attempt}`, from: 'host', role: 'offer' }));
      putSignal(s, signal({ id: `guest-answer-${attempt}`, from: 'guest', role: 'answer' }));
    }
    // Otherwise a retried handshake would grow a document that both devices
    // read out of KV on every poll.
    expect(s.items).toHaveLength(2);
    expect(s.items.map((i) => i.id)).toEqual(['host-offer-19', 'guest-answer-19']);
  });

  it('never holds more than four, even with both roles from both participants', () => {
    const s = session();
    for (const from of ['host', 'guest'] as const) {
      for (const role of ['offer', 'answer'] as const) {
        putSignal(s, signal({ id: `${from}-${role}-1`, from, role }));
        putSignal(s, signal({ id: `${from}-${role}-2`, from, role }));
      }
    }
    expect(s.items).toHaveLength(4);
  });

  it('leaves the user’s items alone', () => {
    const text: StoredItem = {
      id: 't1',
      kind: 'text',
      state: 'ready',
      from: 'host',
      createdAt: NOW,
      text: 'hello',
      downloads: 0,
    };
    const s = session([text]);
    putSignal(s, signal());
    expect(s.items).toHaveLength(2);
    expect(s.items[0]).toBe(text);
  });

  it('does not count signals against the item budget', () => {
    const s = session([signal({ id: 'a', role: 'offer' }), signal({ id: 'b', from: 'guest', role: 'answer' })]);
    // Two handshakes' worth of plumbing must not eat into what can be shared.
    expect(userItemCount(s)).toBe(0);
    expect(isUserItem(signal())).toBe(false);
  });
});

describe('what a signal item exposes', () => {
  const withInternals = (): StoredItem =>
    signal({ key: 'sessions/abc123/sig1', uploadId: 'upload-1', partSize: 1024 } as Partial<StoredItem>);

  it('carries the description the peer needs', () => {
    const stripped = stripInternal(withInternals());
    expect(stripped.sdp).toBe('v=0\r\n');
    expect(stripped.role).toBe('offer');
    expect(stripped.from).toBe('host');
  });

  it('drops every server-only field', () => {
    const stripped = stripInternal(withInternals()) as unknown as Record<string, unknown>;
    for (const field of ['key', 'uploadId', 'partSize']) {
      expect(stripped, field).not.toHaveProperty(field);
    }
  });

  it('goes through the same strip as every other kind on the way out', () => {
    // The regression this guards: a second copy of the strip that a new item
    // kind gets added to in one place and not the other.
    const view = toView(session([withInternals()]), config, 'guest');
    expect(view.items).toHaveLength(1);
    expect(view.items[0]).not.toHaveProperty('uploadId');
    expect(view.items[0].sdp).toBe('v=0\r\n');
  });
});
