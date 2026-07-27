'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-foreground hover:opacity-90 disabled:opacity-50',
  secondary:
    'bg-surface-muted text-foreground border border-border hover:bg-border/50 disabled:opacity-50',
  ghost: 'text-muted-foreground hover:text-foreground hover:bg-surface-muted disabled:opacity-50',
  danger: 'text-danger border border-danger/40 hover:bg-danger/10 disabled:opacity-50',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = 'primary', className, children, ...props }: ButtonProps) {
  return (
    <button
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium',
        'transition-colors disabled:cursor-not-allowed',
        VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cx('card p-5 sm:p-6', className)}>{children}</section>;
}

export function Pill({ tone = 'muted', children }: { tone?: 'muted' | 'success' | 'accent'; children: ReactNode }) {
  const tones = {
    muted: 'bg-surface-muted text-muted-foreground',
    success: 'bg-success/15 text-success',
    accent: 'bg-accent-soft text-accent',
  } as const;
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium', tones[tone])}>
      {children}
    </span>
  );
}

/** Small pulsing dot used for "waiting" / "connected" status. */
export function StatusDot({ active }: { active: boolean }) {
  return (
    <span
      className={cx(
        'inline-block h-2 w-2 rounded-full',
        active ? 'bg-success' : 'bg-muted-foreground/60 motion-safe:animate-pulse',
      )}
    />
  );
}
