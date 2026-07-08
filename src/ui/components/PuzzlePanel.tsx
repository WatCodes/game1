import { useGame } from '../../store/gameStore';
import { formatTime } from '../../engine/format';

// The Load Balancer: a lights-out grid. Over-loaded districts glow amber;
// tapping one sheds its load (and its neighbors', which ripples). Balance the
// whole grid — every district dark/green — to score.
export function PuzzlePanel() {
  const puzzle = useGame((s) => s.display.puzzle);
  const credits = useGame((s) => s.display.credits);
  const surgeLeft = useGame((s) => s.display.boosts.surgeLeft);
  const tapPuzzleCell = useGame((s) => s.actions.tapPuzzleCell);
  const dealNewPuzzle = useGame((s) => s.actions.dealNewPuzzle);

  const overloaded = puzzle.cells.filter(Boolean).length;

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="rounded border border-line bg-panel p-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold">{puzzle.name}</h2>
          <span className="font-mono text-xs text-volt">{credits} CR</span>
        </div>
        <p className="mt-0.5 text-xs text-ink-dim">{puzzle.flavor}</p>

        <div
          className={`mx-auto mt-3 grid w-fit gap-1.5 rounded border p-2 transition-colors ${
            puzzle.solved ? 'border-ok/50 bg-raised/40' : overloaded === 0 ? 'border-ok/40' : 'border-line'
          }`}
          style={{ gridTemplateColumns: `repeat(${puzzle.size}, minmax(0, 1fr))` }}
          role="grid"
          aria-label={`${puzzle.name}, ${puzzle.size} by ${puzzle.size}, ${overloaded} districts over-loaded`}
        >
          {puzzle.cells.map((hot, i) => (
            <button
              key={i}
              className="h-11 w-11 rounded-md border-2 transition-all active:scale-90"
              style={
                hot
                  ? { borderColor: 'var(--amber)', background: 'rgba(251,191,36,0.4)', boxShadow: '0 0 10px var(--amber-glow)' }
                  : { borderColor: 'var(--ok)', background: 'rgba(52,211,153,0.28)' }
              }
              onClick={() => tapPuzzleCell(i)}
              disabled={puzzle.solved}
              aria-label={`District ${i + 1}: ${hot ? 'over-loaded' : 'balanced'}`}
            />
          ))}
        </div>

        <div className="mt-2 flex items-baseline justify-between font-mono text-[11px] text-ink-dim">
          <span>
            moves <span className={puzzle.bonusEligible ? 'text-ok' : 'text-ink'}>{puzzle.moves}</span> / par {puzzle.par}
          </span>
          <span>
            {puzzle.solved ? 'balanced!' : `${overloaded} over-loaded`} · <span className="text-volt">+{puzzle.reward} CR</span>
          </span>
        </div>

        {puzzle.solved ? (
          <button
            className="mt-3 w-full rounded border border-ok/60 px-3 py-2 text-sm font-semibold text-ok transition-colors hover:bg-raised"
            onClick={dealNewPuzzle}
          >
            ⚡ Balanced — deal a new grid
          </button>
        ) : (
          <button
            className="mt-3 w-full rounded border border-line px-3 py-1.5 text-xs text-ink-dim transition-colors hover:bg-raised hover:text-ink"
            onClick={dealNewPuzzle}
          >
            Scrap and re-deal (no reward)
          </button>
        )}
      </div>

      <div className="rounded border border-line bg-panel/60 p-3 text-xs">
        <div className="flex items-baseline justify-between">
          <span className="text-ink-dim">
            Auto-Solvers: <span className="text-ink">{puzzle.solvers}</span>
            {puzzle.solvers > 0 && <span> — one solve every {formatTime(puzzle.solveEverySeconds)}</span>}
          </span>
          <span className={surgeLeft > 0 ? 'font-mono text-volt' : 'font-mono text-ink-dim'}>
            {surgeLeft > 0 ? `SURGE ×1.5 · ${formatTime(surgeLeft)}` : 'surge offline'}
          </span>
        </div>
        {puzzle.solvers > 0 && (
          <div className="milestone-strip mt-2" aria-hidden>
            <span style={{ width: `${(puzzle.solverProgress % 1) * 100}%` }} />
          </div>
        )}
        <p className="mt-2 leading-relaxed text-ink-dim">
          Tapping a district sheds its load and ripples to its neighbors. Balance the grid to earn Credits and light a{' '}
          <span className="text-volt">×1.5 Grid Surge</span>. Auto-Solvers (in the Shop) grind boards for you — stack
          enough and the surge never goes out.
        </p>
      </div>
    </div>
  );
}
