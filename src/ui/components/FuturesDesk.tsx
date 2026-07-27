import { useState } from 'react';
import { useGame } from '../../store/gameStore';
import { formatShort } from '../../engine/format';

/**
 * The Futures Desk (Agora). Stake Credits on where **demand** goes.
 *
 * It bets on the exogenous demand index rather than the delivered price on
 * purpose: the price also carries your own saturation, which the Sell slider
 * controls, so a price bet could be won every time by moving that slider after
 * placing it. The index is outside the player's hands, which is what makes this
 * a real call instead of a free withdrawal.
 *
 * Deliberately not styled as a casino — no reels, no coins, no jackpot. It reads
 * as a trading desk, because that's both the honest framing and what keeps the
 * App Store age rating at "no simulated gambling".
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
  const mid = (hi + lo) / 2;
  const top = mid + span / 2;
  const W = 100;
  const H = 32;
  const x = (i: number) => (i / (pts.length - 1)) * W;
  const y = (v: number) => ((top - v) / span) * H;
  const line = pts.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(' ');
  const area = `${line} L${W},${H} L0,${H} Z`;
  const rising = pts[pts.length - 1] >= pts[0];
  const stroke = rising ? 'var(--ok)' : 'var(--danger)';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-[72px] w-full" preserveAspectRatio="none" role="img" aria-label="Recent demand">
      <path d={area} fill={stroke} opacity={0.12} />
      <path d={line} fill="none" stroke={stroke} strokeWidth={1} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function FuturesDesk() {
  const f = useGame((s) => s.display.futures);
  const credits = useGame((s) => s.display.credits);
  const place = useGame((s) => s.actions.placeFuturesBet);
  const [stake, setStake] = useState(0);

  if (!f.unlocked) return null;

  // Default the stake to a modest slice rather than the max — the desk should
  // never nudge toward the biggest possible bet.
  const suggested = Math.max(f.minStake, Math.floor(f.maxStake / 4));
  const value = stake || Math.min(suggested, f.maxStake);
  const canBet = !f.open && f.maxStake >= f.minStake && value >= f.minStake && value <= f.maxStake;
  const open = f.open;

  return (
    <div className="rounded-xl border border-line bg-panel p-3">
      <div className="flex items-baseline justify-between">
        <h3 className="font-display text-[11px] font-semibold" style={{ letterSpacing: '.14em' }}>
          THE FUTURES DESK
        </h3>
        <span className="font-mono text-[11px] font-bold text-volt">×{f.index.toFixed(2)}</span>
      </div>
      <p className="mt-0.5 font-body text-[11px] italic leading-snug text-ink-dim">
        Demand moves on its own, and it multiplies what every Watt sells for.
      </p>

      <div className="mt-2 rounded-lg border border-line" style={{ background: 'var(--bg-raised)' }}>
        <IndexChart history={f.history} current={f.index} />
      </div>

      {open ? (
        <div className="mt-2.5 rounded-lg border px-3 py-2.5" style={{ borderColor: open.winning ? 'var(--ok)' : 'var(--danger)' }}>
          <div className="flex items-baseline justify-between font-mono text-[11px]">
            <span className="font-semibold">
              {open.up ? '▲ RISE' : '▼ FALL'} · {formatShort(Math.round(open.stake))} CR
            </span>
            <span style={{ color: open.winning ? 'var(--ok)' : 'var(--danger)' }}>
              {open.winning ? 'AHEAD' : 'BEHIND'} · {Math.ceil(open.secondsLeft)}s
            </span>
          </div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full" style={{ background: 'var(--grid-line)' }} aria-hidden>
            <span
              className="block h-full transition-[width] duration-500"
              style={{
                width: `${Math.max(0, Math.min(100, (1 - open.secondsLeft / f.windowSeconds) * 100))}%`,
                background: open.winning ? 'var(--ok)' : 'var(--danger)',
              }}
            />
          </div>
          <p className="mt-1.5 font-mono text-[10px] text-ink-dim">
            entry ×{open.entryIndex.toFixed(2)} → now ×{f.index.toFixed(2)}
          </p>
        </div>
      ) : (
        <>
          <div className="mt-2.5 flex items-baseline justify-between font-mono text-[10px] text-ink-dim">
            <label htmlFor="futures-stake">STAKE</label>
            <span className="text-ink">{formatShort(value)} CR</span>
          </div>
          <input
            id="futures-stake"
            type="range"
            min={f.minStake}
            max={Math.max(f.minStake, f.maxStake)}
            step={f.minStake}
            value={value}
            disabled={f.maxStake < f.minStake}
            onChange={(e) => setStake(Number(e.target.value))}
            className="mt-1 w-full accent-[var(--amber)]"
          />
          <div className="mt-2 flex gap-2">
            <button
              className="flex-1 rounded-lg border py-2 font-mono text-[11px] font-semibold transition-colors disabled:opacity-40"
              style={{ borderColor: 'var(--ok)', color: 'var(--ok)' }}
              disabled={!canBet}
              onClick={() => place(value, true)}
            >
              ▲ RISE
            </button>
            <button
              className="flex-1 rounded-lg border py-2 font-mono text-[11px] font-semibold transition-colors disabled:opacity-40"
              style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
              disabled={!canBet}
              onClick={() => place(value, false)}
            >
              ▼ FALL
            </button>
          </div>
          <p className="mt-1.5 font-body text-[10px] leading-snug text-ink-dim">
            {f.maxStake < f.minStake ? (
              <>You need at least {formatShort(Math.ceil(f.minStake * 2))} CR to trade — the desk never lets you stake more than half your balance.</>
            ) : (
              <>
                Settles in {f.windowSeconds}s at ×{f.payout} — the house keeps an edge, so the grid is still the better
                business. Max {formatShort(f.maxStake)} CR of your {formatShort(Math.floor(credits))}.
              </>
            )}
          </p>
        </>
      )}
    </div>
  );
}
