import { useGame } from '../../store/gameStore';
import { formatPower, formatShort } from '../../engine/format';

/**
 * The Dispatch Board: split live generation across Sell (→ CR), Project
 * (→ megaproject), and Grid (→ demand). Two sliders share a budget; the grid
 * takes the remainder and browns out if it falls under demand.
 */
export function DispatchBoard() {
  const board = useGame((s) => s.display.board);
  const setSellPct = useGame((s) => s.actions.setSellPct);
  const setRoutePct = useGame((s) => s.actions.setRoutePct);

  const sell = Math.round(board.sellPct * 100);
  const proj = Math.round(board.projPct * 100);
  const grid = Math.max(0, 100 - sell - proj);

  return (
    <div className="rounded border border-line bg-panel p-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Dispatch Board</h2>
        <span className="font-mono text-[11px] text-volt">
          +{formatShort(Math.round(board.creditsPerSec))} CR/s
        </span>
      </div>

      {/* stacked allocation bar */}
      <div className="mt-2 flex h-2.5 overflow-hidden rounded-full border border-line" aria-hidden>
        <span className="bg-current transition-[width]" style={{ width: `${sell}%` }} />
        <span className="bg-volt transition-[width]" style={{ width: `${proj}%` }} />
        <span className={`transition-[width] ${board.browned ? 'bg-danger' : 'bg-ok'}`} style={{ width: `${grid}%` }} />
      </div>
      <div className="mt-1 flex justify-between font-mono text-[9px] uppercase tracking-wider">
        <span className="text-current">sell {sell}%</span>
        <span className="text-volt">project {proj}%</span>
        <span className={board.browned ? 'text-danger' : 'text-ok'}>grid {grid}%</span>
      </div>

      {/* Sell rail */}
      <label className="mt-3 block font-mono text-[11px] text-ink-dim" htmlFor="sell-slider">
        🏦 Sell {sell}% at <span className="text-volt">{board.price.toFixed(2)} CR/W</span>
      </label>
      <input
        id="sell-slider"
        type="range"
        min={0}
        max={100}
        step={5}
        value={sell}
        onChange={(e) => setSellPct(Number(e.target.value) / 100)}
        className="mt-1 w-full accent-[var(--cyan)]"
      />

      {/* Project rail */}
      <label className="mt-2 block font-mono text-[11px] text-ink-dim" htmlFor="proj-slider">
        🏗️ Project {proj}% to construction
      </label>
      <input
        id="proj-slider"
        type="range"
        min={0}
        max={100}
        step={5}
        value={proj}
        onChange={(e) => setRoutePct(Number(e.target.value) / 100)}
        className="mt-1 w-full accent-[var(--amber)]"
      />

      {/* Grid demand / brownout readout */}
      <div
        className={`mt-2.5 rounded border px-2 py-1.5 font-mono text-[10px] ${
          board.browned ? 'border-danger/50 text-danger' : 'border-line text-ink-dim'
        }`}
      >
        🔌 Grid {formatPower(board.gridSupply)}/s · needs {formatPower(board.demand)}/s
        {board.browned && <span className="ml-1 font-semibold">⚠ BROWNOUT −{board.brownoutPct}%</span>}
      </div>

      <p className="mt-2 text-[10px] leading-relaxed text-ink-dim">
        Sell too much and the price sags; starve the grid below demand and output browns out. The rest funds the
        megaproject.
      </p>
    </div>
  );
}
