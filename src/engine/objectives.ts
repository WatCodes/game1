import type { GameState } from './types';
import { CONFIG } from '../content/config';
import { formatPower } from './format';
import { isUnlocked } from './unlocks';
import { generationPerSec } from './economy';
import { transmissionCap } from './grid';
import { canAuthorizeStage, isMegaprojectComplete, nextStageResearchBlock } from './megaproject';

/**
 * The single "what now?" line. Idle games lose people in the first session by
 * being directionless, not by being shallow — so there is always exactly one
 * next goal, and it walks the player through the same beats progressive
 * disclosure unlocks (GAME_DESIGN §3.16).
 *
 * Pure and derived: no stored quest state, nothing to migrate, and it can never
 * drift out of sync with the systems it points at.
 */
export interface Objective {
  id: string;
  text: string;
}

export function nextObjective(s: GameState): Objective | null {
  const sources = Object.values(s.sources);
  const owned = sources.reduce((n, src) => n + src.owned, 0);
  const first = sources[0];

  if (first && owned === 0) {
    return { id: 'first-source', text: `Put a ${first.name} to work` };
  }
  if (owned < 5) {
    return { id: 'grow', text: `Grow the colony — ${owned}/5 generators` };
  }
  if (!Object.values(s.research).some((n) => n.purchased)) {
    return { id: 'first-research', text: 'Open the Lab and buy your first research' };
  }
  if (!isUnlocked(s, 'board')) {
    return {
      id: 'unlock-board',
      text: `Generate ${formatPower(CONFIG.UNLOCK_BOARD_POWER)} in total to open the Dispatch Board`,
    };
  }
  // A stranded grid is the most urgent thing on the board: generation keeps
  // climbing but delivered power flatlines at the cap, and nothing else the
  // player buys moves the headline number. The engine already knows the grid is
  // the binding constraint ("which number is red"); surface it as the next step
  // once Transmission is on screen and a real slice is being wasted, so a capped
  // player is told to upgrade the grid instead of watching the number stall.
  if (isUnlocked(s, 'transmission')) {
    const gen = generationPerSec(s);
    if (gen > transmissionCap(s) * (1 + CONFIG.GRID_STRANDED_HINT_FRACTION)) {
      return { id: 'upgrade-grid', text: 'Your grid is maxed — upgrade Transmission to carry more power' };
    }
  }
  if (isMegaprojectComplete(s)) {
    return { id: 'ascend', text: `${s.megaproject.name} is finished — ascend` };
  }
  if (s.megaproject.committed <= 0) {
    return { id: 'route', text: `Route power to ${s.megaproject.name} on the Dispatch Board` };
  }
  const blocked = nextStageResearchBlock(s);
  if (blocked) {
    return { id: 'stage-research', text: `Research ${s.research[blocked]?.name ?? blocked} to unlock the next stage` };
  }
  if (canAuthorizeStage(s)) {
    return { id: 'authorize', text: `Authorize the next stage of ${s.megaproject.name}` };
  }
  if (!isUnlocked(s, 'transmission')) {
    return {
      id: 'unlock-transmission',
      text: `Generate ${formatPower(CONFIG.UNLOCK_TRANSMISSION_POWER)} in total to bring Transmission online`,
    };
  }
  return { id: 'build', text: `Finish ${s.megaproject.name}` };
}
