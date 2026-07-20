import { useGame } from '../../store/gameStore';
import { formatPower } from '../../engine/format';

const LED_COUNT = 24;

/** The signature element: a live meter that ticks like a real instrument. */
export function PowerMeter() {
  const pps = useGame((s) => s.display.pps);
  const board = useGame((s) => s.display.board);
  const era = useGame((s) => s.display.era);
  const scaleCopy = useGame((s) => s.display.scaleCopy);
  const kardashevLabel = useGame((s) => s.display.kardashevLabel);
  const runPower = useGame((s) => s.display.runPower);
  const nextGlobalAt = useGame((s) => s.display.nextGlobalAt);
  const surgeLeft = useGame((s) => s.display.boosts.surgeLeft);
  const powerBoostLeft = useGame((s) => s.display.boosts.powerLeft);

  // Log-scale progress toward the next ×1.6 grid milestone (thresholds are
  // ×1000 apart, so a linear ratio would sit at zero forever).
  const prevAt = nextGlobalAt / 1000;
  const frac =
    runPower <= prevAt ? 0 : Math.min(1, Math.log(runPower / prevAt) / Math.log(1000));
  const lit = Math.floor(frac * LED_COUNT);

  return (
    <div className="relative overflow-hidden border-b border-line/60 bg-transparent px-4 pb-2.5 pt-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-ink-dim">
          <span className="live-dot" aria-hidden />
          {era}
        </span>
        {kardashevLabel && (
          <span className="rounded border border-ascend/40 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-ascend">
            {kardashevLabel}
          </span>
        )}
      </div>

      <div className="readout mt-1 text-4xl font-semibold" aria-live="off">
        {formatPower(pps)}
        <span className="ml-1 text-xl text-ink-dim">/s</span>
      </div>

      <div className="sweep-track mt-2" aria-hidden />

      <div className="mt-1.5 flex items-baseline justify-between font-mono text-xs text-ink-dim">
        <span>
          {board.browned ? (
            <span className="text-danger">⚠ BROWNOUT −{board.brownoutPct}%</span>
          ) : (
            <span className="text-current">generating</span>
          )}
          {surgeLeft > 0 && <span className="ml-1.5 text-volt">SURGE ×1.5</span>}
          {powerBoostLeft > 0 && <span className="ml-1.5 text-ok">×2</span>}
        </span>
        <span>Powering: {scaleCopy}</span>
      </div>

      <div
        className="mt-2 flex gap-[3px]"
        role="progressbar"
        aria-valuenow={Math.round(frac * 100)}
        aria-label="Progress to next grid milestone"
      >
        {Array.from({ length: LED_COUNT }, (_, i) => (
          <span key={i} className={`led ${i < lit ? 'lit' : ''} ${i < lit && i >= LED_COUNT - 4 ? 'hot' : ''}`} />
        ))}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[9px] uppercase tracking-wider text-ink-dim">
        <span>grid milestone</span>
        <span>×1.6 at {formatPower(nextGlobalAt)}</span>
      </div>
    </div>
  );
}
