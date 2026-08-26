/**
 * Row offsets for a list of variable-height rows.
 *
 * A thread here can hold 50,000 messages, and rows are not a fixed height: a
 * one-word reply and a wrapped paragraph with a reaction on it are different
 * sizes, and nothing knows which until it has been laid out. So heights start
 * as an estimate and are corrected as rows are measured.
 *
 * That makes two operations hot — "where does row i start" and "which row is at
 * offset y" — and both run on every scroll frame. Recomputing a prefix sum over
 * 50,000 entries per frame is the naive version and it is visibly slow. A
 * Fenwick tree makes both O(log n) and, critically, makes correcting one row's
 * height O(log n) too, which a cached prefix-sum array does not: there, one
 * measurement invalidates every offset after it.
 *
 * Pure, and independent of React, so the ordering can be tested without a
 * browser — the jump-to-message control depends on it being right.
 */
export class RowOffsets {
  private readonly tree: Float64Array;
  private readonly heights: Float64Array;
  readonly count: number;

  constructor(count: number, estimate: number) {
    this.count = count;
    this.heights = new Float64Array(count).fill(estimate);
    // Build in O(n): each node absorbs its left child's accumulated total.
    this.tree = new Float64Array(count + 1);
    for (let i = 1; i <= count; i++) {
      this.tree[i] += estimate;
      const parent = i + (i & -i);
      if (parent <= count) this.tree[parent] += this.tree[i];
    }
  }

  /** Record a measured height. Returns the delta, so a scroll can be corrected. */
  set(index: number, height: number): number {
    if (index < 0 || index >= this.count) return 0;
    const delta = height - this.heights[index];
    if (delta === 0) return 0;
    this.heights[index] = height;
    for (let i = index + 1; i <= this.count; i += i & -i) this.tree[i] += delta;
    return delta;
  }

  heightOf(index: number): number {
    return this.heights[index] ?? 0;
  }

  /** Pixels above row `index`. offset(0) is 0; offset(count) is the total. */
  offset(index: number): number {
    let sum = 0;
    for (let i = Math.min(index, this.count); i > 0; i -= i & -i) sum += this.tree[i];
    return sum;
  }

  total(): number {
    return this.offset(this.count);
  }

  /**
   * The first row whose span contains `y`, clamped into the list.
   *
   * Descends the tree rather than binary-searching offsets, so it does not call
   * offset() log n times.
   */
  indexAt(y: number): number {
    if (y <= 0 || this.count === 0) return 0;
    let position = 0;
    let remaining = y;
    let step = 1;
    while (step * 2 <= this.count) step *= 2;
    for (; step > 0; step >>= 1) {
      const next = position + step;
      if (next <= this.count && this.tree[next] <= remaining) {
        position = next;
        remaining -= this.tree[next];
      }
    }
    return Math.min(position, this.count - 1);
  }
}

export interface Window {
  start: number;
  end: number;
}

/**
 * The rows to render for a given scroll position.
 *
 * Overscan is asymmetric on purpose: reading a conversation means scrolling
 * down, so the rows about to be needed are below. Rendering the same margin
 * above costs the same and is thrown away.
 */
export function windowFor(
  offsets: RowOffsets,
  scrollTop: number,
  viewport: number,
  overscanBefore = 4,
  overscanAfter = 12,
): Window {
  if (offsets.count === 0) return { start: 0, end: 0 };
  const first = offsets.indexAt(scrollTop);
  const last = offsets.indexAt(scrollTop + viewport);
  return {
    start: Math.max(0, first - overscanBefore),
    end: Math.min(offsets.count, last + overscanAfter + 1),
  };
}

/**
 * Where to scroll so that row `index` is visible with context around it.
 *
 * Not the top of the viewport. A search result put flush against the top edge
 * has no conversation above it, which is the entire point of jumping to a
 * message rather than showing it in a list — so it lands about a third of the
 * way down, with what came before it on screen.
 */
export function scrollToShow(offsets: RowOffsets, index: number, viewport: number): number {
  const top = offsets.offset(index);
  const target = top - viewport / 3;
  const max = Math.max(0, offsets.total() - viewport);
  return Math.max(0, Math.min(target, max));
}
