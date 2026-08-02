import { useState } from 'react';

const SEEN_KEY = 'kardashev:ui:works-coach';

function alreadySeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    // Private browsing or a wedged storage quota. Showing the coach again is a
    // far smaller failure than throwing inside a panel, so fail open.
    return false;
  }
}

/**
 * First-run coach for the Works.
 *
 * Lights Out needed no explanation — one tap taught it. Feeder Balance has a
 * real cold start: a first-time player facing a part-filled board with a couple
 * of marks does not know where to begin, and the fix for that is teaching, not
 * a hint button that hands over an answer and leaves them just as lost on the
 * next board.
 *
 * So this states the two rules concretely, once, and gets out of the way. It is
 * dismissible, never returns, and gives nothing away about the board in front
 * of the player — it cannot be farmed and does not touch the economy.
 *
 * Stored in localStorage rather than the save, matching IntroOverlay: it is a
 * property of this install's UI, not of the run. Exporting a save and importing
 * it on a new device should not re-teach you, and hard-resetting should not
 * either.
 */
export function PuzzleCoach({ size }: { size: number }) {
  const [dismissed, setDismissed] = useState(alreadySeen);
  if (dismissed) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      // Non-fatal: the coach simply reappears next session.
    }
    setDismissed(true);
  };

  return (
    <div className="rounded-xl border px-3.5 py-3" style={{ borderColor: 'var(--amber)', background: 'rgba(184,137,47,.08)' }}>
      <h3 className="font-display text-[12px] font-semibold" style={{ letterSpacing: '.08em' }}>
        HOW A BOARD WORKS
      </h3>
      <ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-4 font-body text-[11px] leading-snug text-ink-dim">
        <li>
          Every row and every column carries each load from <b>1 to {size}</b> — once each, no repeats.
        </li>
        <li>
          A <span className="font-mono text-ink">&lt;</span> or <span className="font-mono text-ink">&gt;</span> between
          two feeders opens toward the one drawing <b>more</b>. Same for{' '}
          <span className="font-mono text-ink">∧</span> and <span className="font-mono text-ink">∨</span> going down.
        </li>
        <li>Tap a feeder to cycle its load. Anything that clashes turns red, so you can always back out.</li>
      </ol>
      <p className="mt-2 font-body text-[10.5px] italic leading-snug text-ink-dim">
        Start where a row is nearly full, or at a mark next to a 1 or a {size} — those have only one answer.
      </p>
      <button
        className="mt-2.5 w-full rounded-[11px] border border-line py-1.5 font-mono text-[11px] text-ink-dim transition-colors hover:bg-raised hover:text-ink"
        onClick={dismiss}
      >
        Got it
      </button>
    </div>
  );
}
