import { describe, expect, it } from 'vitest';
import { formatBytes, formatCode, formatCountdown, formatDuration } from '../lib/format';

describe('formatBytes', () => {
  it('scales through the units', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(15 * 1024)).toBe('15 KB');
    expect(formatBytes(100 * 1024 * 1024)).toBe('100 MB');
  });

  it('handles nonsense input without throwing', () => {
    expect(formatBytes(-1)).toBe('—');
    expect(formatBytes(Number.NaN)).toBe('—');
  });
});

describe('formatDuration', () => {
  it('renders seconds, minutes and hours', () => {
    expect(formatDuration(42)).toBe('42s');
    expect(formatDuration(185)).toBe('3m 05s');
    expect(formatDuration(3700)).toBe('1h 01m');
  });
});

describe('formatCountdown', () => {
  it('reports expiry once the deadline passes', () => {
    expect(formatCountdown(0)).toBe('expired');
    expect(formatCountdown(-5)).toBe('expired');
  });

  it('renders the remaining time', () => {
    expect(formatCountdown(45_000)).toBe('45s');
    expect(formatCountdown(14 * 60_000 + 5_000)).toBe('14m 05s');
  });
});

describe('formatCode', () => {
  it('groups the code into two triples', () => {
    expect(formatCode('012345')).toBe('012 345');
  });
});
