import { useGame } from '../../store/gameStore';
import { formatPower } from '../../engine/format';

/** The signature element: a live meter that ticks like a real instrument. */
export function PowerMeter() {
  const power = useGame((s) => s.display.power);
  const pps = useGame((s) => s.display.pps);
  const era = useGame((s) => s.display.era);
  const scaleCopy = useGame((s) => s.display.scaleCopy);
  const kardashevLabel = useGame((s) => s.display.kardashevLabel);

  return (
    <div className="relative overflow-hidden border-b border-line bg-panel px-4 py-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] uppercase tracking-widest text-ink-dim">{era}</span>
        {kardashevLabel && (
          <span className="rounded border border-ascend/40 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-ascend">
            {kardashevLabel}
          </span>
        )}
      </div>
      <div className="mt-1 font-mono text-4xl font-semibold tabular-nums text-current" aria-live="off">
        {formatPower(power)}
      </div>
      <div className="mt-0.5 flex items-baseline justify-between font-mono text-xs text-ink-dim">
        <span>
          <span className="text-volt">+{formatPower(pps)}</span>/s
        </span>
        <span>Powering: {scaleCopy}</span>
      </div>
    </div>
  );
}
