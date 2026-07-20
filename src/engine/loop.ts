import type { GameState } from './types';
import { dispatchGeneration, powerPerSec, runAutomation, tickDispatch } from './economy';
import { applyStageDecommission } from './megaproject';
import { tickMarket } from './market';
import { researchModifiers, researchRate } from './research';
import { runSolvers } from './puzzle';
import { tickBoosts } from './shop';
import { checkAchievements } from './achievements';
import { tickAccretion, tickLaunchWindow } from './tierTwists';

/**
 * Advance the simulation by dt seconds. Pure state mutation — no React, no
 * clocks (rand is injectable for deterministic tests). Milestones and other
 * derived values are computed on read, not stored.
 */
export function tick(s: GameState, dt: number, rand: () => number = Math.random): void {
  const mods = researchModifiers(s);
  const pps = powerPerSec(s, mods);
  const gain = pps * dt;
  // Dispatch Board: generation flows across the Sell / Project / Grid rails
  // instead of banking as Watts. runPower/lifetimePower still count the full
  // generation (Kardashev progress is about total power produced).
  dispatchGeneration(s, gain, mods);
  applyStageDecommission(s, mods); // completing a stage dismantles some sources
  s.runPower += gain;
  s.stats.lifetimePower += gain;
  tickMarket(s, dt);
  s.rp += researchRate(s) * dt;
  runAutomation(s, mods);
  tickDispatch(s, dt, rand);
  runSolvers(s, dt);
  tickBoosts(s, dt);
  checkAchievements(s);
  tickLaunchWindow(s, dt, rand);
  tickAccretion(s, dt, pps);
}
