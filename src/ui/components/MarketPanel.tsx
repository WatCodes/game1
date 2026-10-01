import { useState } from 'react';
import { useGame } from '../../store/gameStore';
import { formatPower, formatShort } from '../../engine/format';
import type { TradeRecord } from '../../engine/types';
import { CONFIG } from '../../content/config';

/**
 * The Market (rail panel). Buy Watts off your own grid when demand is low,
 * release them when it's high. Design: docs/MARKET.md.
 *
 * This is deliberately NOT a wager. There's no stake at risk, no countdown and
 * no forced settlement — you hold the Watts and choose when to sell, so the
 * outcome is decided by when you act rather than by a draw. Standing orders are
 * the same choice made in advance, and can be cleared at any time. That's what
 * keeps the Market out of Apple's "simulated gambling" category, and it's also
 * what gives the chart a job: you read it to decide, instead of betting on it.
 */

const STEP = 0.05;
const snap = (x: number) => Math.max(STEP, Math.round(x / STEP) * STEP);
/** Battery size at a cell level, in seconds of generation. */
const holdSeconds = (level: number) =>
  Math.round(CONFIG.RESERVE_CAPACITY_SECONDS * (1 + CONFIG.DESK_CELL_STEP * level));

const AMOUNTS = [
  { label: '25%', f: 0.25 },
  { label: '50%', f: 0.5 },
  { label: 'ALL', f: 1 },
];

/**
 * Sparkline of recent demand, with the standing orders drawn across it. Orders
 * are prices and the chart is the demand index, so each line is converted at
 * today's price-per-index — approximate if saturation moves, and good enough to
 * show where an order sits against the recent range.
 */
