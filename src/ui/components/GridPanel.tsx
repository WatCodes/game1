import { useState } from 'react';
import { useGame } from '../../store/gameStore';
import { formatPower, formatShort, formatUnit } from '../../engine/format';

// Plain-language effect per lane — shown on the button (no hover on mobile).
const LANE_EFFECT: Record<string, string> = {
  v: 'raises cap + cuts loss',
  a: 'raises cap',
  r: 'cuts loss',
};

const LANE_UNIT: Record<string, string> = { v: 'V', a: 'A', r: 'Ω' };

/**
 * The delivery bottleneck (Egg Inc's "which number is red"): generation must
 * fit through the V×A transmission cap and survive line losses.
 */
export function GridPanel() {
  const grid = useGame((s) => s.display.grid);
  const pps = useGame((s) => s.display.pps);
  const buyGridLane = useGame((s) => s.actions.buyGridLane);
  const [showHelp, setShowHelp] = useState(false);

  const congested = grid.binding === 'transmission';
  const capPct = Math.min(100, (grid.generation / grid.cap) * 100);

  return (
    <div className={`rounded border bg-panel px-3 py-2 ${congested ? 'border-volt-dim' : 'border-line'}`}>
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] uppercase tracking-widest text-ink-dim">
          Transmission
          <button
            className="ml-1.5 rounded-full border border-line px-1 text-[9px] text-ink-dim hover:text-ink"
            onClick={() => setShowHelp((v) => !v)}
            aria-label="How transmission works"
          >
            ?
          </button>
        </span>
        <span className="font-mono text-[11px]">
          <span className="text-current">{formatUnit(grid.volts, 'V')}</span>
          <span className="text-ink-dim"> · </span>
          <span className="text-current">{formatUnit(grid.amps, 'A')}</span>
          <span className="text-ink-dim"> · loss </span>
          <span className={grid.lossFrac > 0.05 ? 'text-danger' : 'text-ok'}>{(grid.lossFrac * 100).toFixed(1)}%</span>
        </span>
      </div>

      {showHelp && (
        <p className="mt-1.5 rounded bg-raised/60 px-2 py-1.5 text-[10px] leading-relaxed text-ink-dim">
          Your grid can only carry <span className="text-current">Volts × Amps</span> of power. Anything you generate
          above that cap is stranded, and line losses waste a slice of the rest. Buy <span className="text-ink">transformers</span> (more
          volts — also cuts loss) and <span className="text-ink">conductors</span> (more amps) to raise the cap, and{' '}
          <span className="text-ink">superconductors</span> to cut loss.
        </p>
      )}

      {/* load bar: generation vs carrying capacity */}
      <div className="milestone-strip mt-2" aria-hidden>
        <span style={{ width: `${capPct}%`, background: congested ? 'var(--amber)' : undefined }} />
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10px]">
        <span className="text-ink-dim">
          gen <span className="text-ink">{formatPower(grid.generation)}</span>/s → delivered{' '}
          <span className="text-volt">{formatPower(pps)}</span>/s
        </span>
        <span className={congested ? 'text-volt' : 'text-ink-dim'}>
          {congested ? '⚠ GRID CONGESTED' : `cap ${formatPower(grid.cap)}/s`}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {grid.lanes.map((l) => (
          <button
            key={l.lane}
            className={`rounded border px-1.5 py-1 text-left font-mono text-[10px] leading-tight transition-colors ${
              l.affordable
                ? congested && l.lane !== 'r'
                  ? 'border-volt text-volt hover:bg-raised'
                  : 'border-current-dim text-current hover:bg-raised'
                : 'border-line text-ink-dim cursor-not-allowed'
            }`}
            disabled={!l.affordable}
            onClick={() => buyGridLane(l.lane)}
          >
            {l.name} <span className="text-ink-dim">L{l.level}</span>
            <br />
            <span className="text-[9px] text-ink-dim">{LANE_EFFECT[l.lane]}</span>
            <br />
            <span className="text-ink-dim">
              {LANE_UNIT[l.lane]}↑ {formatShort(l.cost)} CR
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
