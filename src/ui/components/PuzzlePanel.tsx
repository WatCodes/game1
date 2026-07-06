import { useGame } from '../../store/gameStore';
import { formatTime } from '../../engine/format';

// Wire stubs at rot 0 for each tile kind; the whole tile is CSS-rotated so
// taps animate as a spin. Lines run from center to the edge midpoint.
const KIND_DIRS: Record<string, number[]> = {
  stub: [0],
  straight: [0, 2],
  corner: [0, 1],
  tee: [0, 1, 2],
  cross: [0, 1, 2, 3],
};

const END: [number, number][] = [
  [20, 0], // N
  [40, 20], // E
  [20, 40], // S
  [0, 20], // W
];

function TileArt({ kind, role, powered }: { kind: string; role: string; powered: boolean }) {
  const stroke = powered ? 'var(--cyan)' : 'var(--text-dim)';
  return (
    <svg viewBox="0 0 40 40" className="h-full w-full" aria-hidden>
      {KIND_DIRS[kind].map((d) => (
        <line key={d} x1={20} y1={20} x2={END[d][0]} y2={END[d][1]} stroke={stroke} strokeWidth={4.5} strokeLinecap="round" />
      ))}
      {role === 'source' && <rect x={12} y={12} width={16} height={16} rx={3} fill="var(--amber)" />}
      {role === 'sink' && <circle cx={20} cy={20} r={6} fill={powered ? 'var(--cyan)' : 'var(--bg-raised)'} stroke={stroke} strokeWidth={2} />}
      {role === 'wire' && <circle cx={20} cy={20} r={2.5} fill={stroke} />}
    </svg>
  );
}

/** The Switchyard: rotate wire tiles until every district is on the line. */
export function PuzzlePanel() {
  const puzzle = useGame((s) => s.display.puzzle);
  const credits = useGame((s) => s.display.credits);
  const surgeLeft = useGame((s) => s.display.boosts.surgeLeft);
  const rotatePuzzleTile = useGame((s) => s.actions.rotatePuzzleTile);
  const dealNewPuzzle = useGame((s) => s.actions.dealNewPuzzle);

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="rounded border border-line bg-panel p-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold">{puzzle.name}</h2>
          <span className="font-mono text-xs text-volt">{credits} CR</span>
        </div>
        <p className="mt-0.5 text-xs text-ink-dim">{puzzle.flavor}</p>

        <div
          className={`mx-auto mt-3 grid w-fit gap-1 rounded border p-1.5 transition-colors ${
            puzzle.solved ? 'border-current-dim bg-raised/40' : 'border-line'
          }`}
          style={{ gridTemplateColumns: `repeat(${puzzle.size}, minmax(0, 1fr))` }}
          role="grid"
          aria-label={`${puzzle.name} circuit, ${puzzle.size} by ${puzzle.size}`}
        >
          {puzzle.tiles.map((t, i) => (
            <button
              key={i}
              className={`h-10 w-10 rounded-sm transition-colors ${
                t.powered ? 'bg-raised' : 'bg-panel hover:bg-raised/60'
              }`}
              style={{
                transform: `rotate(${t.rot * 90}deg)`,
                transition: 'transform 150ms ease-out, background-color 200ms',
              }}
              onClick={() => rotatePuzzleTile(i)}
              disabled={puzzle.solved}
              aria-label={`${t.role} tile, ${t.powered ? 'powered' : 'unpowered'}`}
            >
              <TileArt kind={t.kind} role={t.role} powered={t.powered} />
            </button>
          ))}
        </div>

        <div className="mt-2 flex items-baseline justify-between font-mono text-[11px] text-ink-dim">
          <span>
            moves <span className={puzzle.bonusEligible ? 'text-ok' : 'text-ink'}>{puzzle.moves}</span> / par {puzzle.par}
          </span>
          <span>
            solve: <span className="text-volt">+{puzzle.reward} CR</span> + surge
          </span>
        </div>

        {puzzle.solved ? (
          <button
            className="mt-3 w-full rounded border border-current-dim px-3 py-2 text-sm font-semibold text-current transition-colors hover:bg-raised"
            onClick={dealNewPuzzle}
          >
            ⚡ Energized — deal a new circuit
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
            {puzzle.solvers > 0 && (
              <span> — one solve every {formatTime(puzzle.solveEverySeconds)}</span>
            )}
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
          Every solve pays Credits and lights a <span className="text-volt">×1.5 Grid Surge</span>. Auto-Solvers (in the
          Shop) grind circuits for you — stack enough and the surge never goes out.
        </p>
      </div>
    </div>
  );
}
