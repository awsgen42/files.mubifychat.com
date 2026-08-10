'use client';

import { useEffect, useMemo } from 'react';
import type { Transfer } from '@/lib/useShareSession';
import { formatBytes, formatDuration, formatSpeed } from '@/lib/format';
import { PAUSE_STOP_NOW_THRESHOLD_S } from '@/lib/tuning';
import { AlertIcon, DownloadIcon } from './Icons';
import { Button, Card, Pill } from './ui';

interface TransferListProps {
  transfers: Transfer[];
  /** Aborts the transfer; on the cloud path it also releases the parts sent. */
  onCancel: (itemId: string) => void;
  /** Stops at the next part boundary, keeping everything already sent. */
  onPause: (itemId: string) => void;
  /** Abandons the part in flight instead of waiting for it. */
  onStopNow: (itemId: string) => void;
  onResume: (itemId: string) => void;
  /** False once the tab has reloaded and lost the File behind the upload. */
  canResume: (itemId: string) => boolean;
  /** Clears a finished direct receive once it has been saved. */
  onDismiss: (itemId: string) => void;
}

/**
 * Every transfer in flight, in both directions and on both paths.
 *
 * A direct transfer has no server item behind it, so this is the only place it
 * appears — including a completed receive, which waits here to be saved
 * because the file exists nowhere else.
 */
export function TransferList({
  transfers,
  onCancel,
  onPause,
  onStopNow,
  onResume,
  canResume,
  onDismiss,
}: TransferListProps) {
  if (transfers.length === 0) return null;

  return (
    <Card>
      <h2 className="text-base font-semibold">Transfers</h2>
      <ul className="mt-3 space-y-4">
        {transfers.map((transfer) => {
          const percent = transfer.total > 0 ? Math.min(100, (transfer.loaded / transfer.total) * 100) : 0;
          const direct = transfer.via === 'lan';
          const done = Boolean(transfer.received);
          const verb = transfer.direction === 'receive' ? 'Receiving' : 'Uploading';

          return (
            <li key={transfer.itemId}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate font-medium">{transfer.name}</span>
                <div className="flex shrink-0 items-baseline gap-3">
                  {/* Worth stating: it is the difference between a transfer
                      that survives closing the tab and one that does not. */}
                  {direct && <Pill tone="muted">Direct</Pill>}
                  {!done && <span className="tabular-nums text-muted-foreground">{Math.round(percent)}%</span>}

                  {done && transfer.received && (
                    <SaveButton blob={transfer.received.blob} name={transfer.received.name} />
                  )}

                  {/* Pause is a cloud-path idea: it works by stopping between
                      parts that are already durable in R2. A direct transfer
                      has no such boundary — nothing is stored anywhere until
                      it finishes — so pausing it could only mean stalling the
                      sender, which is what cancelling already does. */}
                  {!direct && !done && transfer.status === 'paused' && canResume(transfer.itemId) && (
                    <Button
                      variant="ghost"
                      className="px-2 py-1 text-xs"
                      onClick={() => onResume(transfer.itemId)}
                      aria-label={`Resume upload of ${transfer.name}`}
                    >
                      Resume
                    </Button>
                  )}
                  {!direct && transfer.status !== 'paused' && !transfer.error && (
                    <Button
                      variant="ghost"
                      className="px-2 py-1 text-xs"
                      onClick={() => onPause(transfer.itemId)}
                      disabled={transfer.status === 'pausing'}
                      aria-label={`Pause upload of ${transfer.name}`}
                    >
                      {transfer.status === 'pausing' ? 'Pausing…' : 'Pause'}
                    </Button>
                  )}
                  {/* Only worth offering while there is enough of the current
                      piece left that waiting is a real decision. */}
                  {!direct && transfer.status === 'pausing' && transfer.secondsRemaining > PAUSE_STOP_NOW_THRESHOLD_S && (
                    <Button
                      variant="ghost"
                      className="px-2 py-1 text-xs"
                      onClick={() => onStopNow(transfer.itemId)}
                      aria-label={`Stop uploading ${transfer.name} immediately`}
                    >
                      Stop now
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    className="px-2 py-1 text-xs"
                    onClick={() => (done ? onDismiss(transfer.itemId) : onCancel(transfer.itemId))}
                    aria-label={
                      done ? `Dismiss ${transfer.name}` : `Cancel ${verb.toLowerCase()} ${transfer.name}`
                    }
                  >
                    {done ? 'Dismiss' : 'Cancel'}
                  </Button>
                </div>
              </div>

              <div
                className="mt-2 h-2 overflow-hidden rounded-full border border-border-contrast bg-surface-muted"
                role="progressbar"
                aria-valuenow={Math.round(percent)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${verb} ${transfer.name}`}
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-accent to-accent/70 shadow-[0_0_12px_var(--accent)] transition-[width] duration-200"
                  style={{ width: `${percent}%` }}
                />
              </div>

              <p className="mt-1.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground tabular-nums">
                <span>
                  {formatBytes(transfer.loaded)} of {formatBytes(transfer.total)}
                </span>
                {done && <span>Received — checksum verified</span>}
                {transfer.status === 'pausing' && <span>finishing this piece…</span>}
                {!done && transfer.status !== 'paused' && transfer.bytesPerSecond > 0 && (
                  <span>{formatSpeed(transfer.bytesPerSecond)}</span>
                )}
                {!done && transfer.status !== 'paused' && transfer.secondsRemaining > 0 && (
                  <span>{formatDuration(transfer.secondsRemaining)} left</span>
                )}
              </p>

              {done && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  This file came straight from the other device and was never uploaded, so it is only
                  here. Save it before closing this tab.
                </p>
              )}

              {!direct && transfer.status === 'paused' && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {canResume(transfer.itemId)
                    ? 'Paused — nothing already sent is lost. If you close this tab you will need to choose the same file again to carry on, but everything uploaded so far is kept either way.'
                    : 'Paused. Choose the same file again to carry on from where it stopped — everything uploaded so far is kept.'}
                </p>
              )}

              {transfer.error && (
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-danger">
                  <AlertIcon width={14} height={14} />
                  {transfer.error}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/**
 * Saves a directly-received file.
 *
 * The object URL is created once and released when the row goes away. Minting
 * it in render instead would leak one per render, and for a file this size
 * each one pins the whole blob in memory.
 */
function SaveButton({ blob, name }: { blob: Blob; name: string }) {
  const href = useMemo(() => URL.createObjectURL(blob), [blob]);
  useEffect(() => () => URL.revokeObjectURL(href), [href]);

  return (
    <a
      href={href}
      download={name}
      className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground shadow-lg shadow-accent/25 transition-all duration-200 hover:shadow-accent/40 hover:brightness-110 active:scale-[0.98]"
    >
      <DownloadIcon width={14} height={14} />
      Save
    </a>
  );
}
