import { memo } from 'react';
import { useGame, type SourceView } from '../../store/gameStore';
import { formatPower, formatShort } from '../../engine/format';

export const SourceRow = memo(function SourceRow({ src, power }: { src: SourceView; power: number }) {
  const buySource = useGame((s) => s.actions.buySource);

  if (!src.unlocked) {
    return (
      <div className="rounded border border-line bg-panel/50 px-3 py-2 text-xs text-ink-dim">
        <span className="font-semibold">{src.name}</span> — locked. Unlock it in Research.
      </div>
    );
  }

  const btn =
    'rounded border px-2 py-1 font-mono text-[11px] leading-tight transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
  const canBuy1 = power >= src.cost1;
  const canBuy10 = power >= src.cost10;

  return (
    <div className="rounded border border-line bg-panel px-3 py-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold">
          {src.name}
          {src.automated && <span className="ml-1.5 text-[10px] uppercase text-ok" title="Manager active">auto</span>}
        </span>
        <span className="font-mono text-xs text-ink-dim">
          ×{formatShort(src.milestoneMult)} · owned <span className="text-ink">{src.owned}</span>
        </span>
      </div>
      <div className="mt-0.5 flex items-baseline justify-between font-mono text-[11px] text-ink-dim">
        <span>
          <span className="text-volt">+{formatPower(src.output)}/s</span>
          {src.upkeep > 0 && <span className="ml-1.5 text-danger/80">−{formatPower(src.upkeep)}/s upkeep</span>}
        </span>
        <span>
          {src.toNextMilestone} to ×2 (at {src.nextMilestoneAt})
        </span>
      </div>
      {src.nextUnitNet <= 0 && src.owned > 0 && (
        <p className="mt-1 font-mono text-[10px] text-danger/90">
          ⚠ next unit curtails — output won't rise until the ×2 milestone or efficiency research
        </p>
      )}
      <div className="mt-1.5 grid grid-cols-3 gap-1.5">
        <button
          className={`${btn} ${canBuy1 ? 'border-current-dim text-current hover:bg-raised' : 'border-line text-ink-dim'}`}
          disabled={!canBuy1}
          onClick={() => buySource(src.id, 1)}
        >
          Buy 1<br />
          <span className="text-ink-dim">{formatPower(src.cost1)}</span>
        </button>
        <button
          className={`${btn} ${canBuy10 ? 'border-current-dim text-current hover:bg-raised' : 'border-line text-ink-dim'}`}
          disabled={!canBuy10}
          onClick={() => buySource(src.id, 10)}
        >
          Buy 10<br />
          <span className="text-ink-dim">{formatPower(src.cost10)}</span>
        </button>
        <button
          className={`${btn} ${src.maxCount > 0 ? 'border-volt-dim text-volt hover:bg-raised' : 'border-line text-ink-dim'}`}
          disabled={src.maxCount < 1}
          onClick={() => buySource(src.id, 'max')}
        >
          Max ({src.maxCount})<br />
          <span className="text-ink-dim">{src.maxCount > 0 ? formatPower(src.maxCost) : '—'}</span>
        </button>
      </div>
    </div>
  );
});
