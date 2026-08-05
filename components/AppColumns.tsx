import type { ReactNode } from 'react';
import { cx } from './ui';

/**
 * The one two-column definition for the app area. Both the pre-session and
 * the in-session screens render through it, assigning their own cards to the
 * two slots — so there is a single grid to maintain rather than a layout per
 * state.
 *
 * Below `lg` this collapses to exactly what it replaced: one column, the same
 * gaps, the same order. Everything two-column is behind an `lg:` variant.
 *
 * `lead` is first in the DOM and therefore first on mobile, and both
 * arrangements place it on the left — so DOM order, visual order and focus
 * order agree at every width. That is the reason the rail sits on the left:
 * putting it on the right would have meant reordering, and reordering is what
 * splits what a keyboard user reaches from what a sighted user sees.
 *
 * Because the two slots are real containers, the mobile stack is just their
 * DOM order — which constrains what can go in them. Two stacked blocks can
 * only express a *contiguous* split of the mobile order, so a card cannot move
 * columns without moving in the mobile stack too.
 */
export type ColumnArrangement =
  /** Equal halves. For two choices of equal standing. */
  | 'even'
  /** A narrow reference rail beside a wider working area. */
  | 'rail-left';

interface Arrangement {
  lead: string;
  trail: string;
  /**
   * Whether the two columns form one band of equal height. True for `even`,
   * where two cards of equal standing sitting at different heights read as a
   * broken row rather than a pair; false for the rail, where a short reference
   * panel stretched to match a long working column would just be a tall empty
   * box.
   */
  equalHeight: boolean;
}

const SPANS: Record<ColumnArrangement, Arrangement> = {
  even: { lead: 'lg:col-span-6', trail: 'lg:col-span-6', equalHeight: true },
  // 5/12 is the narrowest the code panel reads well at once it stacks; below
  // that the session code itself starts to crowd the panel.
  'rail-left': { lead: 'lg:col-span-5', trail: 'lg:col-span-7', equalHeight: false },
};

interface AppColumnsProps {
  arrangement: ColumnArrangement;
  lead: ReactNode;
  trail: ReactNode;
}

export function AppColumns({ arrangement, lead, trail }: AppColumnsProps) {
  const spans = SPANS[arrangement];
  // content-start keeps cards at their natural height; without it a short
  // column stretches its cards to match the taller one. Which of those is
  // wanted depends on the arrangement — see Arrangement.equalHeight.
  const fill = spans.equalHeight ? 'content-start lg:content-stretch' : 'content-start';
  return (
    <div className="grid gap-4 sm:gap-5 lg:grid-cols-12 lg:gap-6">
      <div className={cx('grid gap-4 sm:gap-5 lg:gap-6', fill, spans.lead)}>{lead}</div>
      <div className={cx('grid gap-4 sm:gap-5 lg:gap-6', fill, spans.trail)}>{trail}</div>
    </div>
  );
}
