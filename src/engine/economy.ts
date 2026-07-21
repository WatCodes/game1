import type { GameState, Id, Num, PowerSource } from './types';
import { CONFIG } from '../content/config';
import {
  buyMaxCount,
  eraMult,
  globalMilestoneMult,
  prestigeMult,
  sourceCost,
  sourceMilestoneMult,
  upkeepFor,
} from './formulas';
import { researchModifiers, type ResearchModifiers } from './research';
import { authorizedBoundary, megaprojectMult, routeIncome } from './megaproject';
import { boostPowerMult } from './shop';
import { achievementMult } from './achievements';
import { deliverPower } from './grid';
import { launchCostMult } from './tierTwists';
import { brownoutMult, gridPrice } from './market';
import { effectiveRoutePct, effectiveSellPct } from './unlocks';

export function isSourceUnlocked(s: GameState, src: PowerSource, mods?: ResearchModifiers): boolean {
  const gate = src.unlockedBy;
  if (gate === undefined) return true;
  if (typeof gate === 'object') return s.tier >= gate.tier;
  if (mods) return mods.unlockedSources.has(src.id);
  return !!s.research[gate]?.purchased;
}

/** Gross W/s of one source line, before upkeep and global multipliers. */
export function sourceGross(src: PowerSource, mods: ResearchModifiers, owned = src.owned): Num {
  if (owned <= 0) return 0;
  return owned * src.baseOutput * sourceMilestoneMult(owned) * (mods.sourceMult[src.id] ?? 1);
}

/** Fuel/maintenance drag on one source line. */
export function sourceUpkeep(src: PowerSource, mods: ResearchModifiers, owned = src.owned): Num {
  return upkeepFor(src.baseUpkeep, owned, mods.upkeepMult);
}

/**
 * Net W/s of one source line. Floors at zero ("fully curtailed") — an
 * overbought source idles instead of draining the grid, so upkeep can never
 * softlock a run.
 */
export function sourceNet(src: PowerSource, mods: ResearchModifiers, owned = src.owned): Num {
  return Math.max(0, sourceGross(src, mods, owned) - sourceUpkeep(src, mods, owned));
}

/**
 * Exact net change from buying one more unit (milestone crossings included).
 * Negative means the next unit curtails — the "stop buying" signal.
 */
export function nextUnitNet(src: PowerSource, mods: ResearchModifiers): Num {
  return sourceNet(src, mods, src.owned + 1) - sourceNet(src, mods);
}

/**
 * Gross generation. Multiplier order is fixed (ARCHITECTURE §7): per-source
 * (milestones × research − upkeep) → global milestone → era → prestige →
 * research global → megaproject → surge/shop boosts → records → brownout.
 * The brownout factor (last) throttles output when the Grid rail is starved
 * below the demand floor — it self-limits, since lower output lowers demand.
 */
export function generationPerSec(s: GameState, mods: ResearchModifiers = researchModifiers(s)): Num {
  let sum = 0;
  for (const src of Object.values(s.sources)) sum += sourceNet(src, mods);
  return (
    sum *
    globalMilestoneMult(s.runPower) *
    eraMult(s.tier) *
    prestigeMult(s.kp) *
    mods.globalMult *
    megaprojectMult(s, mods) *
    boostPowerMult(s) *
    achievementMult(s) *
    brownoutMult(s, mods.demandMult)
  );
}

/**
 * What actually lands in the bank: generation clamped to the transmission
 * cap (V×A), minus I²R losses. The three-lane bottleneck (GAME_DESIGN §3.13).
 */
export function powerPerSec(s: GameState, mods: ResearchModifiers = researchModifiers(s)): Num {
  return deliverPower(s, generationPerSec(s, mods));
}

/** `costMult` carries the T3 launch-window surcharge (1 everywhere else). */
export function nextCost(src: PowerSource, count = 1, costMult = 1): Num {
  return sourceCost(src.baseCost * costMult, src.costGrowth, src.owned, count);
}

/**
 * Delivered W/s the grid would gain from buying `count` more of a source —
 * the honest headline delta (includes milestone ×2 crossings, all global
 * multipliers, and the transmission cap/losses). Temporarily bumps owned and
 * restores it; safe because buildDisplay is synchronous.
 */
export function deliveredGain(
  s: GameState,
  src: PowerSource,
  count: number,
  mods: ResearchModifiers = researchModifiers(s),
): Num {
  if (count <= 0) return 0;
  const before = powerPerSec(s, mods);
  const saved = src.owned;
  src.owned += count;
  const after = powerPerSec(s, mods);
  src.owned = saved;
  return Math.max(0, after - before);
}

export function maxAffordable(src: PowerSource, budget: Num, costMult = 1): number {
  return buyMaxCount(src.baseCost * costMult, src.costGrowth, src.owned, budget);
}

export interface DispatchSplit {
  routed: Num; // W routed into the megaproject
  sold: Num; // W sold to the market (Sell rail + any project overflow)
  sellCredits: Num; // CR minted from the sale
}

/**
 * Split a slab of fresh generation across the three Dispatch Board rails and
 * apply the effects: Sell → CR (plus any project overflow that couldn't be
 * committed), Project → committed, Grid → demand (already priced into brownout
 * upstream, so the grid share simply isn't monetized). The single source of
 * truth for both the live loop and offline crediting.
 */
