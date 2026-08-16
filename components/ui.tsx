'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { BUTTON_BASE, BUTTON_DISABLED, VARIANTS, cx, type Variant } from '@/lib/styles';

export { buttonClasses, cx } from '@/lib/styles';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = 'primary', className, children, ...props }: ButtonProps) {
  return (
    <button className={cx(BUTTON_BASE, VARIANTS[variant], BUTTON_DISABLED, className)} {...props}>
      {children}
    </button>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cx('glass card p-5 sm:p-6', className)}>{children}</section>;
}

export function Pill({ tone = 'muted', children }: { tone?: 'muted' | 'success' | 'accent'; children: ReactNode }) {
  const tones = {
    muted: 'bg-surface-muted text-muted-foreground border border-border',
    success: 'bg-success/15 text-success border border-success/25',
    accent: 'bg-accent-soft text-accent border border-accent/25',
  } as const;
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium backdrop-blur-sm',
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

/** Small status dot; pulses with a halo while waiting for the other device. */
export function StatusDot({ active }: { active: boolean }) {
  return (
    <span className="relative inline-flex h-2 w-2">
      {!active && (
        <span className="absolute inline-flex h-full w-full rounded-full bg-muted-foreground/50 motion-safe:animate-ping" />
      )}
      <span
        className={cx(
          'relative inline-flex h-2 w-2 rounded-full',
          active ? 'bg-success shadow-[0_0_8px_var(--success)]' : 'bg-muted-foreground/70',
        )}
      />
    </span>
  );
}
