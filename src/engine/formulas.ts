import { CONFIG } from '../content/config';
import type { Num } from './types';

const EPS = 1e-9; // absorbs float error at exact milestone boundaries

/** Total cost of buying `count` units when `owned` are already held (geometric series). */
export function sourceCost(baseCost: Num, costGrowth: number, owned: number, count = 1): Num {
  if (count <= 0) return 0;
  const first = baseCost * Math.pow(costGrowth, owned);
  return (first * (Math.pow(costGrowth, count) - 1)) / (costGrowth - 1);
}

/** Largest affordable purchase count given `budget` power. Inverse of sourceCost. */
export function buyMaxCount(baseCost: Num, costGrowth: number, owned: number, budget: Num): number {
  const first = baseCost * Math.pow(costGrowth, owned);
  if (budget < first) return 0;
  let n = Math.floor(Math.log((budget * (costGrowth - 1)) / first + 1) / Math.log(costGrowth) + EPS);
  // float error can overshoot by one at exact boundaries — verify and back off
  while (n > 0 && sourceCost(baseCost, costGrowth, owned, n) > budget + EPS) n--;
  return n;
}

/** How many count-milestones a source with `owned` units has passed. */
export function sourceMilestoneCount(owned: number): number {
  const table = CONFIG.SOURCE_MILESTONES;
  let count = 0;
  for (const t of table) if (owned >= t) count++;
  const last = table[table.length - 1];
  if (owned > last) count += Math.floor((owned - last) / CONFIG.SOURCE_MILESTONE_STEP_AFTER);
  return count;
}

/** Output multiplier from count-milestones (×2 each). */
export function sourceMilestoneMult(owned: number): number {
  return Math.pow(CONFIG.SOURCE_MILESTONE_MULT, sourceMilestoneCount(owned));
}

/** The next owned-count threshold, for the "N to ×2" hint. */
export function nextSourceMilestone(owned: number): number {
  for (const t of CONFIG.SOURCE_MILESTONES) if (owned < t) return t;
  const last = CONFIG.SOURCE_MILESTONES[CONFIG.SOURCE_MILESTONES.length - 1];
  const step = CONFIG.SOURCE_MILESTONE_STEP_AFTER;
  return last + (Math.floor((owned - last) / step) + 1) * step;
}

/** Global milestones: every ×1000 of run-power grants ×1.6 (GAME_DESIGN §3.5). */
export function globalMilestoneCount(runPower: Num): number {
  const step = CONFIG.GLOBAL_MILESTONE_STEP;
  if (runPower < step) return 0;
  return Math.floor(Math.log(runPower / step) / Math.log(step) + EPS) + 1;
}

export function globalMilestoneMult(runPower: Num): number {
  return Math.pow(CONFIG.GLOBAL_MILESTONE_MULT, globalMilestoneCount(runPower));
}

/** Run-power needed for the next global milestone. */
export function nextGlobalMilestone(runPower: Num): Num {
  const step = CONFIG.GLOBAL_MILESTONE_STEP;
  return Math.pow(step, globalMilestoneCount(runPower) + 1);
}

/** Era baseline: ×4 global per tier climbed. */
export function eraMult(tier: number): number {
  return Math.pow(CONFIG.ERA_MULT_BASE, tier);
}

/** Permanent global multiplier from banked Kardashev Points. */
export function prestigeMult(kp: number): number {
  return 1 + kp * CONFIG.KP_RATE;
}

/** KP paid out on ascension (GAME_DESIGN §3.4). */
export function kpGain(runPower: Num, kpDivisor: Num): number {
  if (runPower <= 0) return 0;
  return Math.floor(CONFIG.KP_GAIN_K * Math.sqrt(runPower / kpDivisor));
}

/** Seconds of offline progress to credit, clamped to the cap. */
export function offlineSeconds(elapsedMs: number, capSeconds: number): number {
  return Math.max(0, Math.min(elapsedMs / 1000, capSeconds));
}
