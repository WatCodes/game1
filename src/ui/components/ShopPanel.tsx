import type { ReactNode } from 'react';
import { useGame } from '../../store/gameStore';
import { formatTime } from '../../engine/format';
import { CONFIG } from '../../content/config';
import { FuturesDesk } from './FuturesDesk';

/**
 * The Agora (design 5a). Item rows are white cards on parchment with a tinted
 * icon tile, a name + duration chip, a one-line description, and a gold-outline
 * price button — deliberately shop-shelf rather than spreadsheet.
 */
function Item({
  icon,
  title,
  duration,
  desc,
  cost,
  affordable,
  activeLabel,
  onBuy,
}: {
  icon: ReactNode;
  title: string;
  duration?: string;
  desc: string;
  cost: number;
  affordable: boolean;
  activeLabel?: string;
  onBuy: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-raised px-3.5 py-3">
      {icon}
      <div className="min-w-0 flex-1">
        <div className="font-body text-sm font-semibold">
          {title}
          {duration && (
            <span className="ml-1.5 whitespace-nowrap font-mono text-[10px] font-normal text-ink-dim">{duration}</span>
          )}
        </div>
        <div className="font-body text-[10.5px] leading-snug text-ink-dim">{desc}</div>
      </div>
      {activeLabel ? (
        <span className="shrink-0 font-mono text-[10px] uppercase text-ok">{activeLabel}</span>
      ) : (
        <button
          className="shrink-0 rounded-[9px] border px-3 py-2 font-mono text-[11px] font-semibold transition-colors disabled:opacity-45"
          style={{
            borderColor: 'var(--amber)',
            background: affordable ? 'rgba(184,137,47,.1)' : 'transparent',
            color: 'var(--text)',
          }}
          disabled={!affordable}
          onClick={onBuy}
        >
          {cost} CR
        </button>
      )}
    </div>
  );
}

/** 38px tinted tile that fronts each item. */
function Tile({ tint, border, color, children }: { tint: string; border: string; color: string; children: ReactNode }) {
  return (
    <div
      className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] font-mono text-[13px] font-bold"
      style={{ background: tint, border: `1px solid ${border}`, color }}
    >
      {children}
    </div>
  );
}

