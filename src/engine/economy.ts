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
import { authorizedBoundary, megaprojectMult } from './megaproject';
import { boostPowerMult } from './shop';
import { achievementMult } from './achievements';

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
 * Multiplier order is fixed (ARCHITECTURE §7): per-source (milestones × research
 * − upkeep) → global milestone → era → prestige → research global → megaproject
 * → surge/shop boosts.
 */
export function powerPerSec(s: GameState, mods: ResearchModifiers = researchModifiers(s)): Num {
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
    achievementMult(s)
  );
}

export function nextCost(src: PowerSource, count = 1): Num {
  return sourceCost(src.baseCost, src.costGrowth, src.owned, count);
}

export function maxAffordable(src: PowerSource, budget: Num): number {
  return buyMaxCount(src.baseCost, src.costGrowth, src.owned, budget);
}

/** Buy `count` units ('max' solves the geometric sum). Returns units bought. */
export function buy(s: GameState, sourceId: Id, count: number | 'max'): number {
  const src = s.sources[sourceId];
  if (!src || !isSourceUnlocked(s, src)) return 0;
  const n = count === 'max' ? maxAffordable(src, s.power) : count;
  if (n <= 0) return 0;
  const cost = nextCost(src, n);
  if (cost > s.power) return 0;
  s.power -= cost;
  src.owned += n;
  return n;
}

/**
 * Managers: automated sources buy one unit per tick while affordable — but
 * never past the efficient band (they stop when the next unit would curtail).
 */
export function runAutomation(s: GameState, mods: ResearchModifiers = researchModifiers(s)): void {
  for (const src of Object.values(s.sources)) {
    if (!src.automated) continue;
    if (nextUnitNet(src, mods) <= 0) continue;
    const cost = nextCost(src, 1);
    if (cost <= s.power) {
      s.power -= cost;
      src.owned += 1;
    }
  }
}

/** Cheapest next unit among unlocked sources — the anti-softlock reserve. */
export function cheapestNextCost(s: GameState, mods: ResearchModifiers = researchModifiers(s)): Num {
  let min = Infinity;
  for (const src of Object.values(s.sources)) {
    if (!isSourceUnlocked(s, src, mods)) continue;
    min = Math.min(min, nextCost(src, 1));
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
  gained: Num;
  demand: number;
  peak: boolean;
}

/**
 * Fire the dispatch surge. Charge builds in tick; firing early is weak, full
 * charge is strong, and inside a peak-demand window it's ×PEAK_MULT.
 */
export function fireDispatch(s: GameState, rand: () => number = Math.random): DispatchResult | null {
  if (s.dispatch.charge < CONFIG.DISPATCH_MIN_CHARGE) return null;
  const demand = 0.9 + rand() * 0.3;
  const peak = s.dispatch.peakLeft > 0;
  const gained =
    powerPerSec(s) * CONFIG.DISPATCH_SECONDS * s.dispatch.charge * demand * (peak ? CONFIG.PEAK_MULT : 1);
  if (gained <= 0) return null;
  s.power += gained;
  s.runPower += gained;
  s.stats.lifetimePower += gained;
  s.dispatch.charge = 0;
  return { gained, demand, peak };
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
