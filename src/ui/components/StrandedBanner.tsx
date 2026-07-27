import { useGame } from '../../store/gameStore';

/**
 * "Your grid is full" — the fix for the quietest failure in the game.
 *
 * When generation outruns the transmission cap, the headline W/s simply stops
 * moving. Nothing is broken, nothing is red, and every generator you buy is
 * wasted — a simulation of a low-attention player showed them stuck for ten
 * minutes with 60% of their output stranded, because the remedy lives inside a
 * *collapsed bottom sheet*, below the source list. The objective line names it,
 * but one small line is easy to miss when the big number looks fine.
 *
 * So this states the problem in the player's own terms (how much is being
 * thrown away) and is itself the way in — tapping it opens the sheet where the
 * Transmission lanes are. It only appears once Transmission is unlocked, since
 * before that the player has no way to act on it.
 */
export function StrandedBanner({ onOpen }: { onOpen: () => void }) {
  const grid = useGame((s) => s.display.grid);
  const unlocked = useGame((s) => s.display.unlocks.transmission);

  if (!unlocked || grid.binding !== 'transmission') return null;

  // How much of what you make never reaches the grid.
  const strandedPct = Math.round((1 - grid.cap / grid.generation) * 100);
  // Below ~5% this is just the normal overshoot you live with between upgrades —
  // "the pressure is the game". Nagging at 2% would train players to ignore it.
  if (strandedPct < 5) return null;

  return (
    <button
      className="pointer-events-auto mx-3 mt-1.5 flex w-[calc(100%-1.5rem)] items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-transform active:scale-[.99]"
      style={{ borderColor: 'var(--danger)', background: 'rgba(187,83,52,.10)' }}
      onClick={onOpen}
    >
      <span className="shrink-0 text-base leading-none" aria-hidden>
        ⚠
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-mono text-[10px] font-semibold tracking-[.16em]" style={{ color: 'var(--danger)' }}>
          GRID FULL · {strandedPct}% WASTED
        </span>
        <span className="mt-0.5 block font-body text-[11px] leading-snug text-ink-dim">
          You&rsquo;re making more power than your lines can carry. Buying generators won&rsquo;t help until you
          upgrade Transmission.
        </span>
      </span>
      <span className="shrink-0 font-mono text-[10px] font-semibold" style={{ color: 'var(--danger)' }}>
        FIX ▸
      </span>
    </button>
  );
}