export function ShopPanel() {
  const credits = useGame((s) => s.display.credits);
  const shop = useGame((s) => s.display.shop);
  const boosts = useGame((s) => s.display.boosts);
  const dispatch = useGame((s) => s.display.dispatch);
  const claimDailyReward = useGame((s) => s.actions.claimDailyReward);
  const buyShopSolver = useGame((s) => s.actions.buyShopSolver);
  const buyShopBoost = useGame((s) => s.actions.buyShopBoost);

  const dayIdx = shop.canClaimDaily ? shop.streak % 7 : (shop.streak - 1 + 7) % 7;

  return (
    <div className="flex flex-col gap-2.5 px-4 py-3.5">
      {/* Daily tribute track (design 5b) */}
      <div className="rounded-xl border border-line bg-raised p-3.5">
        <div className="flex items-baseline justify-between">
          <span className="font-display text-[11px] font-semibold" style={{ letterSpacing: '.2em', color: 'var(--danger)' }}>
            DAY {shop.streak + (shop.canClaimDaily ? 1 : 0)} · TRIBUTE
          </span>
          <span className="font-mono text-[10px] text-ink-dim">streak {shop.streak}</span>
        </div>
        <div className="mt-2.5 flex gap-1.5">
          {CONFIG.DAILY_REWARDS.map((r, i) => {
            const claimed = i < dayIdx || (!shop.canClaimDaily && i === dayIdx);
            const today = shop.canClaimDaily && i === dayIdx;
            const last = i === CONFIG.DAILY_REWARDS.length - 1;
            return (
              <div
                key={i}
                className="flex flex-1 flex-col items-center justify-center rounded-md border font-mono"
                style={{
                  height: today ? 38 : 34,
                  background: today ? 'var(--amber)' : claimed ? 'rgba(184,137,47,.14)' : 'var(--bg-raised)',
                  borderColor: today || claimed ? 'var(--amber)' : last ? 'var(--danger)' : 'var(--grid-line)',
                  color: today ? '#fff' : claimed ? 'var(--amber)' : last ? 'var(--danger)' : 'var(--text-dim)',
                  boxShadow: today ? '0 0 12px rgba(184,137,47,.5)' : undefined,
                }}
              >
                <span className="text-[10px] font-bold leading-none">{claimed && !today ? '✓' : r}</span>
                <span className="mt-0.5 text-[7px] leading-none opacity-80">{today ? 'TODAY' : `D${i + 1}`}</span>
              </div>
            );
          })}
        </div>
        {shop.canClaimDaily ? (
          <button
            className="mt-3 w-full rounded-[13px] py-2.5 font-display text-[13px] font-bold transition-opacity hover:opacity-90"
            style={{
              background: 'linear-gradient(var(--gold-lit), var(--gold-deep))',
              color: '#2c2318',
              letterSpacing: '.16em',
              boxShadow: '0 6px 16px -6px rgba(169,120,31,.8)',
            }}
            onClick={claimDailyReward}
          >
            CLAIM TRIBUTE · +{shop.nextReward} CR
          </button>
        ) : (
          <p className="mt-2.5 text-center font-body text-[10.5px] italic text-ink-dim">
            Claimed. The next tribute arrives after midnight (+{shop.nextReward} CR).
          </p>
        )}
        <p className="mt-1.5 text-center font-body text-[10.5px] italic text-ink-dim">
          Miss a day? The first one's forgiven — your streak holds.
        </p>
      </div>

      <Item
        icon={
          <Tile tint="rgba(47,111,134,.12)" border="rgba(47,111,134,.4)" color="var(--cyan)">
            <span className="h-3.5 w-3.5 rounded-full border-[2.5px] border-current" />
          </Tile>
        }
        title={`Auto-Solver${shop.solvers > 0 ? ` ×${shop.solvers}` : ''}`}
        desc={`Balances a grid every ${CONFIG.SOLVER_SECONDS}s. Stack about six and the Surge never goes out.`}
        cost={shop.solverCost}
        affordable={credits >= shop.solverCost}
        onBuy={buyShopSolver}
      />
      <Item
        icon={
          <Tile tint="rgba(52,211,153,.12)" border="rgba(52,150,110,.4)" color="#2e9c73">
            ×2
          </Tile>
        }
        title="Demand Contract"
        duration="15 min"
        desc="Double all power output."
        cost={CONFIG.BOOST_POWER_COST}
        affordable={credits >= CONFIG.BOOST_POWER_COST}
        activeLabel={boosts.powerLeft > 0 ? formatTime(boosts.powerLeft) : undefined}
        onBuy={() => buyShopBoost('power')}
      />
      <Item
        icon={
          <Tile tint="rgba(184,137,47,.12)" border="rgba(184,137,47,.4)" color="var(--amber)">
            RP
          </Tile>
        }
        title="Crash Program"
        duration="15 min"
        desc="Double the Research Point trickle."
        cost={CONFIG.BOOST_RP_COST}
        affordable={credits >= CONFIG.BOOST_RP_COST}
        activeLabel={boosts.rpLeft > 0 ? formatTime(boosts.rpLeft) : undefined}
        onBuy={() => buyShopBoost('rp')}
      />
      <Item
        icon={
          <Tile tint="rgba(187,83,52,.12)" border="rgba(187,83,52,.4)" color="var(--danger)">
            ⚡
          </Tile>
        }
        title="Spinning Reserve"
        desc="Recharge the altar to full, ready to channel."
        cost={CONFIG.DISPATCH_RECHARGE_COST}
        affordable={credits >= CONFIG.DISPATCH_RECHARGE_COST && dispatch.charge < 1}
        activeLabel={dispatch.charge >= 1 ? 'full' : undefined}
        onBuy={() => buyShopBoost('dispatch')}
      />

      {/* Speculation lives in the marketplace, below the goods — it's a place to
          put a surplus, not the first thing the Agora offers you. */}
      <FuturesDesk />

      <div className="mt-1 flex items-center gap-2 font-body text-[10.5px] italic text-ink-dim">
        <span className="h-1.5 w-1.5 rotate-45" style={{ background: 'var(--amber)' }} />
        Credits come from balancing grids and daily visits. They buy speed, never progress.
      </div>
    </div>
  );
}
