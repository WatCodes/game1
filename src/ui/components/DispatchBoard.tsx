import { useState } from 'react';
import { useGame } from '../../store/gameStore';
import { formatPower, formatShort } from '../../engine/format';

const COLLAPSE_KEY = 'kardashev:ui:board';

/**
 * The Dispatch Board: split live generation across Sell (→ CR), Project
 * (→ megaproject), and Grid (→ demand). Two sliders share a budget; the grid
 * takes the remainder and browns out if it falls under demand.
 *
 * Collapsed by default to a one-line strip — on a phone the buy buttons are the
 * primary verb and must stay above the fold; the allocation is a set-and-adjust
 * decision, not a per-tap one.
 */
export function DispatchBoard() {
  const board = useGame((s) => s.display.board);
  const unlocks = useGame((s) => s.display.unlocks);
  const setSellPct = useGame((s) => s.actions.setSellPct);
  const setRoutePct = useGame((s) => s.actions.setRoutePct);
  const [open, setOpen] = useState(() => {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(COLLAPSE_KEY) === 'open';
  });

  const toggle = () => {
    setOpen((v) => {
      const next = !v;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? 'open' : 'closed');
      } catch {
        /* private mode — the preference just won't persist */
      }
      return next;
    });
  };

  const sell = Math.round(board.sellPct * 100);
  const proj = Math.round(board.projPct * 100);
  const grid = Math.max(0, 100 - sell - proj);

  return (
    <div className={`rounded border bg-panel ${board.browned ? 'border-danger/50' : 'border-line'}`}>
      {/* Summary strip — always visible, tap to expand */}
      <button
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="dispatch-board-body"
      >
        <span className="flex items-center gap-1.5 font-mono text-[11px]">
          <span className="text-ink-dim">⚡</span>
          <span className="text-current">sell {sell}%</span>
          {proj > 0 && <span className="text-volt">· build {proj}%</span>}
          {board.browned ? (
            <span className="font-semibold text-danger">· ⚠ BROWNOUT −{board.brownoutPct}%</span>
          ) : (
            <span className="text-ink-dim">· {board.price.toFixed(2)} CR/W</span>
          )}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="font-mono text-[11px] text-volt">
            +{formatShort(Math.round(board.creditsPerSec))} CR/s
          </span>
          <span className="text-[10px] text-ink-dim">{open ? '▾' : '▸'}</span>
        </span>
      </button>

      {open && (
        <div id="dispatch-board-body" className="border-t border-line/60 px-3 pb-3 pt-2">
          {/* stacked allocation bar */}
          <div className="flex h-2.5 overflow-hidden rounded-full border border-line" aria-hidden>
            <span className="bg-current transition-[width]" style={{ width: `${sell}%` }} />
            <span className="bg-volt transition-[width]" style={{ width: `${proj}%` }} />
            <span
              className={`transition-[width] ${board.browned ? 'bg-danger' : 'bg-ok'}`}
              style={{ width: `${grid}%` }}
            />
          </div>

          {/* Sell rail */}
          <label className="mt-2.5 block font-mono text-[11px] text-ink-dim" htmlFor="sell-slider">
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

          {/* Grid demand — only once that system exists */}
          {unlocks.gridDemand && (
            <div
              className={`mt-2.5 rounded border px-2 py-1.5 font-mono text-[10px] ${
                board.browned ? 'border-danger/50 text-danger' : 'border-line text-ink-dim'
              }`}
            >
              🔌 Grid {formatPower(board.gridSupply)}/s · needs {formatPower(board.demand)}/s
              {board.browned && <span className="ml-1 font-semibold">⚠ BROWNOUT −{board.brownoutPct}%</span>}
            </div>
          )}

          <p className="mt-2 text-[10px] leading-relaxed text-ink-dim">
            {unlocks.gridDemand
              ? 'Sell too much and the price sags; starve the grid below demand and output browns out. The rest funds the megaproject.'
              : 'Sell power for Credits, or pour it into the megaproject. Sell too much at once and the price sags.'}
          </p>
        </div>
      )}
    </div>
  );
}
