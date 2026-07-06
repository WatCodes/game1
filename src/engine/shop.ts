import { CONFIG } from '../content/config';
import type { GameState, Num } from './types';

/** Local calendar day, e.g. "2026-7-6" — daily rewards reset at local midnight. */
export function dayKey(nowMs: number): string {
  const d = new Date(nowMs);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function canClaimDaily(s: GameState, nowMs: number): boolean {
  return s.daily.lastClaimDay !== dayKey(nowMs);
}

/** Reward for a given streak day (1-based): 7-day cycle, +10% per completed week. */
export function dailyReward(streak: number): Num {
  const table = CONFIG.DAILY_REWARDS;
  const idx = (streak - 1) % table.length;
  const weeks = Math.floor((streak - 1) / table.length);
  return Math.round(table[idx] * (1 + CONFIG.DAILY_STREAK_BONUS * weeks));
}

/** Claim today's reward. Consecutive days grow the streak; a miss resets it. */
export function claimDaily(s: GameState, nowMs: number): Num {
  if (!canClaimDaily(s, nowMs)) return 0;
  const yesterday = dayKey(nowMs - 86_400_000);
  s.daily.streak = s.daily.lastClaimDay === yesterday ? s.daily.streak + 1 : 1;
  s.daily.lastClaimDay = dayKey(nowMs);
  const reward = dailyReward(s.daily.streak);
  s.credits += reward;
  return reward;
}

export function solverCost(owned: number): Num {
  return Math.round(CONFIG.SOLVER_BASE_COST * Math.pow(CONFIG.SOLVER_COST_GROWTH, owned));
}

export function buySolver(s: GameState): boolean {
  const cost = solverCost(s.solvers);
  if (s.credits < cost) return false;
  s.credits -= cost;
  s.solvers += 1;
  return true;
}

export function buyPowerBoost(s: GameState): boolean {
  if (s.credits < CONFIG.BOOST_POWER_COST) return false;
  s.credits -= CONFIG.BOOST_POWER_COST;
  s.boosts.powerLeft += CONFIG.BOOST_SECONDS;
  return true;
}

export function buyRpBoost(s: GameState): boolean {
  if (s.credits < CONFIG.BOOST_RP_COST) return false;
  s.credits -= CONFIG.BOOST_RP_COST;
  s.boosts.rpLeft += CONFIG.BOOST_SECONDS;
  return true;
}

export function buyDispatchRecharge(s: GameState): boolean {
  if (s.credits < CONFIG.DISPATCH_RECHARGE_COST || s.dispatch.charge >= 1) return false;
  s.credits -= CONFIG.DISPATCH_RECHARGE_COST;
  s.dispatch.charge = 1;
  return true;
}

/** Global output multiplier from active surge + shop boost. */
export function boostPowerMult(s: GameState): number {
  return (s.boosts.surgeLeft > 0 ? CONFIG.SURGE_MULT : 1) * (s.boosts.powerLeft > 0 ? CONFIG.BOOST_MULT : 1);
}

export function boostRpMult(s: GameState): number {
  return s.boosts.rpLeft > 0 ? CONFIG.BOOST_MULT : 1;
}

/** Count down all boost timers (called from tick). */
export function tickBoosts(s: GameState, dt: number): void {
  s.boosts.surgeLeft = Math.max(0, s.boosts.surgeLeft - dt);
  s.boosts.powerLeft = Math.max(0, s.boosts.powerLeft - dt);
  s.boosts.rpLeft = Math.max(0, s.boosts.rpLeft - dt);
}
