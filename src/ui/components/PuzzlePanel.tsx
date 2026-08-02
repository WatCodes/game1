import { useGame } from '../../store/gameStore';
import { formatTime } from '../../engine/format';

const LESS_THAN = 1;

/**
 * The Works — Feeder Balance.
 *
 * The board is laid out on an interleaved grid: 2N-1 tracks each way, where the
 * even tracks are cells and the odd ones are thin lanes holding the inequality
 * marks. Drawing the marks *between* cells rather than inside them is the whole
 * reason for the extra tracks — a mark crammed into the corner of the tile it
 * constrains reads as decoration rather than as a rule about a pair.
 *
 * Tiles keep the previous treatment (10px radius, amber when carrying load) so
 * the panel still belongs to the rest of the game after the mechanic change,
 * and stay grid fractions rather than fixed px because the board reaches 7×7.
 */
export function PuzzlePanel() {
  const puzzle = useGame((s) => s.display.puzzle);
  const surgeLeft = useGame((s) => s.display.boosts.surgeLeft);
  const tapPuzzleCell = useGame((s) => s.actions.tapPuzzleCell);
  const dealNewPuzzle = useGame((s) => s.actions.dealNewPuzzle);

  const { size } = puzzle;
  const conflicts = new Set(puzzle.conflicts);
  const blanks = puzzle.cells.filter((v, i) => v === 0 && !puzzle.givens[i]).length;

  // 1fr per cell, a narrow lane between each pair, both axes.
  const tracks = Array.from({ length: size * 2 - 1 }, (_, i) => (i % 2 === 0 ? 'minmax(0,1fr)' : '13px')).join(' ');

  return (
    <div className="flex flex-col gap-3 px-4 py-3.5">
      <p className="text-center font-body text-[11.5px] italic text-ink-dim">{puzzle.flavor}</p>

      <div
        className="mx-auto grid w-full max-w-[320px]"
        style={{ gridTemplateColumns: tracks, gridTemplateRows: tracks }}
        role="grid"
        aria-label={`${puzzle.name}, ${size} by ${size}, ${blanks} feeders unset`}
      >
        {puzzle.cells.map((value, i) => {
          const r = Math.floor(i / size);
          const c = i % size;
          const given = puzzle.givens[i];
          const bad = conflicts.has(i);

          return (
            <button
              key={`c${i}`}
              className="flex aspect-square items-center justify-center rounded-[10px] font-mono text-[15px] font-semibold transition-all active:scale-90"
              style={{
                gridRow: r * 2 + 1,
                gridColumn: c * 2 + 1,
                // Three states, distinct at a glance: a given is furniture
                // (solid, dim, unclickable), a conflict is loud, and a normal
                // filled cell is the amber the rest of the game already uses.
                background: bad
                  ? 'rgba(191,90,62,.16)'
                  : !given && value
                    ? 'rgba(184,137,47,.16)'
                    : 'var(--bg-raised)',
                border: `1.5px solid ${
                  bad ? 'var(--danger)' : !given && value ? 'var(--amber)' : 'var(--grid-line)'
                }`,
                color: bad ? 'var(--danger)' : given ? 'var(--text-dim)' : 'var(--amber)',
                boxShadow: !bad && !given && value ? '0 0 10px rgba(184,137,47,.35)' : undefined,
                opacity: given ? 0.85 : 1,
              }}
              onClick={() => tapPuzzleCell(i)}
              disabled={puzzle.solved || given}
              aria-label={
                `Feeder row ${r + 1} column ${c + 1}: ` +
                (value === 0 ? 'unset' : `load ${value}`) +
                (given ? ', fixed' : '') +
                (bad ? ', conflicting' : '')
              }
            >
              {value === 0 ? '' : value}
            </button>
          );
        })}

        {/* Horizontal marks: the lane between (r,c) and (r,c+1). */}
        {puzzle.across.map((clue, k) => {
          if (!clue) return null;
          const r = Math.floor(k / (size - 1));
          const c = k % (size - 1);
          return (
            <span
              key={`a${k}`}
              className="flex select-none items-center justify-center font-mono text-[12px] leading-none text-ink-dim"
              style={{ gridRow: r * 2 + 1, gridColumn: c * 2 + 2 }}
              aria-hidden
            >
              {clue === LESS_THAN ? '<' : '>'}
            </span>
          );
        })}

        {/* Vertical marks: the opening faces the larger of the pair, exactly as
            the horizontal ones do, so both read as one notation. */}
        {puzzle.down.map((clue, k) => {
          if (!clue) return null;
          const r = Math.floor(k / size);
          const c = k % size;
          return (
            <span
              key={`d${k}`}
              className="flex select-none items-center justify-center font-mono text-[12px] leading-none text-ink-dim"
              style={{ gridRow: r * 2 + 2, gridColumn: c * 2 + 1 }}
              aria-hidden
            >
              {clue === LESS_THAN ? '∧' : '∨'}
            </span>
          );
        })}
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
          BALANCED — DEAL A NEW BOARD
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
        {/* The one place the rule is stated plainly. Skin flavour only hints at
            it; this is what a stuck player actually reads. */}
        <p className="mt-2 font-body text-[10.5px] leading-snug text-ink-dim">
          Tap a feeder to cycle its load. Every row and column carries each level 1–{size} exactly once, and a mark
          between two feeders opens toward the one drawing more. Fill the board to earn Credits and light the Grid
          Surge.
        </p>
      </div>
    </div>
  );
}
