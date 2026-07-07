import { useGame } from '../../store/gameStore';
import { formatPower, formatUnit } from '../../engine/format';

const LANE_DESC: Record<string, string> = {
  v: 'Voltage class — raises carried power AND cuts I²R losses',
  a: 'Ampacity — raises carried power',
  r: 'Conductivity — cuts I²R losses',
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

  const congested = grid.binding === 'transmission';
  const capPct = Math.min(100, (grid.generation / grid.cap) * 100);

  return (
    <div className={`rounded border bg-panel px-3 py-2 ${congested ? 'border-volt-dim' : 'border-line'}`}>
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] uppercase tracking-widest text-ink-dim">Transmission</span>
        <span className="font-mono text-[11px]">
          <span className="text-current">{formatUnit(grid.volts, 'V')}</span>
          <span className="text-ink-dim"> · </span>
          <span className="text-current">{formatUnit(grid.amps, 'A')}</span>
          <span className="text-ink-dim"> · loss </span>
          <span className={grid.lossFrac > 0.05 ? 'text-danger' : 'text-ok'}>{(grid.lossFrac * 100).toFixed(1)}%</span>
        </span>
      </div>

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
            title={LANE_DESC[l.lane]}
            onClick={() => buyGridLane(l.lane)}
          >
            {l.name} <span className="text-ink-dim">L{l.level}</span>
            <br />
            <span className="text-ink-dim">
              {LANE_UNIT[l.lane]}↑ {formatPower(l.cost)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
