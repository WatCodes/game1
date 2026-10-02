import type { GameState } from './types';
import { CONFIG } from '../content/config';

/**
 * What this save would post to each Game Center leaderboard. Design:
 * docs/GAME_CENTER.md.
 *
 * Pure and integer-valued: Game Center scores are int64. A score of 0 means
 * "nothing to post yet" — nobody should appear on a board for having done
 * nothing, so a player shows up once they've ascended.
 */
export interface LeaderboardScores {
  [id: string]: number;
}

const whole = (n: number): number =>
  Number.isFinite(n) ? Math.min(Number.MAX_SAFE_INTEGER, Math.floor(Math.max(0, n))) : 0;

export function leaderboardScores(s: GameState): LeaderboardScores {
  return {
    [CONFIG.LEADERBOARD_KP_ID]: whole(s.kp),
    // The tier, not stats.ascensions: they agree in play, and the tier is what
    // the game shows ("Age of Dominion"), so the board can't disagree with it.
    [CONFIG.LEADERBOARD_ASCENSION_ID]: whole(s.tier),
  };
}
