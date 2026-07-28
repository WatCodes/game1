import { useGame } from '../../store/gameStore';
import { formatPower, formatShort } from '../../engine/format';

/**
 * The Arbitrage Desk (Agora). Buy Watts off your own grid when demand is low,
 * release them when it's high.
 *
 * This is deliberately NOT a wager. There's no stake at risk, no countdown and
 * no forced settlement — you hold the Watts and choose when to sell, so the
 * outcome is decided by when you act rather than by a draw. That's what keeps it
 * out of Apple's "simulated gambling" category, and it's also what gives the
 * demand chart a job: you read it to decide, instead of betting against it.
 */

/** Sparkline of recent demand. Plain SVG — no chart dependency for ~40 points. */
function IndexChart({ history, current }: { history: number[]; current: number }) {
  const pts = [...history, current].slice(-48);
  if (pts.length < 2) {
    return (
      <div className="flex h-[72px] items-center justify-center font-mono text-[10px] text-ink-dim">
        reading the market…
      </div>
    );
  }
  const lo = Math.min(...pts);
  const hi = Math.max(...pts);
  // A flat market would divide by zero and also *look* wrong pinned to one edge,
  // so give it a floor of visual range and centre it.
  const span = Math.max(hi - lo, 0.04);
  const top = (hi + lo) / 2 + span / 2;
  const W = 100;
  const H = 32;
  const x = (i: number) => (i / (pts.length - 1)) * W;
  const y = (v: number) => ((top - v) / span) * H;
  const line = pts.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(' ');
  const rising = pts[pts.length - 1] >= pts[0];
  const stroke = rising ? 'var(--ok)' : 'var(--danger)';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-[72px] w-full" preserveAspectRatio="none" role="img" aria-label="Recent demand">
      <path d={`${line} L${W},${H} L0,${H} Z`} fill={stroke} opacity={0.12} />
      <path d={line} fill="none" stroke={stroke} strokeWidth={1} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function ArbitrageDesk() {
  const a = useGame((s) => s.display.arbitrage);
  const charge = useGame((s) => s.actions.chargeBattery);
  const release = useGame((s) => s.actions.releaseBattery);

  if (!a.unlocked) return null;

  const fill = a.capacity > 0 ? Math.min(1, a.stored / a.capacity) : 0;
  const canCharge = a.maxCharge > 0;
  const holding = a.stored > 0;
  const inProfit = a.unrealised >= 0;
  // Break-even price to clear the cost basis, efficiency included — the single
  // most useful number for deciding whether to hold.
  const breakEven = a.efficiency > 0 ? a.avgPrice / a.efficiency : 0;

  return (
    <div className="rounded-xl border border-line bg-panel p-3">
      <div className="flex items-baseline justify-between">
        <h3 className="font-display text-[11px] font-semibold" style={{ letterSpacing: '.14em' }}>
          THE ARBITRAGE DESK
        </h3>
        <span className="font-mono text-[11px] font-bold text-volt">{a.price.toFixed(2)} CR/W</span>
      </div>
      <p className="mt-0.5 font-body text-[11px] italic leading-snug text-ink-dim">
        Demand rises and falls on its own. Store power while it&rsquo;s cheap; sell it back when it isn&rsquo;t.
      </p>

      <div className="mt-2 rounded-lg border border-line" style={{ background: 'var(--bg-raised)' }}>
        <IndexChart history={a.history} current={a.index} />
      </div>

      {/* Battery */}
      <div className="mt-2.5 flex items-baseline justify-between font-mono text-[10px] text-ink-dim">
        <span>BATTERY</span>
        <span className="text-ink">
          {formatPower(a.stored)} / {formatPower(a.capacity)}
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full border border-line" aria-hidden>
        <span
          className="block h-full transition-[width] duration-300"
          style={{ width: `${fill * 100}%`, background: 'linear-gradient(90deg, var(--amber-dim), var(--amber))' }}
        />
      </div>

      {holding && (
        <div className="mt-2 flex items-baseline justify-between font-mono text-[10px]">
          <span className="text-ink-dim">
            bought at {a.avgPrice.toFixed(2)} · break-even {breakEven.toFixed(2)}
          </span>
          <span style={{ color: inProfit ? 'var(--ok)' : 'var(--danger)' }}>
            {inProfit ? '+' : ''}
            {formatShort(Math.round(a.unrealised))} CR
          </span>
        </div>
      )}

      <div className="mt-2.5 flex gap-2">
        <button
          className="flex-1 rounded-lg border py-2 font-mono text-[11px] font-semibold transition-colors disabled:opacity-40"
          style={{ borderColor: 'var(--cyan)', color: 'var(--cyan)' }}
          disabled={!canCharge}
          onClick={() => charge(a.maxCharge)}
        >
          ▼ STORE
        </button>
        <button
          className="flex-1 rounded-lg border py-2 font-mono text-[11px] font-semibold transition-colors disabled:opacity-40"
          style={{ borderColor: 'var(--amber)', color: 'var(--amber)' }}
          disabled={!holding}
          onClick={release}
        >
          ▲ RELEASE
        </button>
      </div>

      <p className="mt-1.5 font-body text-[10px] leading-snug text-ink-dim">
        {holding ? (
          <>
            Release whenever you like — there&rsquo;s no timer. You clear your costs above{' '}
            {breakEven.toFixed(2)} CR/W.
          </>
        ) : canCharge ? (
          <>
            Storing costs {a.price.toFixed(2)} CR/W now. Batteries lose{' '}
            {Math.round((1 - a.efficiency) * 100)}% on the round trip, so wait for a real rise.
          </>
        ) : (
          <>Earn more Credits, or build more generation — the battery holds a share of your output.</>
        )}
      </p>
    </div>
  );
}
