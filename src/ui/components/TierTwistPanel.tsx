import { useGame } from '../../store/gameStore';
import { formatTime } from '../../engine/format';

function LaunchWindowCard({ active, timeLeft, nextIn, surchargePct }: { active: boolean; timeLeft: number; nextIn: number; surchargePct: number }) {
  return (
    <div className={`rounded border px-3 py-2 ${active ? 'border-ok' : 'border-line'}`}>
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] uppercase tracking-widest text-ink-dim">Launch Window</span>
        <span className={`font-mono text-[11px] ${active ? 'text-ok' : 'text-ink-dim'}`}>
          {active ? `OPEN — ${formatTime(timeLeft)} left` : `next in ${formatTime(nextIn)}`}
        </span>
      </div>
      <p className="mt-1 text-[10px] leading-relaxed text-ink-dim">
        {active
          ? 'Orbital launches are cleared — purchases cost normal price.'
          : `Launch control is holding bulk orders. Purchases cost +${surchargePct}% until the next window (automation still buys, just pricier).`}
      </p>
    </div>
  );
}

function AccretionCard({
  feedRate,
  heat,
  outputBonusPct,
  upkeepPenaltyPct,
}: {
  feedRate: number;
  heat: number;
  outputBonusPct: number;
  upkeepPenaltyPct: number;
}) {
  const setAccretionFeedRate = useGame((s) => s.actions.setAccretionFeedRate);
  return (
    <div className="rounded border border-line px-3 py-2">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] uppercase tracking-widest text-ink-dim">Accretion Disk</span>
        <span className="font-mono text-[11px]">
          <span className="text-volt">+{outputBonusPct}%</span> out ·{' '}
          <span className="text-danger">+{upkeepPenaltyPct}%</span> upkeep
        </span>
      </div>
      <label className="mt-2 block text-[10px] text-ink-dim" htmlFor="feed-rate">
        Feed rate <span className="font-mono text-current">{Math.round(feedRate * 100)}%</span>
      </label>
      <input
        id="feed-rate"
        type="range"
        min={0}
        max={100}
        step={5}
        value={Math.round(feedRate * 100)}
        onChange={(e) => setAccretionFeedRate(Number(e.target.value) / 100)}
        className="mt-1 w-full accent-[var(--amber)]"
      />
      <div className="milestone-strip mt-2" aria-hidden>
        <span style={{ width: `${heat * 100}%`, background: heat > 0.85 ? 'var(--amber)' : undefined }} />
      </div>
      <p className="mt-1.5 text-[10px] leading-relaxed text-ink-dim">
        Crank the feed for more output at higher upkeep. Heat maxing out fires a free power flare — pure upside, no
        penalty for letting it happen.
      </p>
    </div>
  );
}

function RelayCard({ allocation, powerPenaltyPct, rpBonusPct }: { allocation: number; powerPenaltyPct: number; rpBonusPct: number }) {
  const setRelayAllocation = useGame((s) => s.actions.setRelayAllocation);
  return (
    <div className="rounded border border-line px-3 py-2">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] uppercase tracking-widest text-ink-dim">Relay Routing</span>
        <span className="font-mono text-[11px]">
          <span className="text-danger">-{powerPenaltyPct}%</span> power ·{' '}
          <span className="text-current">+{rpBonusPct}%</span> RP
        </span>
      </div>
      <label className="mt-2 block text-[10px] text-ink-dim" htmlFor="relay-alloc">
        Research array allocation <span className="font-mono text-current">{Math.round(allocation * 100)}%</span>
      </label>
      <input
        id="relay-alloc"
        type="range"
        min={0}
        max={100}
        step={5}
        value={Math.round(allocation * 100)}
        onChange={(e) => setRelayAllocation(Number(e.target.value) / 100)}
        className="mt-1 w-full accent-[var(--cyan)]"
      />
      <p className="mt-1.5 text-[10px] leading-relaxed text-ink-dim">
        Divert the galactic relay network from power delivery to the research array — a straight trade, not free
        research.
      </p>
    </div>
  );
}

/** One small mechanical twist per tier (T3/T5/T6) so late tiers aren't a reskin. */
export function TierTwistPanel() {
  const twist = useGame((s) => s.display.tierTwist);
  if (twist.kind === 'none') return null;
  if (twist.kind === 'launchWindow') return <LaunchWindowCard {...twist} />;
  if (twist.kind === 'accretion') return <AccretionCard {...twist} />;
  return <RelayCard {...twist} />;
}
