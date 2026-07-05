import type { GameState, Num } from './types';
import { researchModifiers, type ResearchModifiers } from './research';

/** Total cost after research reductions. */
export function effectiveCost(s: GameState, mods: ResearchModifiers = researchModifiers(s)): Num {
  return s.megaproject.totalCost * mods.megaCostMult;
}

export function megaprojectProgress(s: GameState, mods?: ResearchModifiers): number {
  const total = effectiveCost(s, mods);
  return total <= 0 ? 1 : Math.min(1, s.megaproject.committed / total);
}

export function stagesCompleted(s: GameState, mods?: ResearchModifiers): number {
  const n = s.megaproject.stages.length;
  return Math.min(n, Math.floor(megaprojectProgress(s, mods) * n + 1e-9));
}

export function isMegaprojectComplete(s: GameState, mods?: ResearchModifiers): boolean {
  return megaprojectProgress(s, mods) >= 1;
}

/** Stage rewards compound as stages fill; completion adds its own multiplier. */
export function megaprojectMult(s: GameState, mods?: ResearchModifiers): number {
  const done = stagesCompleted(s, mods);
  let mult = 1;
  for (let i = 0; i < done; i++) mult *= s.megaproject.stages[i].reward;
  if (isMegaprojectComplete(s, mods)) mult *= s.megaproject.completionReward;
  return mult;
}

/** Lump-sum deposit from stored power. Returns the amount actually committed. */
export function commitPower(s: GameState, amount: Num): Num {
  const remaining = effectiveCost(s) - s.megaproject.committed;
  const commit = Math.max(0, Math.min(amount, s.power, remaining));
  if (commit <= 0) return 0;
  s.power -= commit;
  s.megaproject.committed += commit;
  return commit;
}

/** Route a share of fresh income into construction (called from tick). */
export function routeIncome(s: GameState, gain: Num, mods: ResearchModifiers): Num {
  if (s.routePct <= 0 || isMegaprojectComplete(s, mods)) return 0;
  const remaining = effectiveCost(s, mods) - s.megaproject.committed;
  const routed = Math.min(gain * s.routePct, remaining);
  s.megaproject.committed += routed;
  return routed;
}
