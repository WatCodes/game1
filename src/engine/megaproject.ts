import type { GameState, Id, Num } from './types';
import { researchModifiers, type ResearchModifiers } from './research';

/** Total power cost after research reductions. */
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

// ---------------------------------------------------------------------------
// Stage authorization: stage 1 is free; stages 2..n must each be authorized
// with RP, and some stages also require the tier's key research. Power cannot
// fill past the last authorized stage, so raw income can never rush the gate.
// ---------------------------------------------------------------------------

/** RP price to authorize one stage (total rpCost split across stages 2..n). */
export function stageRpCost(s: GameState): Num {
  const n = s.megaproject.stages.length;
  return n > 1 ? s.megaproject.rpCost / (n - 1) : 0;
}

/** Power boundary that committed progress is clamped to. */
export function authorizedBoundary(s: GameState, mods?: ResearchModifiers): Num {
  const n = s.megaproject.stages.length;
  return effectiveCost(s, mods) * (Math.min(s.megaproject.stagesAuthorized, n) / n);
}

/** Research id blocking the next stage, if any. */
export function nextStageResearchBlock(s: GameState): Id | null {
  const idx = s.megaproject.stagesAuthorized; // next stage's 0-based index
  if (idx >= s.megaproject.stages.length) return null;
  const req = s.megaproject.stageResearch[idx] ?? null;
  if (req && !s.research[req]?.purchased) return req;
  return null;
}

export function canAuthorizeStage(s: GameState): boolean {
  return (
    s.megaproject.stagesAuthorized < s.megaproject.stages.length &&
    nextStageResearchBlock(s) === null &&
    s.rp >= stageRpCost(s)
  );
}

/** Pay RP to clear the next stage for construction. */
export function authorizeStage(s: GameState): boolean {
  if (!canAuthorizeStage(s)) return false;
  s.rp -= stageRpCost(s);
  s.megaproject.stagesAuthorized += 1;
  return true;
}

/** Lump-sum deposit from stored power. Returns the amount actually committed. */
export function commitPower(s: GameState, amount: Num, mods?: ResearchModifiers): Num {
  const remaining = authorizedBoundary(s, mods) - s.megaproject.committed;
  const commit = Math.max(0, Math.min(amount, s.power, remaining));
  if (commit <= 0) return 0;
  s.power -= commit;
  s.megaproject.committed += commit;
  return commit;
}

/** Route a share of fresh income into construction (called from tick). */
export function routeIncome(s: GameState, gain: Num, mods: ResearchModifiers): Num {
  if (s.routePct <= 0) return 0;
  const remaining = authorizedBoundary(s, mods) - s.megaproject.committed;
  if (remaining <= 0) return 0;
  const routed = Math.min(gain * s.routePct, remaining);
  s.megaproject.committed += routed;
  return routed;
}
