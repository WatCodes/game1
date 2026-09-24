import { CONFIG } from '../content/config';
import type { GameState, Num } from './types';
import { offlineSeconds } from './formulas';
import { dispatchGeneration, powerPerSec } from './economy';
import { applyStageDecommission } from './megaproject';
import { tickMarket } from './market';
import { researchModifiers, researchRate } from './research';
import { runSolvers } from './puzzle';
import { tickBoosts } from './shop';

export interface OfflineSummary {
  seconds: number;
  powerGained: Num;
  projectGained: Num;
  creditsGained: Num;
  rpGained: Num;
  puzzlesSolved: number;
}

export function offlineCap(s: GameState): number {
  return CONFIG.OFFLINE_CAP_SECONDS + researchModifiers(s).offlineBonusSeconds;
}

/**
 * Credit elapsed real time since the last save, capped. Advances lastSaved so a
 * second call cannot double-credit. Returns null for gaps too short to matter.
 *
 * Order matters: boost timers expire first so a 15-min boost can't multiply a
 * 4-hour window, then generation is split across the Dispatch Board rails
 * (Sell → CR, Project → committed), then auto-solvers grind their capped share
 * of boards (their fresh surge applies to future play, not this window).
 */
export function creditOffline(s: GameState, nowMs: number): OfflineSummary | null {
  const elapsed = offlineSeconds(nowMs - s.lastSaved, offlineCap(s));
  s.lastSaved = nowMs;
  if (elapsed < CONFIG.OFFLINE_MIN_SECONDS) return null;
  tickBoosts(s, elapsed);
  const mods = researchModifiers(s);
  const creditsBefore = s.credits;
  const solvedBefore = s.stats.puzzlesSolved;
  const gain = powerPerSec(s, mods) * elapsed;
  // Research accrues while away, at a reduced share of the live rate. The rate is
  // read *before* the rails run so a window cannot pay RP on research bought
  // during the same window.
  const rpGained = researchRate(s) * CONFIG.OFFLINE_RP_RATE * elapsed;
  s.rp += rpGained;
  // Same three-rail split as the live loop; the Sell rail sells the whole
  // window at the price on return, then the market settles to the new share.
  const { routed } = dispatchGeneration(s, gain, mods);
  applyStageDecommission(s, mods); // stages an away window completes still cost sources
  s.runPower += gain;
  s.stats.lifetimePower += gain;
  tickMarket(s, elapsed);
  runSolvers(s, elapsed);
  const summary: OfflineSummary = {
    seconds: elapsed,
    powerGained: gain, // total generated while away (informational)
    projectGained: routed,
    creditsGained: s.credits - creditsBefore, // Sell rail + auto-solver income
    rpGained,
    puzzlesSolved: s.stats.puzzlesSolved - solvedBefore,
  };
  // RP counts as a reason to show the summary: a parked save with no generation
  // still banks research, and silently swallowing it is the bug this replaced.
  return gain > 0 || summary.creditsGained > 0 || rpGained > 0 ? summary : null;
}
