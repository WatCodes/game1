import { useGame } from '../../store/gameStore';
import { formatShort } from '../../engine/format';

function Chip({ label, value, rate, tone }: { label: string; value: string; rate?: string; tone: string }) {
  return (
    <span className="flex items-center gap-1.5 rounded border border-line bg-raised/60 px-2 py-0.5">
      <span className="text-[9px] uppercase tracking-wider text-ink-dim">{label}</span>
      <span className={tone}>{value}</span>
      {rate && <span className="text-[10px] text-ink-dim">{rate}</span>}
    </span>
  );
}

export function ResourceBar() {
  const rp = useGame((s) => s.display.rp);
  const rpRate = useGame((s) => s.display.rpRate);
  const kp = useGame((s) => s.display.kp);
  const prestige = useGame((s) => s.display.prestige);
  const credits = useGame((s) => s.display.credits);

  return (
    <div className="flex items-center justify-between gap-1.5 border-b border-line/60 bg-transparent px-3 py-1.5 font-mono text-xs">
      <Chip label="RP" value={formatShort(Math.floor(rp))} rate={`+${rpRate.toFixed(2)}/s`} tone="text-current" />
      <Chip label="CR" value={formatShort(Math.floor(credits))} tone="text-volt" />
      <Chip label="KP" value={formatShort(kp)} rate={`×${prestige.toFixed(2)}`} tone="text-ascend" />
    </div>
  );
}
