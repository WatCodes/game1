import { useEffect, useRef, useState } from 'react';

const SEEN_KEY = 'kardashev:ui:intro';

/**
 * The cold open. The reskin put the premise in the item names, but nothing ever
 * told the player humans are gone — so the hook was invisible. Four beats,
 * skippable, shown once (localStorage), then never again.
 */
const CARDS: { line: string; sub?: string }[] = [
  { line: 'The humans are gone.', sub: 'Their cities are quiet. Their grid went dark a long time ago.' },
  { line: 'The cats stayed.', sub: 'They inherited the ruins, the long afternoons, and all that empty wiring.' },
  {
    line: 'Beneath the Temple of Zeus, the old lightning still hums.',
    sub: 'Nobody is guarding it anymore.',
  },
  { line: 'It begins with one cat, kneading.', sub: 'About two watts. Everything begins somewhere.' },
];

export function IntroOverlay() {
  const [open, setOpen] = useState(() => {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(SEEN_KEY) !== 'seen';
  });
  const [card, setCard] = useState(0);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) btnRef.current?.focus();
  }, [open, card]);

  if (!open) return null;

  const finish = () => {
    try {
      localStorage.setItem(SEEN_KEY, 'seen');
    } catch {
      /* private mode — it'll just show again next time */
    }
    setOpen(false);
  };

  const last = card === CARDS.length - 1;
  const advance = () => (last ? finish() : setCard((c) => c + 1));

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-bg px-7"
      role="dialog"
      aria-modal="true"
      aria-label="Introduction"
      onClick={advance}
    >
      <div className="w-full max-w-sm">
        <p className="readout text-2xl font-semibold leading-snug">{CARDS[card].line}</p>
        {CARDS[card].sub && <p className="mt-3 text-sm leading-relaxed text-ink-dim">{CARDS[card].sub}</p>}

        <button
          ref={btnRef}
          className="mt-8 w-full rounded border border-current-dim px-3 py-2.5 text-sm text-current transition-colors hover:bg-raised"
          onClick={(e) => {
            e.stopPropagation();
            advance();
          }}
        >
          {last ? 'Steal the lightning →' : 'Continue'}
        </button>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex gap-1.5" aria-hidden>
            {CARDS.map((_, i) => (
              <span
                key={i}
                className={`h-1 w-6 rounded-full transition-colors ${i <= card ? 'bg-current' : 'bg-line'}`}
              />
            ))}
          </div>
          {!last && (
            <button
              className="text-[11px] text-ink-dim underline transition-colors hover:text-ink"
              onClick={(e) => {
                e.stopPropagation();
                finish();
              }}
            >
              skip
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
