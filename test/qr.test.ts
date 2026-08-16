import { describe, expect, it } from 'vitest';
import {
  MAX_PAYLOAD_BYTES,
  buildPayload,
  buildWifiPayload,
  checkUrl,
  escapeWifiField,
  isTooLong,
  normalizeUrl,
} from '../lib/qrpayload';

const wifi = (over: Partial<Parameters<typeof buildWifiPayload>[0]> = {}) =>
  buildWifiPayload({ ssid: 'MyNet', password: 'hunter2', security: 'WPA', hidden: false, ...over });

describe('Wi-Fi payloads', () => {
  it('builds the format phone cameras read', () => {
    expect(wifi()).toBe('WIFI:T:WPA;S:MyNet;P:hunter2;;');
  });

  it('omits the password entirely on an open network', () => {
    // Not an empty P: field — some parsers treat that as a password of "".
    expect(wifi({ security: 'nopass', password: 'ignored' })).toBe('WIFI:T:nopass;S:MyNet;;');
  });

  it('only marks a network hidden when it is', () => {
    expect(wifi({ hidden: true })).toContain(';H:true;');
    expect(wifi({ hidden: false })).not.toContain('H:');
  });

  it('escapes the characters that would otherwise cut the payload short', () => {
    // A network called "Cafe;Guest" is ordinary, and an unescaped semicolon
    // there ends the SSID field early and swallows the password.
    expect(escapeWifiField('Cafe;Guest')).toBe('Cafe\\;Guest');
    expect(escapeWifiField('a:b')).toBe('a\\:b');
    expect(escapeWifiField('a,b')).toBe('a\\,b');
    expect(escapeWifiField('say "hi"')).toBe('say \\"hi\\"');
  });

  it('escapes backslashes before anything else', () => {
    // The other way round, the backslash added for the semicolon would itself
    // be escaped, producing \\; — a literal backslash then a field separator.
    expect(escapeWifiField('a\\;b')).toBe('a\\\\\\;b');
  });

  it('carries an escaped password through to the payload', () => {
    expect(wifi({ password: 'p;a:ss' })).toBe('WIFI:T:WPA;S:MyNet;P:p\\;a\\:ss;;');
  });

  it('handles a password that is only special characters', () => {
    expect(wifi({ password: ';;;' })).toBe('WIFI:T:WPA;S:MyNet;P:\\;\\;\\;;;');
  });
});

describe('URLs', () => {
  it('adds https when a scheme is missing', () => {
    expect(normalizeUrl('example.com')).toBe('https://example.com');
    expect(normalizeUrl('  example.com/a?b=c  ')).toBe('https://example.com/a?b=c');
  });

  it('leaves an existing scheme alone, including the non-web ones', () => {
    for (const value of [
      'https://example.com',
      'http://example.com',
      'mailto:a@example.com',
      'tel:+441234567890',
      'geo:51.5,-0.12',
    ]) {
      expect(normalizeUrl(value)).toBe(value);
    }
  });

  it('tells an empty box from an unusable one', () => {
    expect(checkUrl('')).toBe('empty');
    expect(checkUrl('   ')).toBe('empty');
    expect(checkUrl('example.com')).toBeNull();
    expect(checkUrl('http://')).toBe('not-a-url');
  });
});

describe('choosing what to encode', () => {
  const values = {
    text: 'hello',
    url: 'example.com',
    wifi: { ssid: 'MyNet', password: 'p', security: 'WPA' as const, hidden: false },
  };

  it('encodes each kind from its own field', () => {
    expect(buildPayload('text', values)).toBe('hello');
    expect(buildPayload('url', values)).toBe('https://example.com');
    expect(buildPayload('wifi', values)).toBe('WIFI:T:WPA;S:MyNet;P:p;;');
  });

  it('produces nothing for a Wi-Fi entry with no network name', () => {
    // Rather than a payload advertising an empty SSID.
    expect(buildPayload('wifi', { ...values, wifi: { ...values.wifi, ssid: '  ' } })).toBe('');
  });
});

describe('capacity', () => {
  it('accepts a payload at the limit and rejects one past it', () => {
    expect(isTooLong('a'.repeat(MAX_PAYLOAD_BYTES))).toBe(false);
    expect(isTooLong('a'.repeat(MAX_PAYLOAD_BYTES + 1))).toBe(true);
  });

  it('counts bytes rather than characters', () => {
    // An emoji is four bytes; counting characters would accept a payload the
    // encoder then refuses, which reads as the tool being broken.
    const emoji = '🙂'.repeat(MAX_PAYLOAD_BYTES / 4);
    expect(emoji.length).toBeLessThan(MAX_PAYLOAD_BYTES);
    expect(isTooLong(emoji)).toBe(false);
    expect(isTooLong(emoji + '🙂')).toBe(true);
  });
});

/**
 * The control.
 *
 * Escaping is the part of this file that is silently wrong rather than
 * visibly broken: an unescaped semicolon produces a QR that scans perfectly
 * and joins the wrong network, or no network. This asserts the unescaped
 * output and is expected to fail, so the suite only stays green while the
 * escaping is actually being applied.
 */
describe('control: Wi-Fi escaping must actually happen', () => {
  it.fails('passes a semicolon through unescaped', () => {
    expect(wifi({ ssid: 'Cafe;Guest' })).toBe('WIFI:T:WPA;S:Cafe;Guest;P:hunter2;;');
  });
});
