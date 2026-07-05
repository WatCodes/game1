import { CONFIG } from '../content/config';
import type { GameState, Num } from './types';
import { offlineSeconds } from './formulas';
import { powerPerSec } from './economy';
import { routeIncome } from './megaproject';
import { researchModifiers } from './research';

export interface OfflineSummary {
  seconds: number;
  powerGained: Num;
  projectGained: Num;
}

export function offlineCap(s: GameState): number {
  return CONFIG.OFFLINE_CAP_SECONDS + researchModifiers(s).offlineBonusSeconds;
}

/**
 * Credit elapsed real time since the last save, capped. Advances lastSaved so a
 * second call cannot double-credit. Returns null for gaps too short to matter.
 */
export function creditOffline(s: GameState, nowMs: number): OfflineSummary | null {
  const elapsed = offlineSeconds(nowMs - s.lastSaved, offlineCap(s));
  s.lastSaved = nowMs;
  if (elapsed < CONFIG.OFFLINE_MIN_SECONDS) return null;
  const mods = researchModifiers(s);
  const gain = powerPerSec(s, mods) * elapsed;
  if (gain <= 0) return null;
  const routed = routeIncome(s, gain, mods);
  s.power += gain - routed;
  s.runPower += gain;
  s.stats.lifetimePower += gain;
  return { seconds: elapsed, powerGained: gain - routed, projectGained: routed };
}
