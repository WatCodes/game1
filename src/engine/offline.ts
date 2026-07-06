import { CONFIG } from '../content/config';
import type { GameState, Num } from './types';
import { offlineSeconds } from './formulas';
import { powerPerSec } from './economy';
import { routeIncome } from './megaproject';
import { researchModifiers } from './research';
import { runSolvers } from './puzzle';
import { tickBoosts } from './shop';

export interface OfflineSummary {
  seconds: number;
  powerGained: Num;
  projectGained: Num;
  creditsGained: Num;
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
 * 4-hour window, then power is credited, then auto-solvers grind their capped
 * share of circuits (their fresh surge applies to future play, not this window).
 */
export function creditOffline(s: GameState, nowMs: number): OfflineSummary | null {
  const elapsed = offlineSeconds(nowMs - s.lastSaved, offlineCap(s));
  s.lastSaved = nowMs;
  if (elapsed < CONFIG.OFFLINE_MIN_SECONDS) return null;
  tickBoosts(s, elapsed);
  const mods = researchModifiers(s);
  const gain = powerPerSec(s, mods) * elapsed;
  const routed = routeIncome(s, gain, mods);
  s.power += gain - routed;
  s.runPower += gain;
  s.stats.lifetimePower += gain;
  const creditsBefore = s.credits;
  const solvedBefore = s.stats.puzzlesSolved;
  runSolvers(s, elapsed);
  const summary: OfflineSummary = {
    seconds: elapsed,
    powerGained: gain - routed,
    projectGained: routed,
    creditsGained: s.credits - creditsBefore,
    puzzlesSolved: s.stats.puzzlesSolved - solvedBefore,
  };
  return gain > 0 || summary.creditsGained > 0 ? summary : null;
}
