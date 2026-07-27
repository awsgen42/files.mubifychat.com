'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  // Kept solid rather than translucent: this is the one element that must stay
  // legible against whatever colour drifts behind it.
  primary:
    'bg-accent text-accent-foreground shadow-lg shadow-accent/25 hover:shadow-accent/40 hover:brightness-110 disabled:opacity-40 disabled:shadow-none',
  secondary: 'glass text-foreground hover:bg-surface-strong disabled:opacity-40',
  ghost: 'text-muted-foreground hover:text-foreground hover:bg-surface-muted disabled:opacity-40',
  danger: 'glass text-danger border-danger/30 hover:bg-danger/10 disabled:opacity-40',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = 'primary', className, children, ...props }: ButtonProps) {
  return (
    <button
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium',
        'transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100',
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
