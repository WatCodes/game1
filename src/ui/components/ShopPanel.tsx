import { useGame } from '../../store/gameStore';
import { formatTime } from '../../engine/format';
import { CONFIG } from '../../content/config';

function ItemCard({
  title,
  desc,
  cost,
  affordable,
  activeLabel,
  onBuy,
}: {
  title: string;
  desc: string;
  cost: number;
  affordable: boolean;
  activeLabel?: string;
  onBuy: () => void;
}) {
  return (
    <div className="rounded border border-line bg-panel px-3 py-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold">{title}</span>
        {activeLabel && <span className="font-mono text-[10px] uppercase text-ok">{activeLabel}</span>}
      </div>
      <p className="mt-0.5 text-xs text-ink-dim">{desc}</p>
      <button
        className={`mt-1.5 rounded border px-2.5 py-1 font-mono text-[11px] transition-colors ${
          affordable ? 'border-volt-dim text-volt hover:bg-raised' : 'border-line text-ink-dim cursor-not-allowed'
        }`}
        disabled={!affordable}
        onClick={onBuy}
      >
        Buy — {cost} CR
      </button>
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
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-baseline justify-between rounded border border-line bg-panel px-3 py-2">
        <span className="text-[11px] uppercase tracking-widest text-ink-dim">Grid Exchange</span>
        <span className="readout text-xl">{credits} CR</span>
      </div>

      {/* Daily streak calendar */}
      <div className="rounded border border-line bg-panel p-3">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold">Daily connection bonus</span>
          <span className="font-mono text-[11px] text-ink-dim">streak {shop.streak}</span>
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1">
          {CONFIG.DAILY_REWARDS.map((r, i) => {
            const claimed = !shop.canClaimDaily && i === dayIdx;
            const today = shop.canClaimDaily && i === dayIdx;
            return (
              <div
                key={i}
                className={`rounded border px-0.5 py-1.5 text-center font-mono text-[9px] leading-tight ${
                  today
                    ? 'border-volt text-volt'
                    : claimed
                      ? 'border-current-dim text-current'
                      : 'border-line text-ink-dim'
                }`}
              >
                D{i + 1}
                <br />
                {r}
              </div>
            );
          })}
        </div>
        {shop.canClaimDaily ? (
          <button
            className="dispatch-ready mt-2.5 w-full rounded border border-volt px-3 py-2 text-sm font-semibold text-volt transition-colors hover:bg-volt/10"
            onClick={claimDailyReward}
          >
            Claim today — +{shop.nextReward} CR
          </button>
        ) : (
          <p className="mt-2.5 text-center font-mono text-[11px] text-ink-dim">
            Claimed — next reward after local midnight (+{shop.nextReward} CR)
          </p>
        )}
        <p className="mt-1.5 text-center text-[10px] text-ink-dim">One missed day is forgiven; two resets the streak.</p>
      </div>

      <ItemCard
        title={`Auto-Solver ${shop.solvers > 0 ? `(${shop.solvers} running)` : ''}`}
        desc={`Solves one circuit every ${CONFIG.SOLVER_SECONDS}s for reduced Credits and a short surge. Stack ~6 to keep the surge lit around the clock.`}
        cost={shop.solverCost}
        affordable={credits >= shop.solverCost}
        onBuy={buyShopSolver}
      />
      <ItemCard
        title="Demand contract"
        desc="×2 power output for 15 minutes."
        cost={CONFIG.BOOST_POWER_COST}
        affordable={credits >= CONFIG.BOOST_POWER_COST}
        activeLabel={boosts.powerLeft > 0 ? `active ${formatTime(boosts.powerLeft)}` : undefined}
        onBuy={() => buyShopBoost('power')}
      />
      <ItemCard
        title="Crash program"
        desc="×2 research rate for 15 minutes."
        cost={CONFIG.BOOST_RP_COST}
        affordable={credits >= CONFIG.BOOST_RP_COST}
        activeLabel={boosts.rpLeft > 0 ? `active ${formatTime(boosts.rpLeft)}` : undefined}
        onBuy={() => buyShopBoost('rp')}
      />
      <ItemCard
        title="Spinning reserve"
        desc="Instantly recharge Dispatch to 100%."
        cost={CONFIG.DISPATCH_RECHARGE_COST}
        affordable={credits >= CONFIG.DISPATCH_RECHARGE_COST && dispatch.charge < 1}
        activeLabel={dispatch.charge >= 1 ? 'already full' : undefined}
        onBuy={() => buyShopBoost('dispatch')}
      />

      <p className="px-1 text-[11px] leading-relaxed text-ink-dim">
        Credits come from circuit puzzles and the daily bonus. They never gate progression — they buy acceleration.
      </p>
    </div>
  );
}
