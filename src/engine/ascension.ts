import type { GameState } from './types';
import { CONFIG } from '../content/config';
import { kpGain, prestigeMult, sourceCost } from './formulas';
import { isMegaprojectComplete } from './megaproject';
import { reapplyPurchasedEffects } from './research';
import { newPuzzle } from './puzzle';
import { defaultTierTwistState } from './tierTwists';
import { getTier } from '../content/tiers';
import { buildSources } from '../content/sources';
import { buildMegaproject } from '../content/megaprojects';

export function canAscend(s: GameState): boolean {
  return isMegaprojectComplete(s);
}

export function projectedKp(s: GameState): number {
  return kpGain(s.runPower, getTier(s.tier).kpDivisor);
}

/** CR granted after ascending so the new tier's first purchase is reachable.
 *  (Sources cost CR since the Dispatch Board — seeding Watts would strand you.) */
function seedCredits(tier: number): number {
  const first = buildSources(tier)[0];
  return sourceCost(first.baseCost, first.costGrowth, 0, CONFIG.ASCEND_SEED_UNITS);
}

/**
 * Reset: sources, power, runPower, megaproject, current puzzle (per-run
 * milestones are derived, so they reset with runPower/owned). Keep: KP,
 * purchased research, RP, Credits, solvers, daily streak, stats.
 */
export function ascend(s: GameState, rand: () => number = Math.random): number {
  if (!canAscend(s)) return 0;
  const gained = projectedKp(s);
  s.kp += gained;
  s.tier += 1;
  s.power = 0; // the Watt bank is retired; the seed grant is CR now
  s.credits += seedCredits(s.tier);
  s.runPower = 0;
  s.sources = {};
  for (const src of buildSources(s.tier)) s.sources[src.id] = src;
  // Scale the new build with the prestige you just banked, so it stays a gate.
  s.megaproject = buildMegaproject(s.tier, prestigeMult(s.kp));
  s.puzzle = newPuzzle(s.tier, rand);
  s.grid = { vLevel: 0, aLevel: 0, rLevel: 0 }; // infrastructure is rebuilt each era
  Object.assign(s, defaultTierTwistState()); // tier twists are era-scoped too
  s.stats.ascensions += 1;
  reapplyPurchasedEffects(s); // restore managers for any automation research
  return gained;
}
