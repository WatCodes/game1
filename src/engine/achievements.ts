import { CONFIG } from '../content/config';
import { ACHIEVEMENTS } from '../content/achievements';
import type { GameState } from './types';

/** Permanent global multiplier from earned records. */
export function achievementMult(s: GameState): number {
  return 1 + s.achievements.length * CONFIG.ACHIEVEMENT_BONUS;
}

/** Scan for newly satisfied achievements; earn them and return their ids. */
export function checkAchievements(s: GameState): string[] {
  const earned = new Set(s.achievements);
  const fresh: string[] = [];
  for (const def of ACHIEVEMENTS) {
    if (!earned.has(def.id) && def.check(s)) {
      s.achievements.push(def.id);
      fresh.push(def.id);
    }
  }
  return fresh;
}
