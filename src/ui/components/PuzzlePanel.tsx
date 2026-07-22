import { useGame } from '../../store/gameStore';
import { formatTime } from '../../engine/format';

/**
 * The Works (design 6a). The mockup drew a circuit-rotation board; the shipped
 * mechanic is the lights-out Load Balancer, so this takes the *treatment* —
 * 10px tiles, gold-tinted and glowing when over-loaded, white and quiet when
 * settled — with the moves / reward / surge meta row underneath.
 *
 * Tiles are grid fractions rather than the mockup's fixed 58px, because the
 * board grows to 7×7 at higher tiers and would overflow the panel.
 */
export function PuzzlePanel() {
  const puzzle = useGame((s) => s.display.puzzle);
  const surgeLeft = useGame((s) => s.display.boosts.surgeLeft);
  const tapPuzzleCell = useGame((s) => s.actions.tapPuzzleCell);
  const dealNewPuzzle = useGame((s) => s.actions.dealNewPuzzle);

  const overloaded = puzzle.cells.filter(Boolean).length;

  return (
    <div className="flex flex-col gap-3 px-4 py-3.5">
      <p className="text-center font-body text-[11.5px] italic text-ink-dim">{puzzle.flavor}</p>

      <div
        className="mx-auto grid w-full max-w-[300px] gap-1.5"
        style={{ gridTemplateColumns: `repeat(${puzzle.size}, minmax(0, 1fr))` }}
        role="grid"
        aria-label={`${puzzle.name}, ${overloaded} districts over-loaded`}
      >
        {puzzle.cells.map((hot, i) => (
          <button
            key={i}
            className="flex aspect-square items-center justify-center rounded-[10px] transition-all active:scale-90"
            style={
              hot
                ? {
                    background: 'rgba(184,137,47,.16)',
                    border: '1.5px solid var(--amber)',
                    boxShadow: '0 0 10px rgba(184,137,47,.4)',
                  }
                : { background: 'var(--bg-raised)', border: '1.5px solid var(--grid-line)' }
            }
            onClick={() => tapPuzzleCell(i)}
            disabled={puzzle.solved}
            aria-label={`District ${i + 1}: ${hot ? 'over-loaded' : 'balanced'}`}
          >
            {/* Deep gold, not the light gradient — on a gold-tinted tile the
                pale fill all but disappears. */}
            {hot && (
              <span
                className="bolt-shape flick block h-5 w-3"
                style={{ background: 'linear-gradient(var(--amber), var(--gold-deep))' }}
              />
            )}
          </button>
        ))}
      </div>

      {/* moves · reward · surge */}
      <div className="flex items-center justify-between font-mono text-[10px]">
        <span className="text-ink-dim">
          MOVES <b className={puzzle.bonusEligible ? 'text-ok' : 'text-ink'}>{puzzle.moves}</b> / {puzzle.par}
        </span>
        <span
          className="rounded-full px-2.5 py-1 font-semibold"
          style={{ background: 'rgba(184,137,47,.14)', border: '1px solid rgba(184,137,47,.4)', color: 'var(--amber)' }}
        >
          +{puzzle.reward} CR ON SOLVE
        </span>
        <span style={{ color: surgeLeft > 0 ? 'var(--danger)' : 'var(--text-dim)' }}>
          {surgeLeft > 0 ? `SURGE · ${formatTime(surgeLeft)}` : 'NO SURGE'}
        </span>
      </div>

      {puzzle.solved ? (
        <button
          className="w-full rounded-[13px] py-2.5 font-display text-[13px] font-bold transition-opacity hover:opacity-90"
          style={{
            background: 'linear-gradient(var(--gold-lit), var(--gold-deep))',
            color: '#2c2318',
            letterSpacing: '.16em',
            boxShadow: '0 6px 16px -6px rgba(169,120,31,.8)',
          }}
          onClick={dealNewPuzzle}
        >
          BALANCED — DEAL A NEW GRID
        </button>
      ) : (
        <button
          className="w-full rounded-[11px] border border-line py-2 font-mono text-[11px] text-ink-dim transition-colors hover:text-ink"
          onClick={dealNewPuzzle}
        >
          Scrap and re-deal — no reward
        </button>
      )}

      <div className="rounded-xl border border-line bg-raised px-3.5 py-3">
        <div className="flex items-baseline justify-between font-mono text-[10px]">
          <span className="text-ink-dim">
            AUTO-SOLVERS <b className="text-ink">{puzzle.solvers}</b>
          </span>
          {puzzle.solvers > 0 && <span className="text-ink-dim">one every {formatTime(puzzle.solveEverySeconds)}</span>}
        </div>
        {puzzle.solvers > 0 && (
          <div className="milestone-strip mt-2" aria-hidden>
            <span style={{ width: `${(puzzle.solverProgress % 1) * 100}%` }} />
          </div>
        )}
        <p className="mt-2 font-body text-[10.5px] leading-snug text-ink-dim">
          Tap a district to shed its load — it ripples to the neighbours. Settle them all to earn Credits and light the
          Grid Surge.
        </p>
      </div>
    </div>
  );
}
