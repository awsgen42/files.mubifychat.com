'use client';

import { useCallback, useRef, useState } from 'react';
import { formatLimit } from '@/shared/limits';
import { SendIcon, UploadIcon } from './Icons';
import { Button, Card, cx } from './ui';

interface ComposerProps {
  busy: boolean;
  /** No connection: a send would stall rather than fail cleanly. */
  offline?: boolean;
  maxFileBytes: number;
  maxTextChars: number;
  onSendText: (text: string) => void;
  onSendFiles: (files: File[]) => void;
}

export function Composer({
  busy,
  offline = false,
  maxFileBytes,
  maxTextChars,
  onSendText,
  onSendFiles,
}: ComposerProps) {
  const blocked = busy || offline;
  const [text, setText] = useState('');
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
    if (list.length > 0) onSendFiles(list);
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
              ? 'Offline — sending resumes when the connection returns'
              : `Drop files anywhere here · up to ${formatLimit(maxFileBytes)} each`}
          </p>
        </div>

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
