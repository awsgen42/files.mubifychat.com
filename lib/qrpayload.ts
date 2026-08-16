/**
 * What goes *inside* a QR code.
 *
 * The encoding itself is the `qrcode` package, which the session QR already
 * uses — see components/QrCode.tsx. This file is only about the strings that
 * get encoded, which is where the actual rules live: a Wi-Fi credential is a
 * particular format with particular escaping, and getting that wrong produces
 * a code that scans perfectly and then fails to join the network.
 */

export type PayloadKind = 'text' | 'url' | 'wifi';

export type WifiSecurity = 'WPA' | 'WEP' | 'nopass';

export interface WifiCredentials {
  ssid: string;
  password: string;
  security: WifiSecurity;
  /** Networks that do not broadcast their name need this set to be joinable. */
  hidden: boolean;
}

/**
 * Escapes one field of a WIFI: payload.
 *
 * The format separates fields with `;` and keys from values with `:`, so any
 * of those inside an SSID or password has to be escaped or the rest of the
 * string is parsed as something else. A network called "Cafe;Guest" is not
 * exotic, and an unescaped semicolon there silently truncates the password.
 * Backslash must go first, or it would escape the escapes added after it.
 */
export function escapeWifiField(value: string): string {
  return value.replace(/([\\;,:"])/g, '\\$1');
}

/**
 * The de-facto Wi-Fi QR format, as read by both Android and iOS cameras.
 *
 * `H:` is only emitted when the network is hidden. Some older Android parsers
 * treat the presence of `H:false` as a malformed field rather than as an
 * explicit negative, and omitting it means the same thing to everything that
 * reads it.
 */
export function buildWifiPayload({ ssid, password, security, hidden }: WifiCredentials): string {
  const parts = [`T:${security}`, `S:${escapeWifiField(ssid)}`];
  // An open network has no password field at all, not an empty one.
  if (security !== 'nopass') parts.push(`P:${escapeWifiField(password)}`);
  if (hidden) parts.push('H:true');
  return `WIFI:${parts.join(';')};;`;
}

/**
 * Adds a scheme to something that plainly wants one.
 *
 * A QR containing `example.com` opens a search on most phones rather than the
 * site, which is never what someone building a URL code wanted. Anything that
 * already carries a scheme — including mailto:, tel: and geo: — is left
 * exactly as typed.
 */
export function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (trimmed === '') return '';
  return /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export type UrlProblem = 'empty' | 'not-a-url' | null;

export function checkUrl(input: string): UrlProblem {
  if (input.trim() === '') return 'empty';
  try {
    new URL(normalizeUrl(input));
    return null;
  } catch {
    return 'not-a-url';
  }
}

/** The string that will actually be encoded, for whichever kind is selected. */
export function buildPayload(
  kind: PayloadKind,
  values: { text: string; url: string; wifi: WifiCredentials },
): string {
  switch (kind) {
    case 'text':
      return values.text;
    case 'url':
      return normalizeUrl(values.url);
    case 'wifi':
      return values.wifi.ssid.trim() === '' ? '' : buildWifiPayload(values.wifi);
  }
}

/**
 * Roughly how much a QR can hold, at the error-correction level we use.
 *
 * The real limit depends on the character set — digits pack tighter than
 * letters, which pack tighter than arbitrary bytes — so this is the byte-mode
 * figure for the largest version at level M, which is the conservative answer
 * and the one that applies to anything with punctuation or accents in it.
 */
export const MAX_PAYLOAD_BYTES = 2331;

export function payloadByteLength(payload: string): number {
  return new TextEncoder().encode(payload).length;
}

export function isTooLong(payload: string): boolean {
  return payloadByteLength(payload) > MAX_PAYLOAD_BYTES;
}
