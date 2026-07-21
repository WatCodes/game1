import type { GameState } from './types';
import { CONFIG } from '../content/config';

/**
 * Progressive disclosure (GAME_DESIGN §3.16). The game opens as "buy a thing,
 * watch the number rise" and layers systems on one at a time.
 *
 * Gating is on **lifetime** power, so it's derived (no save field), monotonic,
 * and permanent — once you've learned a system it never hides again, including
 * across ascensions. Crucially each feature is *inert* until it unlocks, not
 * merely invisible: a new player can never be penalised by a mechanic that
 * isn't on screen yet.
 */
export type Feature = 'board' | 'gridDemand' | 'transmission';

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

export function unlockThreshold(f: Feature): number {
  switch (f) {
    case 'board':
      return CONFIG.UNLOCK_BOARD_POWER;
    case 'gridDemand':
      return CONFIG.UNLOCK_GRID_DEMAND_POWER;
    case 'transmission':
      return CONFIG.UNLOCK_TRANSMISSION_POWER;
  }
}

export function isUnlocked(s: GameState, f: Feature): boolean {
  return s.stats.lifetimePower >= unlockThreshold(f);
}

/**
 * Before the Dispatch Board exists there is nothing to trade against, so all
 * generation sells — otherwise a new player would have no income at all.
 */
export function effectiveSellPct(s: GameState): number {
  return isUnlocked(s, 'board') ? clamp01(s.sellPct) : 1;
}

/** The Project rail can't claim anything until the Board introduces it. */
export function effectiveRoutePct(s: GameState): number {
  return isUnlocked(s, 'board') ? clamp01(s.routePct) : 0;
}
