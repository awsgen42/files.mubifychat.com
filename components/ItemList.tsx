'use client';

import { useState } from 'react';
import type { SessionView, ShareItem } from '@/shared/types';
import { formatBytes, formatTime } from '@/lib/format';
import { CheckIcon, CopyIcon, DownloadIcon, FileIcon, TextIcon } from './Icons';
import { Button, Card, Pill, cx } from './ui';

interface ItemListProps {
  session: SessionView;
  downloadUrl: (itemId: string) => string;
}

export function ItemList({ session, downloadUrl }: ItemListProps) {
  // Newest first — on a phone that keeps the latest item above the fold.
  const items = [...session.items].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Shared in this session</h2>
        <span className="text-xs text-muted-foreground">{items.length} item{items.length === 1 ? '' : 's'}</span>
      </div>

      {items.length === 0 ? (
        <p className="mt-4 rounded-xl bg-surface-muted p-6 text-center text-sm text-muted-foreground">
          Nothing shared yet. Anything either device sends shows up here.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <ItemRow key={item.id} item={item} mine={item.from === session.you} downloadUrl={downloadUrl} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function ItemRow({
  item,
  mine,
  downloadUrl,
}: {
  item: ShareItem;
  mine: boolean;
  downloadUrl: (itemId: string) => string;
}) {
  const [copied, setCopied] = useState(false);

  const copyText = async () => {
    if (!item.text) return;
    try {
      await navigator.clipboard.writeText(item.text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be denied; the text is selectable on screen.
    }
  };

  return (
    <li
      className={cx(
        'rounded-xl border border-border p-3.5',
        mine ? 'bg-surface-muted/60' : 'bg-accent-soft/25 border-accent/30',
      )}
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="text-foreground/70">{item.kind === 'text' ? <TextIcon width={16} height={16} /> : <FileIcon width={16} height={16} />}</span>
        <span className="font-medium">{mine ? 'You sent' : 'Received'}</span>
        <span aria-hidden="true">·</span>
        <time dateTime={new Date(item.createdAt).toISOString()}>{formatTime(item.createdAt)}</time>
        {item.state === 'pending' && <Pill tone="muted">Uploading…</Pill>}
        {item.state === 'consumed' && <Pill tone="muted">Downloaded</Pill>}
      </div>

      {item.kind === 'text' ? (
        <>
          <pre className="mt-2.5 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-surface p-3 font-mono text-[13px] leading-relaxed">
            {item.text}
          </pre>
          <Button variant="secondary" className="mt-2.5" onClick={copyText}>
            {copied ? <CheckIcon /> : <CopyIcon />}
            {copied ? 'Copied' : 'Copy text'}
          </Button>
        </>
      ) : (
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{item.name}</p>
            <p className="text-xs text-muted-foreground tabular-nums">{formatBytes(item.size ?? 0)}</p>
          </div>

          {item.state === 'ready' ? (
            <a
              href={downloadUrl(item.id)}
              download={item.name}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
            >
              <DownloadIcon />
              Download
            </a>
          ) : (
            <Button variant="secondary" disabled>
              {item.state === 'consumed' ? 'No longer available' : 'Waiting for upload'}
            </Button>
          )}
        </div>
      )}
    </li>
  );
}