function IndexChart({
  history,
  current,
  lines,
}: {
  history: number[];
  current: number;
  lines: { at: number; color: string }[];
}) {
  const pts = [...history, current].slice(-48);
  if (pts.length < 2) {
    return (
      <div className="flex h-[84px] items-center justify-center font-mono text-[10px] text-ink-dim">
        reading the market…
      </div>
    );
  }
  const lo = Math.min(...pts, ...lines.map((l) => l.at));
  const hi = Math.max(...pts, ...lines.map((l) => l.at));
  // A flat market would divide by zero and also *look* wrong pinned to one edge,
  // so give it a floor of visual range and centre it.
  const span = Math.max(hi - lo, 0.04) * 1.1;
  const top = (hi + lo) / 2 + span / 2;
  const W = 100;
  const H = 32;
  const x = (i: number) => (i / (pts.length - 1)) * W;
  const y = (v: number) => ((top - v) / span) * H;
  const line = pts.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(' ');
  const rising = pts[pts.length - 1] >= pts[0];
  const stroke = rising ? 'var(--ok)' : 'var(--danger)';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-[84px] w-full" preserveAspectRatio="none" role="img" aria-label="Recent demand">
      <path d={`${line} L${W},${H} L0,${H} Z`} fill={stroke} opacity={0.12} />
      <path d={line} fill="none" stroke={stroke} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      {lines.map((l, i) => (
        <line
          key={i}
          x1={0}
          x2={W}
          y1={y(l.at)}
          y2={y(l.at)}
          stroke={l.color}
          strokeWidth={1}
          strokeDasharray="3 3"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}

function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-panel p-3">
      <div className="flex items-baseline justify-between">
        <h3 className="font-display text-[11px] font-semibold" style={{ letterSpacing: '.14em' }}>
          {title}
        </h3>
        {aside}
      </div>
      {children}
    </div>
  );
}

function OrderRow({
  side,
  value,
  suggest,
  canStep,
  onSet,
}: {
  side: 'buy' | 'sell';
  value: number | null;
  suggest: number;
  canStep: (next: number) => boolean;
  onSet: (price: number | null) => void;
}) {
  const color = side === 'buy' ? 'var(--cyan)' : 'var(--amber)';
  const label = side === 'buy' ? 'STORE AT OR BELOW' : 'RELEASE AT OR ABOVE';
  const btn =
    'h-7 w-7 rounded-md border border-line font-mono text-[13px] leading-none text-ink disabled:opacity-30';
  return (
    <div className="mt-2 flex items-center gap-2">
      <span className="flex-1 font-mono text-[10px] font-semibold" style={{ color }}>
        {label}
      </span>
      {value === null ? (
        <button
          className="rounded-md border px-2.5 py-1 font-mono text-[10px] font-semibold"
          style={{ borderColor: color, color }}
          onClick={() => onSet(suggest)}
        >
          SET
        </button>
      ) : (
        <>
          <button className={btn} disabled={!canStep(value - STEP)} onClick={() => onSet(snap(value - STEP))} aria-label="Lower">
            −
          </button>
          <span className="w-10 text-center font-mono text-[12px] font-bold text-ink">{value.toFixed(2)}</span>
          <button className={btn} disabled={!canStep(value + STEP)} onClick={() => onSet(snap(value + STEP))} aria-label="Raise">
            +
          </button>
          <button
            className="ml-1 rounded px-1 font-mono text-[12px] text-ink-dim"
            onClick={() => onSet(null)}
            aria-label={`Cancel ${side} order`}
          >
            ✕
          </button>
        </>
      )}
    </div>
  );
}

function LogLine({ r }: { r: TradeRecord }) {
  const win = r.profit >= 0;
  return (
    <div className="flex items-baseline justify-between font-mono text-[10px]">
      <span className="text-ink-dim">
        {r.kind === 'store' ? '▼ stored' : '▲ released'} {formatPower(r.watts)} @ {r.price.toFixed(2)}
        {r.byOrder && <span className="ml-1 text-ink-dim">· order</span>}
      </span>
      {r.kind === 'release' && (
        <span style={{ color: win ? 'var(--ok)' : 'var(--danger)' }}>
          {win ? '+' : ''}
          {formatShort(Math.round(r.profit))} CR
        </span>
      )}
    </div>
  );
}

export function MarketPanel() {
  const m = useGame((s) => s.display.market);
  const surgeLeft = useGame((s) => s.display.boosts.surgeLeft);
  const charge = useGame((s) => s.actions.chargeBattery);
  const release = useGame((s) => s.actions.releaseBattery);
  const setOrder = useGame((s) => s.actions.setStandingOrder);
  const buyUpgrade = useGame((s) => s.actions.buyMarketUpgrade);
  const [amount, setAmount] = useState(1);

  if (!m.unlocked) {
    const pct = Math.min(1, m.lifetimePower / m.unlockAt);
    return (
      <div className="flex flex-col gap-2.5 px-4 py-3.5">
        <Section title="THE MARKET">
          <p className="mt-1 font-body text-[12px] leading-snug text-ink-dim">
            The market opens once the city has made {formatPower(m.unlockAt)}·s of power. Then demand starts to move,
            and you can store power while it&rsquo;s cheap and sell it when it isn&rsquo;t.
          </p>
          <div className="mt-2.5 h-2 overflow-hidden rounded-full border border-line" aria-hidden>
            <span className="block h-full" style={{ width: `${pct * 100}%`, background: 'var(--amber)' }} />
          </div>
          <div className="mt-1 text-right font-mono text-[10px] text-ink-dim">
            {formatPower(m.lifetimePower)} / {formatPower(m.unlockAt)}
          </div>
        </Section>
      </div>
    );
  }

  const fill = m.capacity > 0 ? Math.min(1, m.stored / m.capacity) : 0;
  const canCharge = m.maxCharge > 0;
  const holding = m.stored > 0;
  const inProfit = m.unrealised >= 0;
  // Break-even price to clear the cost basis, efficiency included — the single
  // most useful number for deciding whether to hold.
  const breakEven = m.efficiency > 0 ? m.avgPrice / m.efficiency : 0;
  const perIndex = m.index > 0 ? m.price / m.index : 1;
  const lines = [
    ...(m.buyBelow !== null ? [{ at: m.buyBelow / perIndex, color: 'var(--cyan)' }] : []),
    ...(m.sellAbove !== null ? [{ at: m.sellAbove / perIndex, color: 'var(--amber)' }] : []),
  ];
  // Orders may not cross: a buy at or above the sell line would lose the round
  // trip on every fill. The engine refuses one; the steppers just stop short.
  const buyOk = (p: number) => p >= STEP && (m.sellAbove === null || p < m.sellAbove - 1e-9);
  const sellOk = (p: number) => p >= STEP && (m.buyBelow === null || p > m.buyBelow + 1e-9);
  const buySuggest = snap(m.price * 0.9);
  // A sell line has to clear the round trip to be worth setting: above the
  // break-even on what's held, or on what storing now would cost if empty.
  const clearAt = (holding ? breakEven : m.price / m.efficiency) * 1.1;
  const sellSuggest = Math.ceil(Math.max(clearAt, (m.buyBelow ?? 0) + STEP * 4) / STEP) * STEP;
  const sellBelowCost = holding && m.sellAbove !== null && m.sellAbove < breakEven;

  const effPct = Math.round(m.efficiency * 100);
  const cells = m.upgrades.cells;
  const chem = m.upgrades.chemistry;

  return (
    <div className="flex flex-col gap-2.5 px-4 py-3.5">
      <Section title="DEMAND" aside={<span className="font-mono text-[11px] font-bold text-volt">{m.price.toFixed(2)} CR/W</span>}>
        <p className="mt-0.5 font-body text-[11px] italic leading-snug text-ink-dim">
          Demand rises and falls on its own. Store power while it&rsquo;s cheap; sell it back when it isn&rsquo;t.
        </p>
        <div className="mt-2 rounded-lg border border-line" style={{ background: 'var(--bg-raised)' }}>
          <IndexChart history={m.history} current={m.index} lines={lines} />
        </div>
      </Section>

      <Section
        title="BATTERY"
        aside={
          <span className="font-mono text-[10px] text-ink">
            {formatPower(m.stored)} / {formatPower(m.capacity)}
          </span>
        }
      >
        <div className="mt-1.5 h-2 overflow-hidden rounded-full border border-line" aria-hidden>
          <span
            className="block h-full transition-[width] duration-300"
            style={{ width: `${fill * 100}%`, background: 'linear-gradient(90deg, var(--amber-dim), var(--amber))' }}
          />
        </div>

        {holding && (
          <div className="mt-2 flex items-baseline justify-between font-mono text-[10px]">
            <span className="text-ink-dim">
              bought at {m.avgPrice.toFixed(2)} · break-even {breakEven.toFixed(2)}
            </span>
            <span style={{ color: inProfit ? 'var(--ok)' : 'var(--danger)' }}>
              {inProfit ? '+' : ''}
              {formatShort(Math.round(m.unrealised))} CR
            </span>
          </div>
        )}

        <div className="mt-2.5 flex gap-1" role="radiogroup" aria-label="Trade size">
          {AMOUNTS.map((a) => (
            <button
              key={a.label}
              role="radio"
              aria-checked={amount === a.f}
              className="flex-1 rounded-md border py-1 font-mono text-[10px] font-semibold"
              style={{
                borderColor: amount === a.f ? 'var(--amber)' : 'var(--grid-line)',
                background: amount === a.f ? 'var(--amber)' : 'transparent',
                color: amount === a.f ? '#fff' : 'var(--text-dim)',
              }}
              onClick={() => setAmount(a.f)}
            >
              {a.label}
            </button>
          ))}
        </div>

        <div className="mt-2 flex gap-2">
          <button
            className="flex-1 rounded-lg border py-2 font-mono text-[11px] font-semibold transition-colors disabled:opacity-40"
            style={{ borderColor: 'var(--cyan)', color: 'var(--cyan)' }}
            disabled={!canCharge}
            onClick={() => charge(amount)}
          >
            ▼ STORE
          </button>
          <button
            className="flex-1 rounded-lg border py-2 font-mono text-[11px] font-semibold transition-colors disabled:opacity-40"
            style={{ borderColor: 'var(--amber)', color: 'var(--amber)' }}
            disabled={!holding}
            onClick={() => release(amount)}
          >
            ▲ RELEASE
          </button>
        </div>

        <p className="mt-1.5 font-body text-[10px] leading-snug text-ink-dim">
          {holding ? (
            <>
              Release whenever you like — there&rsquo;s no timer. Selling at a profit lights the Grid Surge (×1.5
              power){surgeLeft > 0 ? ', and it’s lit now' : ''}.
            </>
          ) : canCharge ? (
            <>
              Storing costs {m.price.toFixed(2)} CR/W now. Batteries lose {100 - effPct}% on the round trip, so wait for
              a real rise.
            </>
          ) : (
            <>Earn more Credits, or build more generation — the battery holds a share of your output.</>
          )}
        </p>
      </Section>

      <Section title="STANDING ORDERS" aside={<span className="font-mono text-[9px] text-ink-dim">WHILE YOU PLAY</span>}>
        <p className="mt-0.5 font-body text-[10.5px] leading-snug text-ink-dim">
          The cats trade for you at your prices. Each order fills once per visit to its price, and rests while
          you&rsquo;re away.
        </p>
        <OrderRow
          side="buy"
          value={m.buyBelow}
          suggest={buyOk(buySuggest) ? buySuggest : snap((m.sellAbove ?? buySuggest) - STEP * 4)}
          canStep={buyOk}
          onSet={(p) => setOrder('buy', p)}
        />
        <OrderRow side="sell" value={m.sellAbove} suggest={sellSuggest} canStep={sellOk} onSet={(p) => setOrder('sell', p)} />
        {sellBelowCost && (
          <p className="mt-1 text-right font-mono text-[9.5px]" style={{ color: 'var(--danger)' }}>
            below your break-even of {breakEven.toFixed(2)} — this order sells at a loss
          </p>
        )}
      </Section>

      <Section title="UPGRADES">
        {(
          [
            {
              kind: 'cells' as const,
              u: cells,
              name: 'Battery Cells',
              desc: `Holds ${holdSeconds(cells.level)}s of output${cells.maxed ? '' : ` → ${holdSeconds(cells.level + 1)}s`}.`,
            },
            {
              kind: 'chemistry' as const,
              u: chem,
              name: 'Better Chemistry',
              desc: `Round trip keeps ${effPct}%${chem.maxed ? '' : ` → ${effPct + 1}%`}.`,
            },
          ]
        ).map(({ kind, u, name, desc }) => (
          <div key={kind} className="mt-2 flex items-center gap-2">
            <div className="flex-1">
              <div className="font-body text-[12px] font-semibold text-ink">
                {name}{' '}
                <span className="font-mono text-[10px] font-normal text-ink-dim">
                  {u.level}/{u.max}
                </span>
              </div>
              <div className="font-body text-[10.5px] text-ink-dim">{desc}</div>
            </div>
            <button
              className="rounded-lg border px-2.5 py-1.5 font-mono text-[10.5px] font-semibold disabled:opacity-40"
              style={{ borderColor: 'var(--amber)', color: 'var(--amber)' }}
              disabled={!u.affordable}
              onClick={() => buyUpgrade(kind)}
            >
              {u.maxed ? 'MAX' : `${formatShort(u.cost)} CR`}
            </button>
          </div>
        ))}
      </Section>

      <Section
        title="LEDGER"
        aside={
          m.trades > 0 ? (
            <span className="font-mono text-[10px] text-ink-dim">
              {m.wins}/{m.trades} won · net{' '}
              <span style={{ color: m.lifetimeProfit >= 0 ? 'var(--ok)' : 'var(--danger)' }}>
                {m.lifetimeProfit >= 0 ? '+' : ''}
                {formatShort(Math.round(m.lifetimeProfit))}
              </span>
            </span>
          ) : undefined
        }
      >
        {m.log.length === 0 ? (
          <p className="mt-1 font-body text-[10.5px] italic text-ink-dim">No trades yet.</p>
        ) : (
          <div className="mt-1.5 flex flex-col gap-1">
            {[...m.log].reverse().map((r, i) => (
              <LogLine key={i} r={r} />
            ))}
          </div>
        )}
        {m.bestTrade > 0 && (
          <div className="mt-1.5 font-mono text-[10px] text-ink-dim">best trade +{formatShort(Math.round(m.bestTrade))} CR</div>
        )}
      </Section>
    </div>
  );
}
