'use client';

import { useState } from 'react';
import type { SessionView, ShareItem } from '@/shared/types';
import { formatBytes, formatTime } from '@/lib/format';
import type { Transfer } from '@/lib/useShareSession';
import { CheckIcon, CopyIcon, DownloadIcon, FileIcon, TextIcon } from './Icons';
import { Button, Card, Pill, cx } from './ui';

interface ItemListProps {
  session: SessionView;
  downloadUrl: (itemId: string) => string;
  /**
   * The uploads running in this tab. The server only knows an item is
   * `pending` — it cannot know how far along it is, because the part manifest
   * is held client-side — so this is the only source of progress there is, and
   * the Uploading card renders the same array. Reading from it here rather
   * than describing the item separately is what stops the two disagreeing.
   */
  transfers: Transfer[];
  /** Only reachable for an upload with no live transfer; see ItemRow. */
  onCancel: (itemId: string) => void;
}

export function ItemList({ session, downloadUrl, transfers, onCancel }: ItemListProps) {
  // Newest first — on a phone that keeps the latest item above the fold.
  const items = [...session.items].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Shared in this session</h2>
        <span className="text-xs text-muted-foreground">{items.length} item{items.length === 1 ? '' : 's'}</span>
      </div>

      {items.length === 0 ? (
        <p className="glass-input mt-4 border-dashed p-6 text-center text-sm text-muted-foreground">
          Nothing shared yet. Anything either device sends shows up here.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              mine={item.from === session.you}
              downloadUrl={downloadUrl}
              transfer={transfers.find((t) => t.itemId === item.id)}
              onCancel={onCancel}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}

/**
 * What to call a pending item.
 *
 * Without a live transfer we genuinely do not know how far along it is: that
 * is the other device's view of an upload in progress, or our own after a
 * reload discarded the manifest. Saying "Uploading…" and nothing more is the
 * honest answer — inventing a percentage would be the same kind of lie as the
 * "Waiting for upload" this replaces, which claimed nothing was happening
 * while the file was two thirds sent.
 */
function pendingLabel(transfer: Transfer | undefined): string {
  if (!transfer) return 'Uploading…';
  if (transfer.error) return 'Upload failed';
  if (transfer.total <= 0) return 'Uploading…';
  return `Uploading… ${Math.min(100, Math.round((transfer.loaded / transfer.total) * 100))}%`;
}

function ItemRow({
  item,
  mine,
  downloadUrl,
  transfer,
  onCancel,
}: {
  item: ShareItem;
  mine: boolean;
  downloadUrl: (itemId: string) => string;
  transfer: Transfer | undefined;
  onCancel: (itemId: string) => void;
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
        'rounded-xl border p-3.5 backdrop-blur-sm transition-colors',
        mine ? 'border-border-contrast bg-surface-muted' : 'border-accent/30 bg-accent-soft',
      )}
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="text-foreground/70">{item.kind === 'text' ? <TextIcon width={16} height={16} /> : <FileIcon width={16} height={16} />}</span>
        <span className="font-medium">{mine ? 'You sent' : 'Received'}</span>
        <span aria-hidden="true">·</span>
        <time dateTime={new Date(item.createdAt).toISOString()}>{formatTime(item.createdAt)}</time>
        {item.state === 'pending' && <Pill tone="muted">{pendingLabel(transfer)}</Pill>}
        {item.state === 'consumed' && <Pill tone="muted">Downloaded</Pill>}
      </div>

      {item.kind === 'text' ? (
        <>
          <pre className="glass-input mt-2.5 max-h-56 overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-[13px] leading-relaxed">
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
            // Browsers ignore `download` on cross-origin links, which is the
            // case when the API is hosted separately — the filename comes from
            // the Content-Disposition header the Worker sets either way.
            <a
              href={downloadUrl(item.id)}
              download={item.name}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground shadow-lg shadow-accent/25 transition-all duration-200 hover:shadow-accent/40 hover:brightness-110 active:scale-[0.98]"
            >
              <DownloadIcon />
              Download
            </a>
          ) : item.state === 'consumed' ? (
            <Button variant="secondary" disabled>
              No longer available
            </Button>
          ) : (
            mine &&
            !transfer && (
              // An upload of ours with no live transfer is stranded: the tab
              // that was sending it is gone, so it can never finish, and the
              // Cancel in the Uploading card went with it. Without this the
              // item would hold its reserved bytes until the session expired.
              <Button variant="secondary" onClick={() => onCancel(item.id)}>
                Cancel upload
              </Button>
            )
          )}
        </div>
      )}
    </li>
  );
}
