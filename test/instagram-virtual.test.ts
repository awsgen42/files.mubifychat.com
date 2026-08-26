import { describe, expect, it } from 'vitest';
import { RowOffsets, scrollToShow, windowFor } from '../lib/instagram/virtual';

describe('row offsets', () => {
  it('starts every row at its estimate', () => {
    const offsets = new RowOffsets(5, 40);
    expect(offsets.offset(0)).toBe(0);
    expect(offsets.offset(3)).toBe(120);
    expect(offsets.total()).toBe(200);
  });

  it('moves every later row when one is measured', () => {
    const offsets = new RowOffsets(5, 40);
    expect(offsets.set(1, 100)).toBe(60);
    expect(offsets.offset(1)).toBe(40);
    expect(offsets.offset(2)).toBe(140);
    expect(offsets.total()).toBe(260);
  });

  it('reports no delta when a measurement confirms the estimate', () => {
    const offsets = new RowOffsets(3, 40);
    expect(offsets.set(1, 40)).toBe(0);
  });

  it('finds the row at an offset', () => {
    const offsets = new RowOffsets(4, 40);
    offsets.set(0, 100);
    // rows now span 0-100, 100-140, 140-180, 180-220
    expect(offsets.indexAt(0)).toBe(0);
    expect(offsets.indexAt(99)).toBe(0);
    expect(offsets.indexAt(100)).toBe(1);
    expect(offsets.indexAt(179)).toBe(2);
    expect(offsets.indexAt(1e9)).toBe(3);
    expect(offsets.indexAt(-50)).toBe(0);
  });

  it('agrees with a plain prefix sum after random measurements', () => {
    // The tree is an optimisation; this is the definition it has to match.
    const n = 500;
    const offsets = new RowOffsets(n, 40);
    const plain = new Array(n).fill(40);
    let seed = 7;
    const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (let k = 0; k < 2000; k++) {
      const i = Math.floor(next() * n);
      const h = 20 + Math.floor(next() * 300);
      offsets.set(i, h);
      plain[i] = h;
    }
    let sum = 0;
    for (let i = 0; i < n; i++) {
      expect(offsets.offset(i)).toBeCloseTo(sum, 6);
      expect(offsets.indexAt(sum)).toBe(i);
      sum += plain[i];
    }
    expect(offsets.total()).toBeCloseTo(sum, 6);
  });

  it('handles an empty list', () => {
    const offsets = new RowOffsets(0, 40);
    expect(offsets.total()).toBe(0);
    expect(offsets.indexAt(100)).toBe(0);
    expect(windowFor(offsets, 0, 800)).toEqual({ start: 0, end: 0 });
  });

  it('stays fast at fifty thousand rows', () => {
    // Not a benchmark with a threshold — just proof the operations do not walk
    // the list. A prefix-sum array would make each set() O(n) and this loop
    // would be 2.5 billion writes.
    const offsets = new RowOffsets(50_000, 44);
    for (let i = 0; i < 50_000; i += 7) offsets.set(i, 60);
    expect(offsets.indexAt(offsets.offset(49_999))).toBe(49_999);
  });
});

describe('the render window', () => {
  it('covers the viewport with more below than above', () => {
    const offsets = new RowOffsets(1000, 50);
    const w = windowFor(offsets, 5000, 500);
    // Viewport covers rows 100..110.
    expect(w.start).toBe(96);
    expect(w.end).toBe(123);
  });

  it('does not run off either end', () => {
    const offsets = new RowOffsets(10, 50);
    expect(windowFor(offsets, 0, 200).start).toBe(0);
    expect(windowFor(offsets, 100_000, 200).end).toBe(10);
  });
});

describe('jumping to a message', () => {
  const offsets = new RowOffsets(1000, 50);

  it('lands the message inside the viewport, not at its top edge', () => {
    const top = scrollToShow(offsets, 500, 600);
    expect(top).toBe(offsets.offset(500) - 200);
    // Context above, and the message itself on screen.
    expect(top).toBeLessThan(offsets.offset(500));
    expect(offsets.offset(500)).toBeLessThan(top + 600);
  });

  it('clamps at the start of the thread', () => {
    expect(scrollToShow(offsets, 1, 600)).toBe(0);
  });

  it('clamps at the end of the thread', () => {
    expect(scrollToShow(offsets, 999, 600)).toBe(offsets.total() - 600);
  });

  /**
   * The control.
   *
   * A jump that goes to the wrong row is the failure mode that looks like it
   * works: the thread opens, something is highlighted, and it is not the
   * message that was searched for. Off-by-one is the likely form of it, because
   * a message's index is assigned after files are merged and the naive index is
   * its position within its own file.
   */
  it.fails('lands on the row after the one asked for', () => {
    const top = scrollToShow(offsets, 500, 600);
    expect(offsets.indexAt(top + 200)).toBe(501);
  });
});
