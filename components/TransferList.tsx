'use client';

import type { Transfer } from '@/lib/useShareSession';
import { formatBytes, formatDuration, formatSpeed } from '@/lib/format';
import { AlertIcon } from './Icons';
import { Card } from './ui';

export function TransferList({ transfers }: { transfers: Transfer[] }) {
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
                <span className="shrink-0 tabular-nums text-muted-foreground">{Math.round(percent)}%</span>
              </div>

              <div
                className="mt-2 h-2 overflow-hidden rounded-full bg-surface-muted"
                role="progressbar"
                aria-valuenow={Math.round(percent)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Uploading ${transfer.name}`}
              >
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-200"
                  style={{ width: `${percent}%` }}
                />
              </div>

              <p className="mt-1.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground tabular-nums">
                <span>
                  {formatBytes(transfer.loaded)} of {formatBytes(transfer.total)}
                </span>
                {transfer.bytesPerSecond > 0 && <span>{formatSpeed(transfer.bytesPerSecond)}</span>}
                {transfer.secondsRemaining > 0 && <span>{formatDuration(transfer.secondsRemaining)} left</span>}
              </p>

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
