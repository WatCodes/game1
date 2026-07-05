import { useGame } from '../../store/gameStore';
import { formatShort } from '../../engine/format';

export function ResourceBar() {
  const rp = useGame((s) => s.display.rp);
  const rpRate = useGame((s) => s.display.rpRate);
  const kp = useGame((s) => s.display.kp);
  const prestige = useGame((s) => s.display.prestige);
  const globalMilestones = useGame((s) => s.display.globalMilestones);

  return (
    <div className="flex items-center justify-between border-b border-line bg-panel px-4 py-1.5 font-mono text-xs">
      <span>
        <span className="text-ink-dim">RP </span>
        <span className="text-current">{formatShort(Math.floor(rp))}</span>
        <span className="text-ink-dim"> +{rpRate.toFixed(2)}/s</span>
      </span>
      <span>
        <span className="text-ink-dim">Milestones </span>
        <span className="text-volt">{globalMilestones}</span>
      </span>
      <span>
        <span className="text-ink-dim">KP </span>
        <span className="text-ascend">{formatShort(kp)}</span>
        <span className="text-ink-dim"> ×{prestige.toFixed(2)}</span>
      </span>
    </div>
  );
}
