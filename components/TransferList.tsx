'use client';

import type { Transfer } from '@/lib/useShareSession';
import { formatBytes, formatDuration, formatSpeed } from '@/lib/format';
import { PAUSE_STOP_NOW_THRESHOLD_S } from '@/lib/tuning';
import { AlertIcon } from './Icons';
import { Button, Card } from './ui';

interface TransferListProps {
  transfers: Transfer[];
  /** Aborts the upload and releases the parts it has already sent. */
  onCancel: (itemId: string) => void;
  /** Stops at the next part boundary, keeping everything already sent. */
  onPause: (itemId: string) => void;
  /** Abandons the part in flight instead of waiting for it. */
  onStopNow: (itemId: string) => void;
  onResume: (itemId: string) => void;
  /** False once the tab has reloaded and lost the File behind the upload. */
  canResume: (itemId: string) => boolean;
}

export function TransferList({
  transfers,
  onCancel,
  onPause,
  onStopNow,
  onResume,
  canResume,
}: TransferListProps) {
  if (transfers.length === 0) return null;

  return (
    <Card>
      <h2 className="text-base font-semibold">Uploading</h2>
      <ul className="mt-3 space-y-4">
        {transfers.map((transfer) => {
          const percent = transfer.total > 0 ? Math.min(100, (transfer.loaded / transfer.total) * 100) : 0;
          return (
            <li key={transfer.itemId}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate font-medium">{transfer.name}</span>
                <div className="flex shrink-0 items-baseline gap-3">
                  <span className="tabular-nums text-muted-foreground">{Math.round(percent)}%</span>
                  {transfer.status === 'paused' && canResume(transfer.itemId) && (
                    <Button
                      variant="ghost"
                      className="px-2 py-1 text-xs"
                      onClick={() => onResume(transfer.itemId)}
                      aria-label={`Resume upload of ${transfer.name}`}
                    >
                      Resume
                    </Button>
                  )}
                  {transfer.status !== 'paused' && !transfer.error && (
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
                  {transfer.status === 'pausing' && transfer.secondsRemaining > PAUSE_STOP_NOW_THRESHOLD_S && (
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
                    onClick={() => onCancel(transfer.itemId)}
                    aria-label={`Cancel upload of ${transfer.name}`}
                  >
                    Cancel
                  </Button>
                </div>
              </div>

              <div
                className="mt-2 h-2 overflow-hidden rounded-full border border-border-contrast bg-surface-muted"
                role="progressbar"
                aria-valuenow={Math.round(percent)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Uploading ${transfer.name}`}
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
                {transfer.status === 'pausing' && <span>finishing this piece…</span>}
                {transfer.status !== 'paused' && transfer.bytesPerSecond > 0 && (
                  <span>{formatSpeed(transfer.bytesPerSecond)}</span>
                )}
                {transfer.status !== 'paused' && transfer.secondsRemaining > 0 && (
                  <span>{formatDuration(transfer.secondsRemaining)} left</span>
                )}
              </p>

              {transfer.status === 'paused' && (
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
