import type { GameState, Id, Num, PowerSource } from './types';
import { CONFIG } from '../content/config';
import {
  buyMaxCount,
  eraMult,
  globalMilestoneMult,
  prestigeMult,
  sourceCost,
  sourceMilestoneMult,
} from './formulas';
import { researchModifiers, type ResearchModifiers } from './research';
import { megaprojectMult } from './megaproject';

export function isSourceUnlocked(s: GameState, src: PowerSource, mods?: ResearchModifiers): boolean {
  const gate = src.unlockedBy;
  if (gate === undefined) return true;
  if (typeof gate === 'object') return s.tier >= gate.tier;
  if (mods) return mods.unlockedSources.has(src.id);
  return !!s.research[gate]?.purchased;
}

/** Output of one source line, before global multipliers. */
export function sourceOutput(src: PowerSource, mods: ResearchModifiers): Num {
  if (src.owned <= 0) return 0;
  return src.owned * src.baseOutput * sourceMilestoneMult(src.owned) * (mods.sourceMult[src.id] ?? 1);
}

/**
 * Multiplier order is fixed (ARCHITECTURE §7): per-source (milestones × research)
 * → global milestone → era → prestige → research global → megaproject rewards.
 */
export function powerPerSec(s: GameState, mods: ResearchModifiers = researchModifiers(s)): Num {
  let sum = 0;
  for (const src of Object.values(s.sources)) sum += sourceOutput(src, mods);
  return (
    sum *
    globalMilestoneMult(s.runPower) *
    eraMult(s.tier) *
    prestigeMult(s.kp) *
    mods.globalMult *
    megaprojectMult(s, mods)
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

/** Managers: automated sources buy one unit per tick while affordable. */
export function runAutomation(s: GameState): void {
  for (const src of Object.values(s.sources)) {
    if (!src.automated) continue;
    const cost = nextCost(src, 1);
    if (cost <= s.power) {
      s.power -= cost;
      src.owned += 1;
    }
  }
}

export interface DispatchResult {
  gained: Num;
  demand: number;
}

/** Active beat: ~30s cooldown burst worth 45s of output at a random demand spike. */
export function dispatch(s: GameState, now: number, rand: () => number = Math.random): DispatchResult | null {
  if (now < s.dispatchReadyAt) return null;
  const demand = 0.75 + rand() * 0.7;
  const gained = powerPerSec(s) * CONFIG.DISPATCH_SECONDS * demand;
  s.power += gained;
  s.runPower += gained;
  s.stats.lifetimePower += gained;
  s.dispatchReadyAt = now + CONFIG.DISPATCH_COOLDOWN_MS;
  return { gained, demand };
}
