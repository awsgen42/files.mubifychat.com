'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { STYLE_GROUPS, applyStyle, metrics, stylesInGroup } from '@/lib/stylish';
import { CheckIcon, CopyIcon } from './Icons';
import { Button, Card, cx } from './ui';

/**
 * The name every row is rendered with before anything is typed.
 *
 * The result area is not empty-then-filled: every row exists from the first
 * paint, showing this at visibility:hidden, so typing swaps text inside boxes
 * that already have their final height. Reserving with low-contrast real text
 * would be the other way to do it and is worse — it is content nobody asked
 * for, and it is the trick that puts hidden keywords on a page.
 */
const PLACEHOLDER = 'Alex';

/**
 * A number that cannot move anything, including its own digits.
 *
 * Fixed width stops the text after it sliding. Left-aligned rather than
 * right-aligned because right alignment keeps the last digit still and moves
 * the earlier ones — 3 becoming 12 shifts a glyph, which measured 0.0001.
 * Left-aligned with tabular figures, a digit position holds a digit and only
 * ever changes which one.
 */
function Num({ value, width = '3ch' }: { value: number; width?: string }) {
  return (
    <span className="inline-block text-left tabular-nums" style={{ minWidth: width }}>
      {value}
    </span>
  );
}

export function StylishNameTool() {
  const [name, setName] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const source = name.length > 0 ? name : PLACEHOLDER;

  const copy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard permission can be refused; the text is selectable either way,
      // so this fails quietly rather than throwing an error at someone who can
      // simply highlight it.
      return;
    }
    setCopied(id);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(null), 1600);
  };

  return (
    <>
      <Card>
        <label className="block">
          <span className="text-base font-semibold">Your name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            spellCheck={false}
            autoComplete="off"
            placeholder={PLACEHOLDER}
            aria-label="Your name"
            className="glass-input mt-3 min-h-12 w-full p-3 text-base outline-none placeholder:text-muted-foreground/60"
          />
        </label>
        <p className="mt-3 min-h-10 text-xs text-muted-foreground">
          Nothing is sent anywhere — the substitution happens in this page. Letters a style has no
          character for are left exactly as they are, so nothing is ever dropped or replaced with a
          box.
        </p>
      </Card>

      {STYLE_GROUPS.map((group) => (
        <Card key={group.id}>
          <h2 className="text-base font-semibold">{group.title}</h2>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{group.note}</p>

          {/* min-w-0 all the way down. A grid or flex child defaults to
              min-width:auto, which means its intrinsic content width wins:
              without these, a long styled name pushed the whole page from
              398px to 577px and everything reflowed. `truncate` on the text
              cannot help while an ancestor is allowed to grow. */}
          <ul className="mt-4 grid min-w-0 gap-3">
            {stylesInGroup(group.id).map((style) => {
              const output = applyStyle(source, style.id);
              const measured = metrics(output);
              // Whether the UTF-16 field shows is a property of the style, not
              // of what was typed. Deriving it from the measurement made the
              // field appear and disappear as you type — a layout change.
              const showUtf16 = style.group === 'plane1';
              return (
                <li key={style.id} className="glass-input min-w-0 overflow-hidden p-3">
                  <div className="flex min-w-0 items-center justify-between gap-3">
                    <p
                      className={cx(
                        'min-w-0 flex-1 truncate text-lg',
                        name.length === 0 && 'invisible',
                      )}
                    >
                      {output}
                    </p>
                    <Button
                      variant="secondary"
                      // Fixed width: "Copy" and "Copied" are different lengths,
                      // and letting the button resize shifted the whole row.
                      // Measured at 0.3444 CLS on a 390px screen before this.
                      className="min-h-11 w-[5.5rem] shrink-0 justify-center px-3 text-xs"
                      onClick={() => void copy(style.id, output)}
                      disabled={name.length === 0}
                      aria-label={`Copy ${style.name}`}
                    >
                      {copied === style.id ? (
                        <>
                          <CheckIcon width={14} height={14} />
                          Copied
                        </>
                      ) : (
                        <>
                          <CopyIcon width={14} height={14} />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                  {/* One line, always: the numbers grow with the name, and a
                      wrap to a second line is a height change under the rest
                      of the page. */}
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{style.name}</span>
                    {/* Each number in a fixed-width box. Without this the
                        glyphs after a growing number slide sideways, which is
                        a layout shift even though every box keeps its rect —
                        it measured 0.0003 and it is still a shift. */}
                    <span className="tabular-nums">
                      {' · '}
                      <Num value={measured.characters} /> characters
                      {showUtf16 && (
                        <>
                          , <Num value={measured.utf16Units} /> UTF-16 units
                        </>
                      )}
                      , <Num value={measured.utf8Bytes} width="4ch" /> bytes
                    </span>
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {style.builtFrom}
                    {style.unmapped && style.unmapped.length > 0 && (
                      <>
                        {' '}
                        Left unchanged: {[...style.unmapped].join(' ')}.
                      </>
                    )}
                  </p>
                </li>
              );
            })}
          </ul>
        </Card>
      ))}
    </>
  );
}
