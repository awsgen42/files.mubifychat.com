'use client';

import { useCallback, useRef, useState } from 'react';
import { formatLimit } from '@/shared/limits';
import { formatBytes } from '@/lib/format';
import { LAN_SUGGEST_BYTES } from '@/lib/tuning';
import { BoltIcon, SendIcon, UploadIcon } from './Icons';
import { Button, Card, cx } from './ui';

interface ComposerProps {
  busy: boolean;
  /** No connection: a send would stall rather than fail cleanly. */
  offline?: boolean;
  maxFileBytes: number;
  maxTextChars: number;
  onSendText: (text: string) => void;
  onSendFiles: (files: File[]) => void;
  /** Device to device over the local network, bypassing R2 entirely. */
  onSendFilesDirect: (files: File[]) => void;
  /** False until a second device has joined — a direct transfer needs both. */
  canSendDirect: boolean;
}

export function Composer({
  busy,
  offline = false,
  maxFileBytes,
  maxTextChars,
  onSendText,
  onSendFiles,
  onSendFilesDirect,
  canSendDirect,
}: ComposerProps) {
  const blocked = busy || offline;
  const [text, setText] = useState('');
  /**
   * Files waiting on a choice of path.
   *
   * Only large ones land here. Anything smaller is sent the moment it is
   * picked, as it always was — a prompt costs more attention than the choice
   * is worth when the upload would be over before it was read.
   */
  const [staged, setStaged] = useState<File[] | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Drag events fire for every child element, so nesting is counted rather
  // than toggled — otherwise the highlight flickers as the pointer moves.
  const dragDepth = useRef(0);

  const submitText = useCallback(() => {
    const value = text.trim();
    if (!value || blocked) return;
    onSendText(value);
    setText('');
  }, [blocked, onSendText, text]);

  const pickFiles = (files: FileList | null) => {
    if (blocked) return;
    const list = Array.from(files ?? []);
    if (list.length === 0) return;

    // The suggestion is only made when it is actually the better option: a
    // peer is here to receive it, and the file is big enough that the transfer
    // itself is the slow part rather than the handshake.
    const worthAsking = canSendDirect && list.some((file) => file.size >= LAN_SUGGEST_BYTES);
    if (worthAsking) setStaged(list);
    else onSendFiles(list);
  };

  const sendStaged = (direct: boolean) => {
    const list = staged ?? [];
    setStaged(null);
    if (list.length > 0) (direct ? onSendFilesDirect : onSendFiles)(list);
  };

  return (
    <Card
      className={cx(
        'transition-colors',
        dragging && 'border-accent bg-accent-soft outline-2 outline-dashed outline-accent outline-offset-4',
      )}
    >
      <div
        onDragEnter={(event) => {
          event.preventDefault();
          dragDepth.current += 1;
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => {
          dragDepth.current -= 1;
          if (dragDepth.current <= 0) setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          dragDepth.current = 0;
          setDragging(false);
          pickFiles(event.dataTransfer.files);
        }}
      >
        <label htmlFor="composer-text" className="text-base font-semibold">
          Send to the other device
        </label>

        <textarea
          id="composer-text"
          value={text}
          onChange={(event) => setText(event.target.value.slice(0, maxTextChars))}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) submitText();
          }}
          rows={4}
          placeholder="Paste or type text here…"
          className="glass-input mt-3 w-full resize-y p-3 text-sm outline-none placeholder:text-muted-foreground/60"
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button onClick={submitText} disabled={blocked || text.trim().length === 0}>
            <SendIcon />
            Send text
          </Button>
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={blocked}>
            <UploadIcon />
            Choose files
          </Button>
          <p className="ml-auto text-xs text-muted-foreground">
            {offline
              ? 'Can’t reach Mubifiles — sending resumes when the connection does'
              : canSendDirect
                ? `Drop files anywhere here · up to ${formatLimit(maxFileBytes)} each · large ones can go direct`
                : `Drop files anywhere here · up to ${formatLimit(maxFileBytes)} each`}
          </p>
        </div>

        {/* Shown instead of sending immediately, and only for the case where
            the choice is real. Cloud is listed first and described first
            because it is still the default: it is the one that lets the sender
            close the tab and walk away. */}
        {staged && (
          <div className="glass-input mt-3 border-accent/30 bg-accent-soft p-3.5">
            <p className="text-sm font-medium">
              {staged.length === 1 ? staged[0].name : `${staged.length} files`} ·{' '}
              {formatBytes(staged.reduce((total, file) => total + file.size, 0))}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              That is large enough to be worth sending straight to the other device. A direct
              transfer stays on your network and is usually much faster, but both devices have to
              stay open until it finishes.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={() => sendStaged(true)} disabled={blocked}>
                <BoltIcon />
                Send directly
              </Button>
              <Button variant="secondary" onClick={() => sendStaged(false)} disabled={blocked}>
                <UploadIcon />
                Send via cloud
              </Button>
              <Button variant="ghost" onClick={() => setStaged(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          onChange={(event) => {
            pickFiles(event.target.files);
            event.target.value = '';
          }}
        />
      </div>
    </Card>
  );
}