export function dispatchGeneration(
  s: GameState,
  gain: Num,
  mods: ResearchModifiers = researchModifiers(s),
): DispatchSplit {
  const sellPct = effectiveSellPct(s);
  const intendedProject = gain * effectiveRoutePct(s);
  const routed = routeIncome(s, gain, mods); // clamps to routePct AND the authorized boundary
  const overflow = Math.max(0, intendedProject - routed);
  const sold = gain * sellPct + overflow;
  const sellCredits = sold * gridPrice(s) * mods.creditMult;
  s.credits += sellCredits;
  return { routed, sold, sellCredits };
}

/** Buy `count` units ('max' solves the geometric sum). Costs are paid in CR
 *  (the Dispatch Board sells power for CR; CR is what you spend). */
export function buy(s: GameState, sourceId: Id, count: number | 'max'): number {
  const src = s.sources[sourceId];
  if (!src || !isSourceUnlocked(s, src)) return 0;
  const mult = launchCostMult(s);
  const n = count === 'max' ? maxAffordable(src, s.credits, mult) : count;
  if (n <= 0) return 0;
  const cost = nextCost(src, n, mult);
  if (cost > s.credits) return 0;
  s.credits -= cost;
  src.owned += n;
  return n;
}

/**
 * Managers: automated sources buy one unit per tick while affordable — but
 * never past the efficient band (they stop when the next unit would curtail).
 * They still buy off-window at T3, just at the surcharged price — automation
 * never hits a hard wall, only reduced efficiency.
 */
export function runAutomation(s: GameState, mods: ResearchModifiers = researchModifiers(s)): void {
  const mult = launchCostMult(s);
  for (const src of Object.values(s.sources)) {
    if (!src.automated || src.autoPaused) continue;
    if (nextUnitNet(src, mods) <= 0) continue;
    const cost = nextCost(src, 1, mult);
    if (cost <= s.credits) {
      s.credits -= cost;
      src.owned += 1;
    }
  }
}

/** Cheapest next unit among unlocked sources — the anti-softlock reserve. */
export function cheapestNextCost(s: GameState, mods: ResearchModifiers = researchModifiers(s)): Num {
  const mult = launchCostMult(s);
  let min = Infinity;
  for (const src of Object.values(s.sources)) {
    if (!isSourceUnlocked(s, src, mods)) continue;
    min = Math.min(min, nextCost(src, 1, mult));
  }
  return isFinite(min) ? min : 0;
}

/**
 * The most power that can be committed to the megaproject right now without
 * bricking the run: with no income, always keep enough for one cheapest source.
 */
export function maxSafeCommit(s: GameState, mods: ResearchModifiers = researchModifiers(s)): Num {
  const remaining = Math.max(0, authorizedBoundary(s, mods) - s.megaproject.committed);
  let limit = Math.min(s.power, remaining);
  if (powerPerSec(s, mods) <= 0) {
    limit = Math.min(limit, s.power - cheapestNextCost(s, mods));
  }
  return Math.max(0, limit);
}

export interface DispatchResult {
  gained: Num; // power burst dispatched (W)
  creditsGained: Num; // CR earned selling that burst at the current grid price
  demand: number;
  peak: boolean;
}

/**
 * Fire the dispatch surge: a burst of power sold straight to the grid for CR.
 * Charge builds in tick; firing early is weak, full charge is strong, and
 * inside a peak-demand window it's ×PEAK_MULT. The burst still counts toward
 * lifetime/run power (it was generated), but pays out as cash, not a Watt bank.
 */
export function fireDispatch(s: GameState, rand: () => number = Math.random): DispatchResult | null {
  if (s.dispatch.charge < CONFIG.DISPATCH_MIN_CHARGE) return null;
  const demand = 0.9 + rand() * 0.3;
  const peak = s.dispatch.peakLeft > 0;
  const gained =
    powerPerSec(s) * CONFIG.DISPATCH_SECONDS * s.dispatch.charge * demand * (peak ? CONFIG.PEAK_MULT : 1);
  if (gained <= 0) return null;
  const creditsGained = gained * gridPrice(s);
  s.credits += creditsGained;
  s.runPower += gained;
  s.stats.lifetimePower += gained;
  s.dispatch.charge = 0;
  return { gained, creditsGained, demand, peak };
}

/** Advance dispatch charge and the peak-demand window clock by dt seconds. */
export function tickDispatch(s: GameState, dt: number, rand: () => number = Math.random): void {
  const d = s.dispatch;
  d.charge = Math.min(1, d.charge + dt / CONFIG.DISPATCH_CHARGE_SECONDS);
  if (d.peakLeft > 0) {
    d.peakLeft = Math.max(0, d.peakLeft - dt);
  } else {
    d.nextPeakIn -= dt;
    if (d.nextPeakIn <= 0) {
      d.peakLeft = CONFIG.PEAK_DURATION_SECONDS;
      d.nextPeakIn =
        CONFIG.PEAK_GAP_MIN_SECONDS + rand() * (CONFIG.PEAK_GAP_MAX_SECONDS - CONFIG.PEAK_GAP_MIN_SECONDS);
    }
  }
}
