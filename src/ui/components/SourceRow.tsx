import { memo } from 'react';
import { useGame, type SourceView } from '../../store/gameStore';
import { formatPower, formatShort } from '../../engine/format';

export const SourceRow = memo(function SourceRow({ src, power }: { src: SourceView; power: number }) {
  const buySource = useGame((s) => s.actions.buySource);
  const toggleAutomation = useGame((s) => s.actions.toggleAutomation);

  if (!src.unlocked) {
    return (
      <div className="striped rounded border border-line bg-panel/50 px-3 py-2 text-xs text-ink-dim">
        <span className="font-semibold">🔒 {src.name}</span> — locked. Unlock it in Research.
      </div>
    );
  }

  const producing = src.output > 0;
  const warn = src.nextUnitNet <= 0 && src.owned > 0;
  const milestoneFrac = Math.min(1, src.owned / src.nextMilestoneAt);

  return (
    <div className="relative rounded border border-line bg-panel px-3 py-2 pl-4">
      <span className={`source-rail ${warn ? 'warn' : producing ? 'on' : ''}`} aria-hidden />
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold">
          {src.name}
          {src.automated && (
            <button
              className={`ml-1.5 rounded border px-1 text-[9px] uppercase tracking-wider transition-colors ${
                src.autoPaused
                  ? 'border-line text-ink-dim hover:text-ink'
                  : 'border-ok/40 text-ok hover:bg-raised'
              }`}
              title={src.autoPaused ? 'Manager paused — tap to resume auto-buying' : 'Manager active — tap to pause auto-buying'}
              aria-pressed={!src.autoPaused}
              aria-label={`Auto-buy for ${src.name}: ${src.autoPaused ? 'paused' : 'active'}`}
              onClick={() => toggleAutomation(src.id)}
            >
              {src.autoPaused ? 'auto ⏸' : 'auto'}
            </button>
          )}
        </span>
        <span className="font-mono text-xs text-ink-dim">
          ×{formatShort(src.milestoneMult)} · <span className="text-ink">{src.owned}</span> owned
        </span>
      </div>
      <div className="mt-0.5 flex items-baseline justify-between font-mono text-[11px] text-ink-dim">
        <span>
          <span className="text-volt">+{formatPower(src.output)}/s</span>
          {src.upkeep > 0 && <span className="ml-1.5 text-danger/80">−{formatPower(src.upkeep)}/s upkeep</span>}
        </span>
        <span>
          {src.toNextMilestone} to ×2
        </span>
      </div>
      <div className="milestone-strip mt-1.5" aria-hidden>
        <span style={{ width: `${milestoneFrac * 100}%` }} />
      </div>
      {warn && (
        <p className="mt-1 font-mono text-[10px] text-danger/90">
          ⚠ next unit curtails — push to the ×2 milestone or research efficiency
        </p>
      )}
      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
        <BuyButton label="Buy 1" cost={src.cost1} gain={src.gain1} affordable={power >= src.cost1} onClick={() => buySource(src.id, 1)} />
        <BuyButton label="Buy 10" cost={src.cost10} gain={src.gain10} affordable={power >= src.cost10} onClick={() => buySource(src.id, 10)} />
        <BuyButton
          label={`Next ×2 (${src.nextCount})`}
          cost={src.nextCost}
          gain={src.gainNext}
          affordable={power >= src.nextCost}
          onClick={() => buySource(src.id, src.nextCount)}
        />
        <BuyButton
          label={`Max (${src.maxCount})`}
          cost={src.maxCount > 0 ? src.maxCost : undefined}
          gain={src.gainMax}
          affordable={src.maxCount > 0}
          accent
          onClick={() => buySource(src.id, 'max')}
        />
      </div>
    </div>
  );
});

function BuyButton({
  label,
  cost,
  gain,
  affordable,
  accent,
  onClick,
}: {
  label: string;
  cost: number | undefined;
  gain: number;
  affordable: boolean;
  accent?: boolean;
  onClick: () => void;
}) {
  const tone = affordable
    ? accent
      ? 'border-volt-dim text-volt hover:bg-raised'
      : 'border-current-dim text-current hover:bg-raised'
    : 'border-line text-ink-dim';
  return (
    <button
      className={`rounded border px-2 py-1 text-left font-mono text-[11px] leading-tight transition-all disabled:opacity-40 disabled:cursor-not-allowed ${tone}`}
      disabled={!affordable}
      onClick={onClick}
    >
      <div className="flex items-baseline justify-between">
        <span>{label}</span>
        <span className="text-volt">{gain > 0 ? `+${formatPower(gain)}/s` : ''}</span>
      </div>
      <span className="text-[10px] text-ink-dim">{cost !== undefined ? formatPower(cost) : '—'}</span>
    </button>
  );
}
